import { confirmPasswordReset, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "@/lib/firebase";

export const authService = {
  signIn: (email: string, password: string) => signInWithEmailAndPassword(auth, email, password),
  signOut: () => signOut(auth),
  sendPasswordReset: (email: string) => sendPasswordResetEmail(auth, email),
  verifyPasswordResetCode: (code: string) => verifyPasswordResetCode(auth, code),
  confirmPasswordReset: (code: string, newPassword: string) => confirmPasswordReset(auth, code, newPassword),
};
