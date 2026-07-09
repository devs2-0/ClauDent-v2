import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Role } from "../types/role.types";

export const roleService = {
  listRoles: async () => {
    const snap = await getDocs(collection(db, "roles"));
    return snap.docs.map((roleDoc) => ({ id: roleDoc.id, ...roleDoc.data() } as Role));
  },
  saveRole: (role: Role) => {
    return setDoc(doc(db, "roles", role.id), role, { merge: true });
  },
};
