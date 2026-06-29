import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { UserProfile } from "../types/auth.types";

export const userService = {
  getUserProfile: async (uid: string) => {
    const snap = await getDoc(doc(db, "usuarios", uid));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as UserProfile) : null;
  },
  upsertUserProfile: (uid: string, profile: Partial<UserProfile>) => {
    return setDoc(doc(db, "usuarios", uid), profile, { merge: true });
  },
};
