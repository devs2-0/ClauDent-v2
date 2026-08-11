import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export interface CurrentUserIdentity {
  usuarioId: string | null;
  usuarioNombre: string;
  usuarioEmail: string;
}

const pickDisplayName = (profile: Record<string, any> | null, fallbackName?: string | null, fallbackEmail?: string | null) => {
  const candidates = [
    profile?.displayName,
    profile?.nombre,
    profile?.name,
    profile?.usuarioNombre,
    fallbackName,
  ];

  const displayName = candidates.find((value) => typeof value === "string" && value.trim());
  return displayName?.trim() || fallbackEmail || "Sistema";
};

export const getCurrentUserIdentity = async (): Promise<CurrentUserIdentity> => {
  const user = auth.currentUser;

  if (!user) {
    return {
      usuarioId: null,
      usuarioNombre: "Sistema",
      usuarioEmail: "Sistema",
    };
  }

  let profile: Record<string, any> | null = null;

  try {
    const profileSnap = await getDoc(doc(db, "usuarios", user.uid));
    profile = profileSnap.exists() ? profileSnap.data() : null;
  } catch {
    profile = null;
  }

  return {
    usuarioId: user.uid,
    usuarioNombre: pickDisplayName(profile, user.displayName, user.email),
    usuarioEmail: user.email ?? "",
  };
};
