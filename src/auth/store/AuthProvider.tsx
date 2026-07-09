import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { collection, deleteDoc, doc, onSnapshot, runTransaction, serverTimestamp, writeBatch } from "firebase/firestore";
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

      if (user) {
        sessionMissingNotifiedRef.current = false;
        const currentSid = await registerOrUpdateSession(user.uid);
        sessionIdRef.current = currentSid;

        if (!deviceLogInProgressRef.current) {
          deviceLogInProgressRef.current = true;
          try {
            const deviceRef = doc(db, `usuarios/${user.uid}/dispositivos`, currentSid);
            const shouldLog = await runTransaction(db, async (tx) => {
              const snap = await tx.get(deviceRef);
              if (snap.exists()) return false;

              const { deviceType, deviceLabel, browser, browserVersion, os, platform } = getDeviceInfo();
              tx.set(deviceRef, {
                deviceType,
                deviceLabel,
                browser,
                browserVersion,
                os,
                platform,
                firstSeen: serverTimestamp(),
              });
              return true;
            });

            if (shouldLog) {
              await addAuditLog("LOGIN", "sistema", "Inicio de sesion (nuevo dispositivo)");
            }
          } finally {
            deviceLogInProgressRef.current = false;
          }
        }

        sessionUnsubRef.current = onSnapshot(collection(db, `usuarios/${user.uid}/sesiones`), (snap) => {
          const activeSessions = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            isCurrent: d.id === currentSid,
          } as UserSession));

          setSessions(activeSessions);

          if (!activeSessions.find((session) => session.id === currentSid) && !snap.metadata.fromCache && !sessionMissingNotifiedRef.current) {
            sessionMissingNotifiedRef.current = true;
            toast.error("Tu sesion ha sido finalizada remotamente.");
            logout().finally(() => {
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
      unsubAuth();
    };
  }, [logout]);

  const revokeSession = async (sid: string) => {
    const user = currentUserRef.current;
    if (!user) return;

    await deleteDoc(doc(db, `usuarios/${user.uid}/sesiones`, sid));
    await addAuditLog("UPDATE", "seguridad", `Sesion revocada ID: ${sid}`);
  };

  const closeAllOtherSessions = async () => {
    const user = currentUserRef.current;
    if (!user) return;

    const batch = writeBatch(db);
    const sid = getPersistentSessionId();

    sessions.forEach((session) => {
      if (session.id !== sid) {
        batch.delete(doc(db, `usuarios/${user.uid}/sesiones`, session.id));
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
