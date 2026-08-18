import type { Timestamp } from "firebase/firestore";

export type ClinicalStaffStatus = "active" | "inactive";

export interface Doctor {
  id: string;
  nombre: string;
  email?: string;
  telefono?: string;
  especialidad?: string;
  color?: string;
  status: ClinicalStaffStatus;
  visibleEnAgenda: boolean;
  userUid?: string | null;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  deletedAt?: Timestamp | null;
  deletedBy?: string | null;
}

export interface Assistant {
  id: string;
  nombre: string;
  email?: string;
  telefono?: string;
  notas?: string;
  doctorIdsAsignados: string[];
  status: ClinicalStaffStatus;
  visibleEnAgenda: boolean;
  userUid?: string | null;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  deletedAt?: Timestamp | null;
  deletedBy?: string | null;
}

export type CreateDoctorInput = Omit<
  Doctor,
  "id" | "createdAt" | "updatedAt" | "deletedAt" | "deletedBy"
>;

export type UpdateDoctorInput = Partial<
  Omit<Doctor, "id" | "createdAt" | "deletedAt" | "deletedBy">
>;

export type CreateAssistantInput = Omit<
  Assistant,
  "id" | "createdAt" | "updatedAt" | "deletedAt" | "deletedBy"
>;

export type UpdateAssistantInput = Partial<
  Omit<Assistant, "id" | "createdAt" | "deletedAt" | "deletedBy">
>;

export type AgendaStaffType = "doctor" | "assistant";

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type AvailabilityStatus = "active" | "inactive";

export type AgendaBlockStatus = "active" | "cancelled";

export interface StaffSchedule {
  id: string;
  staffType: AgendaStaffType;
  staffId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  status: AvailabilityStatus;

  scheduleType?: "weekly" | "special";
  date?: string | null;
  reason?: string;
  notes?: string;

  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface AgendaBlock {
  id: string;
  staffType: AgendaStaffType;
  staffId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  reason: string;
  notes?: string;
  status: AgendaBlockStatus;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  cancelledAt?: Timestamp | null;
  cancelledBy?: string | null;
}

export type CreateStaffScheduleInput = Omit<
  StaffSchedule,
  "id" | "createdAt" | "updatedAt"
>;

export type UpdateStaffScheduleInput = Partial<
  Omit<StaffSchedule, "id" | "createdAt">
>;

export type CreateAgendaBlockInput = Omit<
  AgendaBlock,
  "id" | "createdAt" | "updatedAt" | "cancelledAt" | "cancelledBy"
>;

export type UpdateAgendaBlockInput = Partial<
  Omit<AgendaBlock, "id" | "createdAt">
>;

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export type AppointmentType = "scheduled" | "walk_in";

export interface Appointment {
  id: string;
  patientId: string | null;
  patientName: string;
  serviceId: string | null;
  serviceName: string;
  doctorId: string;
  assistantIds: string[];
  startDate: string;
  startTime: string;
  endTime: string;
  startAt?: Timestamp | null;
  endAt?: Timestamp | null;
  reason: string;
  notes?: string;
  status: AppointmentStatus;

  appointmentType?: AppointmentType;
  arrivalTime?: string | null;
  waitMinutes?: number | null;
  walkInAssistantId?: string | null;

  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export type CreateAppointmentInput = Omit<
  Appointment,
  "id" | "createdAt" | "updatedAt" | "startAt" | "endAt"
>;

export type UpdateAppointmentInput = Partial<
  Omit<Appointment, "id" | "createdAt">
>;