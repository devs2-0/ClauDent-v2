import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export type AgendaNotificationType =
  | "appointment_created"
  | "appointment_updated"
  | "appointment_cancelled"
  | "appointment_status_changed"
  | "block_created"
  | "special_schedule_created";

export type AgendaNotificationEntityType =
  | "appointment"
  | "block"
  | "schedule";

export interface AgendaNotification {
  id: string;
  targetType: "doctor";
  targetDoctorId: string;
  type: AgendaNotificationType;
  title: string;
  message: string;
  entityType: AgendaNotificationEntityType;
  entityId: string;
  appointmentId?: string | null;
  blockId?: string | null;
  scheduleId?: string | null;
  startDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  read: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string | null;
  readAt?: unknown;
  readBy?: string | null;
}

export interface CreateAgendaNotificationInput {
  targetDoctorId: string;
  type: AgendaNotificationType;
  title: string;
  message: string;
  entityType: AgendaNotificationEntityType;
  entityId: string;
  appointmentId?: string | null;
  blockId?: string | null;
  scheduleId?: string | null;
  startDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  createdBy?: string | null;
}

const notificationsCollection = collection(db, "notificacionesAgenda");

const toNotification = (
  snapshot: QueryDocumentSnapshot,
): AgendaNotification => {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    targetType: "doctor",
    targetDoctorId:
      typeof data.targetDoctorId === "string" ? data.targetDoctorId : "",
    type:
      typeof data.type === "string"
        ? (data.type as AgendaNotificationType)
        : "appointment_updated",
    title: typeof data.title === "string" ? data.title : "Notificación",
    message: typeof data.message === "string" ? data.message : "",
    entityType:
      typeof data.entityType === "string"
        ? (data.entityType as AgendaNotificationEntityType)
        : "appointment",
    entityId: typeof data.entityId === "string" ? data.entityId : "",
    appointmentId:
      typeof data.appointmentId === "string" ? data.appointmentId : null,
    blockId: typeof data.blockId === "string" ? data.blockId : null,
    scheduleId: typeof data.scheduleId === "string" ? data.scheduleId : null,
    startDate: typeof data.startDate === "string" ? data.startDate : null,
    startTime: typeof data.startTime === "string" ? data.startTime : null,
    endTime: typeof data.endTime === "string" ? data.endTime : null,
    read: data.read === true,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    createdBy: typeof data.createdBy === "string" ? data.createdBy : null,
    readAt: data.readAt ?? null,
    readBy: typeof data.readBy === "string" ? data.readBy : null,
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

export const agendaNotificationService = {
  createForDoctor: async (
    input: CreateAgendaNotificationInput,
  ): Promise<string | null> => {
    if (!input.targetDoctorId) return null;

    const created = await addDoc(notificationsCollection, {
      targetType: "doctor",
      targetDoctorId: input.targetDoctorId,
      type: input.type,
      title: input.title,
      message: input.message,
      entityType: input.entityType,
      entityId: input.entityId,
      appointmentId: input.appointmentId ?? null,
      blockId: input.blockId ?? null,
      scheduleId: input.scheduleId ?? null,
      startDate: input.startDate ?? null,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      read: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: input.createdBy ?? null,
      readAt: null,
      readBy: null,
    });

    return created.id;
  },

  listUnreadByDoctorId: async (
    doctorId: string,
  ): Promise<AgendaNotification[]> => {
    if (!doctorId) return [];

    const q = query(
      notificationsCollection,
      where("targetDoctorId", "==", doctorId),
      where("read", "==", false),
    );

    const snapshot = await getDocs(q);

    return snapshot.docs
      .map(toNotification)
      .sort(
        (a, b) =>
          timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt),
      );
  },

  markAsRead: async (
    notificationId: string,
    actorUid?: string | null,
  ): Promise<void> => {
    await updateDoc(doc(db, "notificacionesAgenda", notificationId), {
      read: true,
      readAt: serverTimestamp(),
      readBy: actorUid ?? null,
      updatedAt: serverTimestamp(),
    });
  },

  markManyAsRead: async (
    notificationIds: string[],
    actorUid?: string | null,
  ): Promise<void> => {
    if (notificationIds.length === 0) return;

    const batch = writeBatch(db);

    notificationIds.forEach((notificationId) => {
      batch.update(doc(db, "notificacionesAgenda", notificationId), {
        read: true,
        readAt: serverTimestamp(),
        readBy: actorUid ?? null,
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();
  },
};