import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import type { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import type { DocumentSnapshot, FirestoreError } from "firebase/firestore";
import { toast } from "sonner";

import { auth, db } from "@/lib/firebase";
import { addAuditLog } from "@/modules/audit/services/auditService";
import {
  getDeviceInfo,
  getPersistentSessionId,
  registerOrUpdateSession,
  rotatePersistentSessionId,
} from "../services/sessionService";
import type { UserSession } from "../types/auth.types";
import type { AppUser } from "../types/user.types";

interface AuthContextValue {
  currentUser: User | null;
  currentUserProfile: AppUser | null;
  authLoading: boolean;
  profileLoading: boolean;
  profileError: Error | null;
  sessions: UserSession[];
  logout: () => Promise<void>;
  revokeSession: (sid: string) => Promise<void>;
  closeAllOtherSessions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const buildCurrentUserProfile = (
  firebaseUser: User,
  snapshot: DocumentSnapshot,
): AppUser | null => {
  if (!snapshot.exists()) return null;

  const data = snapshot.data();

  return {
    uid: firebaseUser.uid,
    email: data.email ?? firebaseUser.email ?? "",
    displayName: data.displayName ?? firebaseUser.displayName ?? undefined,
    photoURL: data.photoURL ?? firebaseUser.photoURL ?? null,
    phone: data.phone ?? null,
    status: data.status ?? "inactive",
    roleIds: Array.isArray(data.roleIds) ? data.roleIds : [],
    primaryRoleId: data.primaryRoleId ?? null,
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
    isAdmin: data.isAdmin === true,
    doctorId: data.doctorId ?? null,
    assistantId: data.assistantId ?? null,
    preferencias: {
      apariencia: data.preferencias?.apariencia === "dark" ? "dark" : "light",
    },
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    createdBy: data.createdBy ?? null,
    updatedBy: data.updatedBy ?? null,
    lastLoginAt: data.lastLoginAt ?? null,
  } as AppUser;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentUserProfile, setCurrentUserProfile] =
    useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<Error | null>(null);
  const [sessions, setSessions] = useState<UserSession[]>([]);

  const sessionIdRef = useRef<string | null>(null);
  const currentUserRef = useRef<User | null>(null);
  const logoutInProgressRef = useRef(false);
  const deviceLogInProgressRef = useRef(false);
  const sessionUnsubRef = useRef<null | (() => void)>(null);
  const profileUnsubRef = useRef<null | (() => void)>(null);
  const heartbeatCleanupRef = useRef<null | (() => void)>(null);
  const remoteLogoutInProgressRef = useRef(false);
  const authRunIdRef = useRef(0);

  const stopRealtimeListeners = useCallback(() => {
    if (sessionUnsubRef.current) {
      sessionUnsubRef.current();
      sessionUnsubRef.current = null;
    }

    if (profileUnsubRef.current) {
      profileUnsubRef.current();
      profileUnsubRef.current = null;
    }

    if (heartbeatCleanupRef.current) {
      heartbeatCleanupRef.current();
      heartbeatCleanupRef.current = null;
    }
  }, []);

  const buildRevokedSessionPayload = (reason: string) => ({
    status: "revoked",
    online: false,
    revokedAt: serverTimestamp(),
    revokedByUid: currentUserRef.current?.uid ?? null,
    revokedByEmail: currentUserRef.current?.email ?? null,
    revokedByName:
      currentUserRef.current?.displayName ||
      currentUserRef.current?.email ||
      null,
    revokeReason: reason,
    updatedAt: serverTimestamp(),
  });

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const logout = useCallback(async () => {
    if (logoutInProgressRef.current) return;

    logoutInProgressRef.current = true;

    try {
      const user = currentUserRef.current;

      if (user) {
        const sid = sessionIdRef.current ?? getPersistentSessionId();

        try {
          await deleteDoc(doc(db, `usuarios/${user.uid}/sesiones`, sid));
        } catch (error) {
          console.warn("No se pudo eliminar la sesion actual.", error);
        }

        try {
          await addAuditLog("LOGOUT", "sistema", "Sesion terminada");
        } catch (error) {
          console.warn("No se pudo registrar auditoria de logout.", error);
        }
      }

      rotatePersistentSessionId();
      await signOut(auth);
    } finally {
      logoutInProgressRef.current = false;
    }
  }, []);

  useEffect(() => {
    const isStaleRun = (runId: number, user: User) => {
      return authRunIdRef.current !== runId || auth.currentUser?.uid !== user.uid;
    };

    const forceRemoteLogout = () => {
      if (logoutInProgressRef.current || remoteLogoutInProgressRef.current) {
        return;
      }

      remoteLogoutInProgressRef.current = true;
      toast.error("Tu sesion ha sido finalizada remotamente.");
      rotatePersistentSessionId();

      signOut(auth).finally(() => {
        remoteLogoutInProgressRef.current = false;
      });
    };

    const startHeartbeat = (user: User) => {
      const updateCurrentSession = () => {
        registerOrUpdateSession(user.uid, user).catch(() => {
          // La app puede continuar aunque no se pueda actualizar el heartbeat.
        });
      };

      window.addEventListener("focus", updateCurrentSession);
      window.addEventListener("online", updateCurrentSession);
      document.addEventListener("visibilitychange", updateCurrentSession);

      const heartbeatId = window.setInterval(updateCurrentSession, 60_000);

      heartbeatCleanupRef.current = () => {
        window.clearInterval(heartbeatId);
        window.removeEventListener("focus", updateCurrentSession);
        window.removeEventListener("online", updateCurrentSession);
        document.removeEventListener("visibilitychange", updateCurrentSession);
      };
    };

    const registerDeviceAndAudit = async (
      user: User,
      currentSid: string,
      createdNewSession: boolean,
    ) => {
      if (deviceLogInProgressRef.current) return;

      deviceLogInProgressRef.current = true;

      try {
        const deviceRef = doc(db, `usuarios/${user.uid}/dispositivos`, currentSid);

        const shouldLog = await runTransaction(db, async (tx) => {
          const snap = await tx.get(deviceRef);

          if (snap.exists()) return false;

          const {
            deviceType,
            deviceLabel,
            browser,
            browserVersion,
            os,
            platform,
            language,
            timezone,
            screen,
          } = getDeviceInfo();

          tx.set(deviceRef, {
            deviceType,
            deviceLabel,
            browser,
            browserVersion,
            os,
            platform,
            language,
            timezone,
            screen,
            firstSeen: serverTimestamp(),
          });

          return true;
        });

        if (createdNewSession) {
          await addAuditLog(
            "LOGIN",
            "sistema",
            shouldLog
              ? "Inicio de sesion desde un dispositivo nuevo"
              : "Inicio de sesion registrado",
          );
        }
      } catch (error) {
        console.warn(
          "No se pudo registrar el dispositivo. La app continuara sin bloquearse.",
          error,
        );
      } finally {
        deviceLogInProgressRef.current = false;
      }
    };

    const startProfileListener = (user: User, runId: number) => {
      profileUnsubRef.current = onSnapshot(
        doc(db, "usuarios", user.uid),
        (snapshot) => {
          if (isStaleRun(runId, user)) return;

          setCurrentUserProfile(buildCurrentUserProfile(user, snapshot));
          setProfileError(null);
          setProfileLoading(false);
          setAuthLoading(false);
        },
        (error: FirestoreError) => {
          if (isStaleRun(runId, user)) return;

          console.warn("No se pudo cargar el perfil del usuario.", error);
          setCurrentUserProfile(null);
          setProfileError(error);
          setProfileLoading(false);
          setAuthLoading(false);
        },
      );
    };

    const startSessionListener = (
      user: User,
      initialSessionId: string,
      runId: number,
    ) => {
      let observedSessionId = initialSessionId;
      let currentSessionSeen = false;
      let recreateAttempted = false;

      sessionUnsubRef.current = onSnapshot(
        collection(db, `usuarios/${user.uid}/sesiones`),
        (snap) => {
          if (isStaleRun(runId, user)) return;

          const allSessions = snap.docs.map(
            (sessionDoc) =>
              ({
                id: sessionDoc.id,
                ...sessionDoc.data(),
                isCurrent: sessionDoc.id === observedSessionId,
              }) as UserSession,
          );

          const currentSession = allSessions.find(
            (session) => session.id === observedSessionId,
          );

          const activeSessions = allSessions.filter(
            (session) => session.status !== "revoked" && !session.revokedAt,
          );

          setSessions(activeSessions);

          const currentSessionRevoked =
            currentSession?.status === "revoked" || Boolean(currentSession?.revokedAt);

          if (currentSession && !currentSessionRevoked) {
            currentSessionSeen = true;
            return;
          }

          if (snap.metadata.fromCache || logoutInProgressRef.current) {
            return;
          }

          if (currentSessionRevoked || (currentSessionSeen && !currentSession)) {
            forceRemoteLogout();
            return;
          }

          if (!currentSession && !recreateAttempted) {
            recreateAttempted = true;

            registerOrUpdateSession(user.uid, user)
              .then((sessionRegistration) => {
                if (isStaleRun(runId, user)) return;

                observedSessionId = sessionRegistration.sessionId;
                sessionIdRef.current = sessionRegistration.sessionId;
              })
              .catch((error) => {
                console.warn(
                  "No se pudo confirmar la sesion actual. La app continuara sin cerrar la sesion local.",
                  error,
                );
              });
          }
        },
        (error) => {
          if (isStaleRun(runId, user)) return;

          console.warn(
            "No se pudo escuchar la coleccion de sesiones. La app continuara sin monitoreo de sesiones.",
            error,
          );

          setSessions([]);
        },
      );
    };

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      const runId = authRunIdRef.current + 1;
      authRunIdRef.current = runId;
      stopRealtimeListeners();
      setAuthLoading(true);
      setProfileLoading(true);
      setProfileError(null);

      if (!user) {
        sessionIdRef.current = null;
        currentUserRef.current = null;
        setCurrentUser(null);
        setCurrentUserProfile(null);
        setSessions([]);
        setProfileLoading(false);
        setAuthLoading(false);
        return;
      }

      setCurrentUser(user);
      currentUserRef.current = user;

      let currentSid = getPersistentSessionId();
      let createdNewSession = false;

      try {
        const sessionRegistration = await registerOrUpdateSession(user.uid, user);
        currentSid = sessionRegistration.sessionId;
        createdNewSession = sessionRegistration.createdNewSession;
      } catch (error) {
        console.warn(
          "No se pudo registrar o actualizar la sesion. La app continuara sin bloquearse.",
          error,
        );
      }

      if (isStaleRun(runId, user)) return;

      sessionIdRef.current = currentSid;
      startHeartbeat(user);
      startProfileListener(user, runId);
      startSessionListener(user, currentSid, runId);
      void registerDeviceAndAudit(user, currentSid, createdNewSession);
    });

    return () => {
      authRunIdRef.current += 1;
      stopRealtimeListeners();
      unsubAuth();
    };
  }, [stopRealtimeListeners]);

  const revokeSession = async (sid: string) => {
    const user = currentUserRef.current;

    if (!user) return;

    try {
      await updateDoc(
        doc(db, `usuarios/${user.uid}/sesiones`, sid),
        buildRevokedSessionPayload("Sesion cerrada desde seguridad"),
      );

      try {
        await addAuditLog(
          "REVOKE_SESSION",
          "seguridad",
          "Sesion propia cerrada desde seguridad",
        );
      } catch (error) {
        console.warn("No se pudo registrar auditoria de revocacion.", error);
      }
    } catch (error) {
      console.error(error);
      toast.error("No se pudo revocar la sesion.");
    }
  };

  const closeAllOtherSessions = async () => {
    const user = currentUserRef.current;

    if (!user) return;

    try {
      const batch = writeBatch(db);
      const sid = sessionIdRef.current ?? getPersistentSessionId();

      sessions.forEach((session) => {
        if (session.id !== sid) {
          batch.update(
            doc(db, `usuarios/${user.uid}/sesiones`, session.id),
            buildRevokedSessionPayload("Cierre masivo de sesiones propias"),
          );
        }
      });

      await batch.commit();

      toast.success("Otras sesiones cerradas correctamente");

      try {
        await addAuditLog(
          "REVOKE_ALL_SESSIONS",
          "seguridad",
          "Cierre masivo de sesiones propias remotas",
        );
      } catch (error) {
        console.warn("No se pudo registrar auditoria de sesiones.", error);
      }
    } catch (error) {
      console.error(error);
      toast.error("No se pudieron cerrar las otras sesiones.");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentUserProfile,
        authLoading,
        profileLoading,
        profileError,
        sessions,
        logout,
        revokeSession,
        closeAllOtherSessions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
};
