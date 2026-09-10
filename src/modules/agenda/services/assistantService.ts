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
  Assistant,
  CreateAssistantInput,
  UpdateAssistantInput,
} from "../types/agenda.types";

const assistantsCollection = collection(db, "asistentes");

const toAssistant = (
  snapshot: QueryDocumentSnapshot<DocumentData>,
): Assistant => {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    nombre: typeof data.nombre === "string" ? data.nombre : "",
    email: typeof data.email === "string" ? data.email : "",
    telefono: typeof data.telefono === "string" ? data.telefono : "",
    notas: typeof data.notas === "string" ? data.notas : "",
    doctorIdsAsignados: Array.isArray(data.doctorIdsAsignados)
      ? data.doctorIdsAsignados.filter(
          (item: unknown): item is string => typeof item === "string",
        )
      : [],
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

export const assistantService = {
  listAssistants: async (): Promise<Assistant[]> => {
    const snapshot = await getDocs(
      query(assistantsCollection, orderBy("nombre")),
    );

    return snapshot.docs.map(toAssistant);
  },

  createAssistant: async (input: CreateAssistantInput): Promise<string> => {
    const email = input.email?.trim().toLowerCase() || "";
    if (!email) throw new Error("El correo del asistente es obligatorio.");

    const created = await addDoc(assistantsCollection, {
      ...input,
      nombre: input.nombre.trim(),
      email,
      telefono: input.telefono?.trim() || "",
      notas: input.notas?.trim() || "",
      doctorIdsAsignados: input.doctorIdsAsignados ?? [],
      status: input.status ?? "active",
      visibleEnAgenda: input.visibleEnAgenda !== false,
      userUid: input.userUid ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return created.id;
  },

  updateAssistant: async (
    assistantId: string,
    input: UpdateAssistantInput,
  ): Promise<void> => {
    const normalizedInput = { ...input };
    if ("email" in input) {
      const email = input.email?.trim().toLowerCase() || "";
      if (!email) throw new Error("El correo del asistente es obligatorio.");
      normalizedInput.email = email;
    }

    await updateDoc(doc(db, "asistentes", assistantId), {
      ...normalizedInput,
      updatedAt: serverTimestamp(),
    });
  },

  deactivateAssistant: async (
    assistantId: string,
    actorId?: string | null,
  ): Promise<void> => {
    await updateDoc(doc(db, "asistentes", assistantId), {
      status: "inactive",
      visibleEnAgenda: false,
      deletedAt: serverTimestamp(),
      deletedBy: actorId ?? null,
      updatedAt: serverTimestamp(),
      updatedBy: actorId ?? null,
    });
  },
};
