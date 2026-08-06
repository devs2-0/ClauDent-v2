import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { collection, deleteDoc, doc, onSnapshot, runTransaction, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { toast } from "sonner";
import { auth, db } from "@/lib/firebase";
import { addAuditLog } from "@/modules/audit/services/auditService";
import { getDeviceInfo, getPersistentSessionId, registerOrUpdateSession } from "../services/sessionService";
import type { UserSession } from "../types/auth.types";

interface AuthContextValue {
  currentUser: User | null;
  authLoading: boolean;
  sessions: UserSession[];
  logout: () => Promise<void>;
  revokeSession: (sid: string) => Promise<void>;
  closeAllOtherSessions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const sessionUnsubRef = useRef<null | (() => void)>(null);
  const sessionIdRef = useRef<string | null>(null);
  const currentUserRef = useRef<User | null>(null);
  const sessionMissingNotifiedRef = useRef(false);
  const logoutInProgressRef = useRef(false);
  const deviceLogInProgressRef = useRef(false);
  const heartbeatCleanupRef = useRef<null | (() => void)>(null);

  const buildRevokedSessionPayload = (reason: string) => ({
    status: "revoked",
    online: false,
    revokedAt: serverTimestamp(),
    revokedByUid: currentUserRef.current?.uid ?? null,
    revokedByEmail: currentUserRef.current?.email ?? null,
    revokedByName: currentUserRef.current?.displayName || currentUserRef.current?.email || null,
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
        await deleteDoc(doc(db, `usuarios/${user.uid}/sesiones`, sid));
        await addAuditLog("LOGOUT", "sistema", "Sesion terminada");
      }

      await signOut(auth);
    } finally {
      logoutInProgressRef.current = false;
    }
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (sessionUnsubRef.current) {
        sessionUnsubRef.current();
        sessionUnsubRef.current = null;
      }
      if (heartbeatCleanupRef.current) {
        heartbeatCleanupRef.current();
        heartbeatCleanupRef.current = null;
      }

      if (user) {
        sessionMissingNotifiedRef.current = false;
        const sessionRegistration = await registerOrUpdateSession(user.uid, user);
        const currentSid = sessionRegistration.sessionId;
        sessionIdRef.current = currentSid;

        const updateCurrentSession = () => {
          registerOrUpdateSession(user.uid, user).catch(() => {
            // La suscripcion de sesiones se encarga de avisar si la sesion fue revocada.
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

        if (!deviceLogInProgressRef.current) {
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

            if (sessionRegistration.createdNewSession) {
              await addAuditLog(
                "LOGIN",
                "sistema",
                shouldLog
                  ? `Inicio de sesion (nuevo dispositivo) | Sesion: ${currentSid}`
                  : `Inicio de sesion | Sesion: ${currentSid}`,
              );
            }
          } finally {
            deviceLogInProgressRef.current = false;
          }
        }

        sessionUnsubRef.current = onSnapshot(collection(db, `usuarios/${user.uid}/sesiones`), (snap) => {
          const allSessions = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            isCurrent: d.id === currentSid,
          } as UserSession));
          const currentSession = allSessions.find((session) => session.id === currentSid);
          const activeSessions = allSessions.filter((session) => session.status !== "revoked" && !session.revokedAt);

          setSessions(activeSessions);

          if (
            (!currentSession || currentSession.status === "revoked" || currentSession.revokedAt)
            && !snap.metadata.fromCache
            && !sessionMissingNotifiedRef.current
          ) {
            sessionMissingNotifiedRef.current = true;
            toast.error("Tu sesion ha sido finalizada remotamente.");
            signOut(auth).finally(() => {
              sessionMissingNotifiedRef.current = false;
            });
          }
        });

        setCurrentUser(user);
        currentUserRef.current = user;
        setAuthLoading(false);
      } else {
        sessionIdRef.current = null;
        setSessions([]);
        setCurrentUser(null);
        currentUserRef.current = null;
        setAuthLoading(false);
      }
    });

    return () => {
      if (sessionUnsubRef.current) {
        sessionUnsubRef.current();
        sessionUnsubRef.current = null;
      }
      if (heartbeatCleanupRef.current) {
        heartbeatCleanupRef.current();
        heartbeatCleanupRef.current = null;
      }
      unsubAuth();
    };
  }, [logout]);

  const revokeSession = async (sid: string) => {
    const user = currentUserRef.current;
    if (!user) return;

    await updateDoc(doc(db, `usuarios/${user.uid}/sesiones`, sid), buildRevokedSessionPayload("Sesion cerrada desde seguridad"));
    await addAuditLog("UPDATE", "seguridad", `Sesion revocada ID: ${sid}`);
  };

  const closeAllOtherSessions = async () => {
    const user = currentUserRef.current;
    if (!user) return;

    const batch = writeBatch(db);
    const sid = getPersistentSessionId();

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
    await addAuditLog("UPDATE", "seguridad", "Cierre masivo de sesiones remotas");
  };

  return (
    <AuthContext.Provider value={{ currentUser, authLoading, sessions, logout, revokeSession, closeAllOtherSessions }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
