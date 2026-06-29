import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export const addAuditLog = async (accion: string, modulo: string, detalle: string) => {
  try {
    await addDoc(collection(db, "bitacora"), {
      usuarioEmail: auth.currentUser?.email || "Sistema",
      accion,
      modulo,
      detalle,
      fecha: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error bitacora:", error);
  }
};
