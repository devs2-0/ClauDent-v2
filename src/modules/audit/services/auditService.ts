import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const getAuditUser = () => {
  const user = auth.currentUser;
  const email = user?.email || "Sistema";
  return {
    usuarioEmail: email,
    usuarioNombre: user?.displayName || email || "Admin",
    usuarioId: user?.uid ?? null,
  };
};

export const addAuditLog = async (accion: string, modulo: string, detalle: string) => {
  try {
    const auditUser = getAuditUser();
    await addDoc(collection(db, "bitacora"), {
      ...auditUser,
      accion,
      modulo,
      detalle,
      fecha: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error bitacora:", error);
  }
};
