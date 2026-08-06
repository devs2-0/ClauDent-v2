import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getCurrentUserIdentity } from "@/shared/services/currentUserIdentity";

export const addAuditLog = async (accion: string, modulo: string, detalle: string) => {
  try {
    const userIdentity = await getCurrentUserIdentity();
    await addDoc(collection(db, "bitacora"), {
      usuarioId: userIdentity.usuarioId,
      usuarioNombre: userIdentity.usuarioNombre,
      usuarioEmail: userIdentity.usuarioEmail,
      accion,
      modulo,
      detalle,
      fecha: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error bitacora:", error);
  }
};
