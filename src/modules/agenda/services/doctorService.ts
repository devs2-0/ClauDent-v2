import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type {
  CreateDoctorInput,
  Doctor,
  UpdateDoctorInput,
} from "../types/agenda.types";

const doctorsCollection = collection(db, "doctores");

const toDoctor = (snapshot: QueryDocumentSnapshot<DocumentData>): Doctor => {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    nombre: typeof data.nombre === "string" ? data.nombre : "",
    email: typeof data.email === "string" ? data.email : "",
    telefono: typeof data.telefono === "string" ? data.telefono : "",
    especialidad:
      typeof data.especialidad === "string" ? data.especialidad : "",
    color: typeof data.color === "string" ? data.color : "#2563EB",
    status: data.status === "inactive" ? "inactive" : "active",
    visibleEnAgenda: data.visibleEnAgenda !== false,
    userUid: typeof data.userUid === "string" ? data.userUid : null,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    createdBy: typeof data.createdBy === "string" ? data.createdBy : null,
    updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : null,
    deletedAt: data.deletedAt ?? null,
    deletedBy: typeof data.deletedBy === "string" ? data.deletedBy : null,
  };
};

export const doctorService = {
  listDoctors: async (): Promise<Doctor[]> => {
    const snapshot = await getDocs(query(doctorsCollection, orderBy("nombre")));

    return snapshot.docs.map(toDoctor);
  },

  createDoctor: async (input: CreateDoctorInput): Promise<string> => {
    const created = await addDoc(doctorsCollection, {
      ...input,
      nombre: input.nombre.trim(),
      email: input.email?.trim().toLowerCase() || "",
      telefono: input.telefono?.trim() || "",
      especialidad: input.especialidad?.trim() || "",
      color: input.color || "#2563EB",
      status: input.status ?? "active",
      visibleEnAgenda: input.visibleEnAgenda !== false,
      userUid: input.userUid ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return created.id;
  },

  updateDoctor: async (
    doctorId: string,
    input: UpdateDoctorInput,
  ): Promise<void> => {
    await updateDoc(doc(db, "doctores", doctorId), {
      ...input,
      updatedAt: serverTimestamp(),
    });
  },

  deactivateDoctor: async (
    doctorId: string,
    actorId?: string | null,
  ): Promise<void> => {
    await updateDoc(doc(db, "doctores", doctorId), {
      status: "inactive",
      visibleEnAgenda: false,
      deletedAt: serverTimestamp(),
      deletedBy: actorId ?? null,
      updatedAt: serverTimestamp(),
      updatedBy: actorId ?? null,
    });
  },
};