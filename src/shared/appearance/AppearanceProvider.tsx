import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { toast } from "sonner";

import { useAuth } from "@/auth";
import { db } from "@/lib/firebase";
import { useCurrentUserProfile } from "@/auth/hooks/useCurrentUserProfile";
import type { UserAppearanceMode } from "@/auth/types/user.types";

interface AppearanceContextValue {
  mode: UserAppearanceMode;
  loading: boolean;
  saving: boolean;
  setMode: (mode: UserAppearanceMode) => Promise<void>;
}

const AppearanceContext = createContext<AppearanceContextValue | undefined>(undefined);
const STORAGE_KEY = "claudent_appearance_mode";

const normalizeMode = (value: unknown): UserAppearanceMode => {
  return value === "dark" ? "dark" : "light";
};

const applyMode = (mode: UserAppearanceMode) => {
  document.documentElement.classList.toggle("dark", mode === "dark");
  document.documentElement.style.colorScheme = mode;
};

export const AppearanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { profile, loading } = useCurrentUserProfile();
  const [mode, setModeState] = useState<UserAppearanceMode>(() => {
    return normalizeMode(window.localStorage.getItem(STORAGE_KEY));
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    applyMode(mode);
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    if (loading) return;
    const profileMode = profile?.preferencias?.apariencia;
    if (profileMode) {
      setModeState(normalizeMode(profileMode));
    }
  }, [loading, profile?.preferencias?.apariencia]);

  const setMode = useCallback(async (nextMode: UserAppearanceMode) => {
    const normalizedMode = normalizeMode(nextMode);
    setModeState(normalizedMode);

    if (!currentUser) return;

    setSaving(true);
    try {
      await setDoc(
        doc(db, "usuarios", currentUser.uid),
        {
          preferencias: {
            apariencia: normalizedMode,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      toast.success("Apariencia guardada en tu perfil");
    } catch (error) {
      toast.error("No se pudo guardar la apariencia.");
      throw error;
    } finally {
      setSaving(false);
    }
  }, [currentUser]);

  return (
    <AppearanceContext.Provider value={{ mode, loading, saving, setMode }}>
      {children}
    </AppearanceContext.Provider>
  );
};

export const useAppearance = () => {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error("useAppearance must be used within AppearanceProvider");
  return context;
};
