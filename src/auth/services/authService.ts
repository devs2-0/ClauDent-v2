import {
  browserLocalPersistence,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  deleteUser,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  verifyPasswordResetCode,
} from "firebase/auth";
import type { User, UserProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";

let localPersistencePromise: Promise<void> | null = null;

const ensureLocalPersistence = async () => {
  if (!localPersistencePromise) {
    localPersistencePromise = setPersistence(auth, browserLocalPersistence).catch(
      (error) => {
        localPersistencePromise = null;
        console.warn("No se pudo fijar la persistencia local de auth.", error);
      },
    );
  }

  await localPersistencePromise;
};

export const authService = {
  signIn: async (email: string, password: string) => {
    await ensureLocalPersistence();
    return signInWithEmailAndPassword(auth, email, password);
  },
  createUser: async (email: string, password: string) => {
    await ensureLocalPersistence();
    return createUserWithEmailAndPassword(auth, email, password);
  },
  updateProfile: (user: User, profile: UserProfile) =>
    updateProfile(user, profile),
  deleteUser: (user: User) => deleteUser(user),
  signOut: () => signOut(auth),
  sendPasswordReset: (email: string) => sendPasswordResetEmail(auth, email),
  verifyPasswordResetCode: (code: string) => verifyPasswordResetCode(auth, code),
  confirmPasswordReset: (code: string, newPassword: string) => confirmPasswordReset(auth, code, newPassword),
};
