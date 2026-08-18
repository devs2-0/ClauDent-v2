import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export type AgendaHistoryAction =
  | "appointment_created"
  | "appointment_updated"
  | "appointment_cancelled"
  | "appointment_status_changed"
  | "block_created"
  | "schedule_created"
  | "special_schedule_created";

export type AgendaHistoryEntityType = "appointment" | "block" | "schedule";

export interface AgendaHistoryLog {
  id: string;
  action: AgendaHistoryAction;
  entityType: AgendaHistoryEntityType;
  entityId: string;
  doctorId?: string | null;
  patientId?: string | null;
  patientName?: string | null;
  title: string;
  description: string;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  createdAt?: unknown;
  createdBy?: string | null;
  createdByEmail?: string | null;
}

export interface CreateAgendaHistoryLogInput {
  action: AgendaHistoryAction;
  entityType: AgendaHistoryEntityType;
  entityId: string;
  doctorId?: string | null;
  patientId?: string | null;
  patientName?: string | null;
  title: string;
  description: string;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  createdBy?: string | null;
  createdByEmail?: string | null;
}

const historyCollection = collection(db, "historialAgenda");

const toHistoryLog = (
  snapshot: QueryDocumentSnapshot,
): AgendaHistoryLog => {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    action:
      typeof data.action === "string"
        ? (data.action as AgendaHistoryAction)
        : "appointment_updated",
    entityType:
      typeof data.entityType === "string"
        ? (data.entityType as AgendaHistoryEntityType)
        : "appointment",
    entityId: typeof data.entityId === "string" ? data.entityId : "",
    doctorId: typeof data.doctorId === "string" ? data.doctorId : null,
    patientId: typeof data.patientId === "string" ? data.patientId : null,
    patientName:
      typeof data.patientName === "string" ? data.patientName : null,
    title:
      typeof data.title === "string"
        ? data.title
        : "Movimiento de agenda",
    description:
      typeof data.description === "string" ? data.description : "",
    date: typeof data.date === "string" ? data.date : null,
    startTime: typeof data.startTime === "string" ? data.startTime : null,
    endTime: typeof data.endTime === "string" ? data.endTime : null,
    before:
      data.before && typeof data.before === "object"
        ? (data.before as Record<string, unknown>)
        : null,
    after:
      data.after && typeof data.after === "object"
        ? (data.after as Record<string, unknown>)
        : null,
    createdAt: data.createdAt ?? null,
    createdBy: typeof data.createdBy === "string" ? data.createdBy : null,
    createdByEmail:
      typeof data.createdByEmail === "string" ? data.createdByEmail : null,
  };
};

const timestampToMillis = (value: unknown) => {
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }

  return 0;
};

export const agendaHistoryService = {
  createLog: async (
    input: CreateAgendaHistoryLogInput,
  ): Promise<string> => {
    const created = await addDoc(historyCollection, {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      doctorId: input.doctorId ?? null,
      patientId: input.patientId ?? null,
      patientName: input.patientName ?? null,
      title: input.title,
      description: input.description,
      date: input.date ?? null,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      before: input.before ?? null,
      after: input.after ?? null,
      createdAt: serverTimestamp(),
      createdBy: input.createdBy ?? null,
      createdByEmail: input.createdByEmail ?? null,
    });

    return created.id;
  },

  listByAppointmentId: async (
    appointmentId: string,
  ): Promise<AgendaHistoryLog[]> => {
    const q = query(
      historyCollection,
      where("entityType", "==", "appointment"),
      where("entityId", "==", appointmentId),
    );

    const snapshot = await getDocs(q);

    return snapshot.docs
      .map(toHistoryLog)
      .sort(
        (a, b) =>
          timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt),
      );
  },

  listByDoctorId: async (
    doctorId: string,
  ): Promise<AgendaHistoryLog[]> => {
    const q = query(historyCollection, where("doctorId", "==", doctorId));

    const snapshot = await getDocs(q);

    return snapshot.docs
      .map(toHistoryLog)
      .sort(
        (a, b) =>
          timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt),
      );
  },
    listRecent: async (): Promise<AgendaHistoryLog[]> => {
    const snapshot = await getDocs(historyCollection);

    return snapshot.docs
      .map(toHistoryLog)
      .sort(
        (a, b) =>
          timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt),
      )
      .slice(0, 100);
  },
};