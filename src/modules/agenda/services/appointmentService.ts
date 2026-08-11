import {
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  Timestamp,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type {
  Appointment,
  AppointmentStatus,
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from "../types/agenda.types";

const appointmentsCollection = collection(db, "citas");

const toLocalDateTime = (date: string, time: string) => {
  return new Date(`${date}T${time}:00`);
};

const normalizeAppointmentStatus = (
  value: unknown,
): AppointmentStatus => {
  if (
    value === "confirmed" ||
    value === "completed" ||
    value === "cancelled" ||
    value === "no_show"
  ) {
    return value;
  }

  return "scheduled";
};

const toAppointment = (
  snapshot: QueryDocumentSnapshot<DocumentData>,
): Appointment => {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    patientId: typeof data.patientId === "string" ? data.patientId : null,
    patientName:
    typeof data.patientName === "string" ? data.patientName : "",
    serviceId: typeof data.serviceId === "string" ? data.serviceId : null,
    serviceName:
    typeof data.serviceName === "string" ? data.serviceName : "",
    doctorId: typeof data.doctorId === "string" ? data.doctorId : "",
    assistantIds: Array.isArray(data.assistantIds)
      ? data.assistantIds.filter(
          (item: unknown): item is string => typeof item === "string",
        )
      : [],
    startDate: typeof data.startDate === "string" ? data.startDate : "",
    startTime: typeof data.startTime === "string" ? data.startTime : "09:00",
    endTime: typeof data.endTime === "string" ? data.endTime : "09:30",
    startAt: data.startAt ?? null,
    endAt: data.endAt ?? null,
    reason: typeof data.reason === "string" ? data.reason : "",
    notes: typeof data.notes === "string" ? data.notes : "",
    status: normalizeAppointmentStatus(data.status),
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    createdBy: typeof data.createdBy === "string" ? data.createdBy : null,
    updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : null,
  };
};

export const appointmentService = {
  listAppointments: async (): Promise<Appointment[]> => {
    const snapshot = await getDocs(appointmentsCollection);

    return snapshot.docs
      .map(toAppointment)
      .sort((a, b) => {
        if (a.startDate !== b.startDate) {
          return a.startDate.localeCompare(b.startDate);
        }

        return a.startTime.localeCompare(b.startTime);
      });
  },

  createAppointment: async (
    input: CreateAppointmentInput,
  ): Promise<string> => {
    const created = await addDoc(appointmentsCollection, {
      ...input,
        patientId: input.patientId ?? null,
        patientName: input.patientName.trim(),
        serviceId: input.serviceId ?? null,
        serviceName: input.serviceName.trim(),
        doctorId: input.doctorId,
      assistantIds: input.assistantIds ?? [],
      startDate: input.startDate,
      startTime: input.startTime,
      endTime: input.endTime,
      startAt: Timestamp.fromDate(
        toLocalDateTime(input.startDate, input.startTime),
      ),
      endAt: Timestamp.fromDate(
        toLocalDateTime(input.startDate, input.endTime),
      ),
      reason: input.reason.trim(),
      notes: input.notes?.trim() || "",
      status: input.status ?? "scheduled",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return created.id;
  },

  updateAppointment: async (
    appointmentId: string,
    input: UpdateAppointmentInput,
  ): Promise<void> => {
    const payload: Record<string, unknown> = {
      ...input,
      updatedAt: serverTimestamp(),
    };

    if (input.startDate && input.startTime) {
      payload.startAt = Timestamp.fromDate(
        toLocalDateTime(input.startDate, input.startTime),
      );
    }

    if (input.startDate && input.endTime) {
      payload.endAt = Timestamp.fromDate(
        toLocalDateTime(input.startDate, input.endTime),
      );
    }

    await updateDoc(doc(db, "citas", appointmentId), payload);
  },

  updateAppointmentStatus: async (
    appointmentId: string,
    status: AppointmentStatus,
    actorUid?: string | null,
  ): Promise<void> => {
    await updateDoc(doc(db, "citas", appointmentId), {
      status,
      updatedAt: serverTimestamp(),
      updatedBy: actorUid ?? null,
    });
  },
};