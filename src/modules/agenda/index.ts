export { default as AgendaPage } from "./pages/AgendaPage";

export { doctorService } from "./services/doctorService";
export { assistantService } from "./services/assistantService";

export type {
  Assistant,
  ClinicalStaffStatus,
  CreateAssistantInput,
  CreateDoctorInput,
  Doctor,
  UpdateAssistantInput,
  UpdateDoctorInput,
} from "./types/agenda.types";

export { availabilityService } from "./services/availabilityService";

export type {
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
} from "./types/agenda.types";

export { appointmentService } from "./services/appointmentService";

export type {
  Appointment,
  AppointmentStatus,
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from "./types/agenda.types";

export { default as DailyCalendarView } from "./components/DailyCalendarView";

export { serviceLookupService } from "./services/serviceLookupService";

export type { ServiceLookup } from "./services/serviceLookupService";

export { default as SearchableSelect } from "./components/SearchableSelect";
export { default as StaffSearchSelect } from "./components/StaffSearchSelect";

export { default as MonthlyCalendarView } from "./components/MonthlyCalendarView";
export { default as WeeklyCalendarView } from "./components/WeeklyCalendarView";

export { default as AppointmentDetailsDialog } from "./components/AppointmentDetailsDialog";