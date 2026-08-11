import {
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type {
  AgendaBlock,
  AgendaBlockStatus,
  AgendaStaffType,
  AvailabilityStatus,
  CreateAgendaBlockInput,
  CreateStaffScheduleInput,
  DayOfWeek,
  StaffSchedule,
  UpdateAgendaBlockInput,
  UpdateStaffScheduleInput,
} from "../types/agenda.types";

const schedulesCollection = collection(db, "horariosPersonal");
const blocksCollection = collection(db, "bloqueosAgenda");

const isStaffType = (value: unknown): value is AgendaStaffType => {
  return value === "doctor" || value === "assistant";
};

const normalizeStaffType = (value: unknown): AgendaStaffType => {
  return isStaffType(value) ? value : "doctor";
};

const normalizeDayOfWeek = (value: unknown): DayOfWeek => {
  return value === 0 ||
    value === 1 ||
    value === 2 ||
    value === 3 ||
    value === 4 ||
    value === 5 ||
    value === 6
    ? value
    : 1;
};

const normalizeAvailabilityStatus = (
  value: unknown,
): AvailabilityStatus => {
  return value === "inactive" ? "inactive" : "active";
};

const normalizeBlockStatus = (value: unknown): AgendaBlockStatus => {
  return value === "cancelled" ? "cancelled" : "active";
};

const normalizeScheduleType = (
  scheduleType: unknown,
  date: unknown,
): "weekly" | "special" => {
  if (scheduleType === "special") return "special";

  if (typeof date === "string" && date.trim()) {
    return "special";
  }

  return "weekly";
};

const toSchedule = (snapshot: QueryDocumentSnapshot): StaffSchedule => {
  const data = snapshot.data();

  const scheduleType = normalizeScheduleType(data.scheduleType, data.date);

  return {
    id: snapshot.id,
    staffType: normalizeStaffType(data.staffType),
    staffId: typeof data.staffId === "string" ? data.staffId : "",
    dayOfWeek: normalizeDayOfWeek(data.dayOfWeek),
    startTime: typeof data.startTime === "string" ? data.startTime : "09:00",
    endTime: typeof data.endTime === "string" ? data.endTime : "14:00",
    status: normalizeAvailabilityStatus(data.status),

    scheduleType,
    date:
      scheduleType === "special" && typeof data.date === "string"
        ? data.date
        : null,
    reason: typeof data.reason === "string" ? data.reason : "",
    notes: typeof data.notes === "string" ? data.notes : "",

    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    createdBy: typeof data.createdBy === "string" ? data.createdBy : null,
    updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : null,
  };
};

const toBlock = (snapshot: QueryDocumentSnapshot): AgendaBlock => {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    staffType: normalizeStaffType(data.staffType),
    staffId: typeof data.staffId === "string" ? data.staffId : "",
    startDate: typeof data.startDate === "string" ? data.startDate : "",
    endDate:
      typeof data.endDate === "string"
        ? data.endDate
        : typeof data.startDate === "string"
          ? data.startDate
          : "",
    startTime: typeof data.startTime === "string" ? data.startTime : "00:00",
    endTime: typeof data.endTime === "string" ? data.endTime : "23:59",
    allDay: data.allDay === true,
    reason: typeof data.reason === "string" ? data.reason : "",
    notes: typeof data.notes === "string" ? data.notes : "",
    status: normalizeBlockStatus(data.status),
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    createdBy: typeof data.createdBy === "string" ? data.createdBy : null,
    updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : null,
    cancelledAt: data.cancelledAt ?? null,
    cancelledBy:
      typeof data.cancelledBy === "string" ? data.cancelledBy : null,
  };
};

export const availabilityService = {
  listSchedules: async (): Promise<StaffSchedule[]> => {
    const snapshot = await getDocs(schedulesCollection);

    return snapshot.docs
      .map(toSchedule)
      .sort((a, b) => {
        if (a.staffType !== b.staffType) {
          return a.staffType.localeCompare(b.staffType);
        }

        if (a.staffId !== b.staffId) {
          return a.staffId.localeCompare(b.staffId);
        }

        if ((a.scheduleType ?? "weekly") !== (b.scheduleType ?? "weekly")) {
          return (a.scheduleType ?? "weekly").localeCompare(
            b.scheduleType ?? "weekly",
          );
        }

        if ((a.date ?? "") !== (b.date ?? "")) {
          return (a.date ?? "").localeCompare(b.date ?? "");
        }

        if (a.dayOfWeek !== b.dayOfWeek) {
          return a.dayOfWeek - b.dayOfWeek;
        }

        return a.startTime.localeCompare(b.startTime);
      });
  },

  createSchedule: async (
    input: CreateStaffScheduleInput,
  ): Promise<string> => {
    const scheduleType = input.scheduleType === "special" ? "special" : "weekly";

    const created = await addDoc(schedulesCollection, {
      staffType: input.staffType,
      staffId: input.staffId,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      status: input.status ?? "active",

      scheduleType,
      date: scheduleType === "special" ? input.date ?? null : null,
      reason: input.reason?.trim() ?? "",
      notes: input.notes?.trim() ?? "",

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: input.createdBy ?? null,
      updatedBy: input.updatedBy ?? null,
    });

    return created.id;
  },

  updateSchedule: async (
    scheduleId: string,
    input: UpdateStaffScheduleInput,
  ): Promise<void> => {
    await updateDoc(doc(db, "horariosPersonal", scheduleId), {
      ...input,
      updatedAt: serverTimestamp(),
    });
  },

  deactivateSchedule: async (
    scheduleId: string,
    actorUid?: string | null,
  ): Promise<void> => {
    await updateDoc(doc(db, "horariosPersonal", scheduleId), {
      status: "inactive",
      updatedAt: serverTimestamp(),
      updatedBy: actorUid ?? null,
    });
  },

  listBlocks: async (): Promise<AgendaBlock[]> => {
    const snapshot = await getDocs(blocksCollection);

    return snapshot.docs
      .map(toBlock)
      .sort((a, b) => {
        if (a.startDate !== b.startDate) {
          return a.startDate.localeCompare(b.startDate);
        }

        return a.startTime.localeCompare(b.startTime);
      });
  },

  createBlock: async (input: CreateAgendaBlockInput): Promise<string> => {
    const created = await addDoc(blocksCollection, {
      staffType: input.staffType,
      staffId: input.staffId,
      startDate: input.startDate,
      endDate: input.endDate,
      startTime: input.startTime,
      endTime: input.endTime,
      allDay: input.allDay,
      reason: input.reason.trim(),
      notes: input.notes?.trim() || "",
      status: input.status ?? "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: input.createdBy ?? null,
      updatedBy: input.updatedBy ?? null,
    });

    return created.id;
  },

  updateBlock: async (
    blockId: string,
    input: UpdateAgendaBlockInput,
  ): Promise<void> => {
    await updateDoc(doc(db, "bloqueosAgenda", blockId), {
      ...input,
      updatedAt: serverTimestamp(),
    });
  },

  cancelBlock: async (
    blockId: string,
    actorUid?: string | null,
  ): Promise<void> => {
    await updateDoc(doc(db, "bloqueosAgenda", blockId), {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
      cancelledBy: actorUid ?? null,
      updatedAt: serverTimestamp(),
      updatedBy: actorUid ?? null,
    });
  },
};