import { useEffect, useMemo, useState } from "react";
import {
  Clock,
  Plus,
  Stethoscope,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth, useCan } from "@/auth";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useConfirmAction } from "@/shared/hooks/useConfirmAction";

import AgendaBlockDialog, {
  type AgendaBlockFormState,
} from "./AgendaBlockDialog";
import AppointmentDetailsDialog from "./AppointmentDetailsDialog";
import AppointmentDialog, {
  type AppointmentFormState,
} from "./AppointmentDialog";
import CalendarSlotActionDialog, {
  type CalendarSlotSelection,
} from "./CalendarSlotActionDialog";
import DailyCalendarView from "./DailyCalendarView";
import MonthlyCalendarView from "./MonthlyCalendarView";
import SearchableSelect, {
  type SearchableSelectOption,
} from "./SearchableSelect";
import WeeklyCalendarView from "./WeeklyCalendarView";
import { appointmentService } from "../services/appointmentService";
import { availabilityService } from "../services/availabilityService";
import {
  patientLookupService,
  type PatientLookup,
} from "../services/patientLookupService";
import {
  serviceLookupService,
  type ServiceLookup,
} from "../services/serviceLookupService";
import type {
  AgendaBlock,
  Appointment,
  AppointmentStatus,
  Assistant,
  DayOfWeek,
  Doctor,
  StaffSchedule,
} from "../types/agenda.types";
import {
  addDays,
  addMonths,
  formatLongDate,
  formatMonthTitle,
  getStartOfWeek,
} from "../utils/calendarDateUtils";
import { agendaNotificationService } from "../services/agendaNotificationService";
import {
  agendaHistoryService,
  type CreateAgendaHistoryLogInput,
} from "../services/agendaHistoryService";


type CalendarViewMode = "month" | "week" | "doctorDay";

type AgendaLinkedUser = {
  uid: string;
  email?: string | null;
  status?: string;
  isAdmin?: boolean;
  doctorId?: string | null;
  assistantId?: string | null;
};

interface AppointmentManagerProps {
  doctors: Doctor[];
  assistants: Assistant[];
  refreshKey?: number;
}

const today = new Date().toISOString().slice(0, 10);

const emptyAppointmentForm: AppointmentFormState = {
  patientId: null,
  patientName: "",
  serviceId: null,
  serviceName: "",
  doctorId: "",
  assistantIds: [],
  startDate: today,
  startTime: "09:00",
  endTime: "09:30",
  reason: "",
  notes: "",
  appointmentType: "scheduled",
  arrivalTime: "",
  waitMinutes: null,
  walkInAssistantId: null,
};

const statusLabels: Record<AppointmentStatus, string> = {
  scheduled: "Programada",
  confirmed: "Confirmada",
  completed: "Atendida",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

const timeToMinutes = (time: string) => {
  const [hours = "0", minutes = "0"] = time.split(":");

  return Number(hours) * 60 + Number(minutes);
};



const getWaitMinutes = (arrivalTime: string, startTime: string) => {
  if (!arrivalTime || !startTime) return null;

  const diff = timeToMinutes(startTime) - timeToMinutes(arrivalTime);

  return diff > 0 ? diff : 0;
};

const rangesOverlap = (
  startA: string,
  endA: string,
  startB: string,
  endB: string,
) => {
  return (
    timeToMinutes(startA) < timeToMinutes(endB) &&
    timeToMinutes(endA) > timeToMinutes(startB)
  );
};

const getDayOfWeek = (date: string): DayOfWeek => {
  return new Date(`${date}T12:00:00`).getDay() as DayOfWeek;
};

const isDateWithinRange = (date: string, startDate: string, endDate: string) => {
  return date >= startDate && date <= endDate;
};

const AppointmentManager = ({
  doctors,
  assistants,
  refreshKey = 0,
}: AppointmentManagerProps) => {
  const { currentUser } = useAuth();
  const { can, loading: permissionsLoading } = useCan();
  const [searchParams, setSearchParams] = useSearchParams();

  const [agendaUser, setAgendaUser] = useState<AgendaLinkedUser | null>(null);
  const [agendaProfileLoading, setAgendaProfileLoading] = useState(true);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [schedules, setSchedules] = useState<StaffSchedule[]>([]);
  const [blocks, setBlocks] = useState<AgendaBlock[]>([]);
  const [patients, setPatients] = useState<PatientLookup[]>([]);
  const [services, setServices] = useState<ServiceLookup[]>([]);

  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [selectedDoctorId, setSelectedDoctorId] = useState("all");
  const [selectedAssistantId, setSelectedAssistantId] = useState("all");
  const [selectedStatus, setSelectedStatus] =
    useState<AppointmentStatus | "all">("all");

  const [selectedSlot, setSelectedSlot] =
    useState<CalendarSlotSelection | null>(null);
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [editingAppointment, setEditingAppointment] =
    useState<Appointment | null>(null);

  const [form, setForm] = useState<AppointmentFormState>({
    ...emptyAppointmentForm,
  });

  const [slotActionDialogOpen, setSlotActionDialogOpen] = useState(false);
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [appointmentDetailsOpen, setAppointmentDetailsOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { confirm, confirmationDialog } = useConfirmAction();

  const canCreateAppointment = can("agenda.appointments.create");
  const canUpdateAppointment = can("agenda.appointments.update");
  const canCancelAppointment = can("agenda.appointments.cancel");

  const canCreateBlock = can("agenda.blocks.create");

  const canViewAllDoctors =
    agendaUser?.isAdmin === true ||
    can("agenda.doctors.viewAll") ||
    can("agenda.doctors.manage") ||
    can("agenda.assistants.manage");

    const createAgendaHistoryLog = async (
      input: Omit<CreateAgendaHistoryLogInput, "createdBy" | "createdByEmail">,
    ) => {
      try {
        await agendaHistoryService.createLog({
          ...input,
          createdBy: currentUser?.uid ?? agendaUser?.uid ?? null,
          createdByEmail: currentUser?.email ?? agendaUser?.email ?? null,
        });
      } catch (error) {
        console.warn("No se pudo registrar historial de agenda.", error);
      }
    };

    useEffect(() => {
  let cancelled = false;

  const loadAgendaUserProfile = async () => {
    if (!currentUser?.uid) {
      setAgendaUser(null);
      setAgendaProfileLoading(false);
      return;
    }

    setAgendaProfileLoading(true);

    try {
      const userRef = doc(db, "usuarios", currentUser.uid);
      const userSnapshot = await getDoc(userRef);
      const data = userSnapshot.data();

      if (cancelled) return;

      setAgendaUser({
        uid: currentUser.uid,
        email: currentUser.email,
        status: typeof data?.status === "string" ? data.status : "",
        isAdmin: data?.isAdmin === true,
        doctorId:
          typeof data?.doctorId === "string" && data.doctorId.trim()
            ? data.doctorId
            : null,
        assistantId:
          typeof data?.assistantId === "string" && data.assistantId.trim()
            ? data.assistantId
            : null,
      });
    } catch (error) {
      console.error(error);

      if (!cancelled) {
        setAgendaUser({
          uid: currentUser.uid,
          email: currentUser.email,
          status: "",
          isAdmin: false,
          doctorId: null,
          assistantId: null,
        });
      }
    } finally {
      if (!cancelled) {
        setAgendaProfileLoading(false);
      }
    }
  };

  void loadAgendaUserProfile();

  return () => {
    cancelled = true;
  };
}, [currentUser?.email, currentUser?.uid]);

  const activeDoctors = useMemo(() => {
    return doctors.filter((doctor) => doctor.status === "active");
  }, [doctors]);

  const activeAssistants = useMemo(() => {
    return assistants.filter((assistant) => assistant.status === "active");
  }, [assistants]);

  const visibleDoctors = useMemo(() => {
    if (canViewAllDoctors) {
      return activeDoctors;
    }

    const allowedDoctorIds = new Set<string>();

    const linkedDoctorId =
      agendaUser?.doctorId ||
      activeDoctors.find((doctor) => doctor.userUid === currentUser?.uid)?.id;

    const linkedAssistantId =
      agendaUser?.assistantId ||
      activeAssistants.find(
        (assistant) => assistant.userUid === currentUser?.uid,
      )?.id;

    if (linkedDoctorId) {
      allowedDoctorIds.add(linkedDoctorId);
    }

    if (linkedAssistantId) {
      const linkedAssistant = activeAssistants.find(
        (assistant) => assistant.id === linkedAssistantId,
      );

      if (linkedAssistant && linkedAssistant.doctorIdsAsignados.length === 0) {
        return activeDoctors;
      }

      linkedAssistant?.doctorIdsAsignados.forEach((doctorId) => {
        allowedDoctorIds.add(doctorId);
      });
    }

    return activeDoctors.filter((doctor) => allowedDoctorIds.has(doctor.id));
  }, [
    activeAssistants,
    activeDoctors,
    agendaUser?.assistantId,
    agendaUser?.doctorId,
    canViewAllDoctors,
    currentUser?.uid,
  ]);

  const visibleDoctorIds = useMemo(() => {
    return new Set(visibleDoctors.map((doctor) => doctor.id));
  }, [visibleDoctors]);

  const canSelectAllVisibleDoctors =
    canViewAllDoctors || visibleDoctors.length > 1;

  const visibleAssistants = useMemo(() => {
    if (canViewAllDoctors) {
      return activeAssistants;
    }

    if (agendaUser?.assistantId) {
      return activeAssistants.filter(
        (assistant) => assistant.id === agendaUser.assistantId,
      );
    }

    return activeAssistants.filter((assistant) => {
      if (assistant.doctorIdsAsignados.length === 0) {
        return true;
      }

      return assistant.doctorIdsAsignados.some((doctorId) =>
        visibleDoctorIds.has(doctorId),
      );
    });
  }, [
    activeAssistants,
    agendaUser?.assistantId,
    canViewAllDoctors,
    visibleDoctorIds,
  ]);

  const visibleAssistantIds = useMemo(() => {
    return new Set(visibleAssistants.map((assistant) => assistant.id));
  }, [visibleAssistants]);

  useEffect(() => {
    if (visibleDoctors.length === 0) return;

    const selectedDoctorIsValid =
      selectedDoctorId === "all"
        ? canSelectAllVisibleDoctors
        : visibleDoctorIds.has(selectedDoctorId);

    if (selectedDoctorIsValid) return;

    setSelectedDoctorId(
      canSelectAllVisibleDoctors ? "all" : visibleDoctors[0].id,
    );
  }, [
    canSelectAllVisibleDoctors,
    selectedDoctorId,
    visibleDoctorIds,
    visibleDoctors,
  ]);

  useEffect(() => {
    if (selectedAssistantId === "all") return;

    const selectedAssistantIsValid = visibleAssistantIds.has(
      selectedAssistantId,
    );

    if (selectedAssistantIsValid) return;

    setSelectedAssistantId("all");
  }, [selectedAssistantId, visibleAssistantIds]);

  const doctorsById = useMemo(() => {
    return new Map(doctors.map((doctor) => [doctor.id, doctor]));
  }, [doctors]);

  const assistantsById = useMemo(() => {
    return new Map(
      assistants.map((assistant) => [assistant.id, assistant]),
    );
  }, [assistants]);

  const doctorFilterOptions = useMemo<SearchableSelectOption[]>(() => {
    const options = visibleDoctors.map((doctor) => ({
      value: doctor.id,
      label: doctor.nombre,
      description: doctor.especialidad || "Sin especialidad",
      searchText: [
        doctor.nombre,
        doctor.email ?? "",
        doctor.telefono ?? "",
        doctor.especialidad ?? "",
      ].join(" "),
    }));

    if (!canSelectAllVisibleDoctors) {
      return options;
    }

    return [
      {
        value: "all",
        label: "Todos los doctores visibles",
        description: canViewAllDoctors
          ? "Ver agenda completa"
          : "Ver doctores asignados",
        searchText: "todos doctores agenda completa asignados",
      },
      ...options,
    ];
  }, [canSelectAllVisibleDoctors, canViewAllDoctors, visibleDoctors]);

  const assistantFilterOptions = useMemo<SearchableSelectOption[]>(() => {
    return [
      {
        value: "all",
        label: "Todos los asistentes visibles",
        description: "Sin filtrar por asistente",
        searchText: "todos asistentes visibles",
      },
      ...visibleAssistants.map((assistant) => ({
        value: assistant.id,
        label: assistant.nombre,
        description:
          assistant.doctorIdsAsignados.length > 0
            ? `${assistant.doctorIdsAsignados.length} doctor(es) asignado(s)`
            : "Sin doctores asignados",
        searchText: [
          assistant.nombre,
          assistant.email ?? "",
          assistant.telefono ?? "",
          assistant.notas ?? "",
        ].join(" "),
      })),
    ];
  }, [visibleAssistants]);

  const selectedSlotDoctor = selectedSlot
    ? doctorsById.get(selectedSlot.doctorId)
    : undefined;

  const selectedAppointmentDoctor = selectedAppointment
    ? doctorsById.get(selectedAppointment.doctorId)?.nombre ??
      "Doctor no encontrado"
    : "";

  const selectedAppointmentAssistantNames = selectedAppointment
    ? selectedAppointment.assistantIds
        .map((assistantId) => assistantsById.get(assistantId)?.nombre)
        .filter((name): name is string => Boolean(name))
    : [];

  const selectedAppointmentWalkInAssistantName =
  selectedAppointment?.walkInAssistantId
    ? assistantsById.get(selectedAppointment.walkInAssistantId)?.nombre ?? ""
    : "";

  const filteredAppointments = useMemo(() => {
    return appointments.filter((appointment) => {
      if (!visibleDoctorIds.has(appointment.doctorId)) {
        return false;
      }

      const matchesDoctor =
        selectedDoctorId === "all" ||
        appointment.doctorId === selectedDoctorId;

      const matchesAssistant =
        selectedAssistantId === "all" ||
        appointment.assistantIds.includes(selectedAssistantId);

      const matchesStatus =
        selectedStatus === "all" || appointment.status === selectedStatus;

      return matchesDoctor && matchesAssistant && matchesStatus;
    });
  }, [
    appointments,
    selectedAssistantId,
    selectedDoctorId,
    selectedStatus,
    visibleDoctorIds,
  ]);

  const scopedBlocks = useMemo(() => {
    return blocks.filter((block) => {
      if (block.staffType === "doctor") {
        return visibleDoctorIds.has(block.staffId);
      }

      if (block.staffType === "assistant") {
        if (selectedAssistantId !== "all") {
          return block.staffId === selectedAssistantId;
        }

        return visibleAssistantIds.has(block.staffId);
      }

      return false;
    });
  }, [blocks, selectedAssistantId, visibleAssistantIds, visibleDoctorIds]);

  const dayAppointments = useMemo(() => {
    return filteredAppointments.filter(
      (appointment) => appointment.startDate === selectedDate,
    );
  }, [filteredAppointments, selectedDate]);

  const daySummary = useMemo(() => {
    const walkIns = dayAppointments.filter(
      (appointment) => appointment.appointmentType === "walk_in",
    ).length;

    const scheduledAppointments = dayAppointments.filter(
      (appointment) => appointment.appointmentType !== "walk_in",
    ).length;

    const completed = dayAppointments.filter(
      (appointment) => appointment.status === "completed",
    ).length;

    const cancelled = dayAppointments.filter(
      (appointment) => appointment.status === "cancelled",
    ).length;

    return {
      total: dayAppointments.length,
      scheduledAppointments,
      walkIns,
      completed,
      cancelled,
    };
  }, [dayAppointments]);

  const calendarTitle = useMemo(() => {
    if (viewMode === "month") {
      return formatMonthTitle(selectedDate);
    }

    if (viewMode === "week") {
      const startOfWeek = getStartOfWeek(selectedDate);
      const endOfWeek = addDays(startOfWeek, 6);

      return `${formatLongDate(startOfWeek)} - ${formatLongDate(endOfWeek)}`;
    }

    return formatLongDate(selectedDate);
  }, [selectedDate, viewMode]);

  const loadAppointments = async () => {
    setLoading(true);

    try {
      const [
        appointmentsData,
        schedulesData,
        blocksData,
        patientsData,
        servicesData,
      ] = await Promise.all([
        appointmentService.listAppointments(),
        availabilityService.listSchedules(),
        availabilityService.listBlocks(),
        canCreateAppointment || canUpdateAppointment ? patientLookupService.listPatients() : Promise.resolve([]),
        canCreateAppointment || canUpdateAppointment ? serviceLookupService.listServices() : Promise.resolve([]),
      ]);

      setAppointments(appointmentsData);
      setSchedules(schedulesData);
      setBlocks(blocksData);
      setPatients(patientsData);
      setServices(servicesData);
    } catch (error) {
      console.error(error);
      toast.error("No se pudieron cargar las citas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAppointments();
  }, [refreshKey, canCreateAppointment, canUpdateAppointment]);

  const updateSelectedDate = (date: string) => {
    setSelectedDate(date);

    setForm((current) => ({
      ...current,
      startDate: date,
    }));
  };

  const goToToday = () => {
    const nextToday = new Date().toISOString().slice(0, 10);
    updateSelectedDate(nextToday);
  };

  const goToPreviousPeriod = () => {
    const nextDate =
      viewMode === "month"
        ? addMonths(selectedDate, -1)
        : viewMode === "week"
          ? addDays(selectedDate, -7)
          : addDays(selectedDate, -1);

    updateSelectedDate(nextDate);
  };

  const goToNextPeriod = () => {
    const nextDate =
      viewMode === "month"
        ? addMonths(selectedDate, 1)
        : viewMode === "week"
          ? addDays(selectedDate, 7)
          : addDays(selectedDate, 1);

    updateSelectedDate(nextDate);
  };

  const handleSelectDateFromSummaryView = (date: string) => {
    updateSelectedDate(date);
    setViewMode("doctorDay");
  };

  const getDefaultDoctorId = () => {
    if (selectedDoctorId !== "all") {
      return selectedDoctorId;
    }

    if (visibleDoctors.length === 1) {
      return visibleDoctors[0].id;
    }

    return "";
  };


  const getNormalizedAssistantIds = (
    targetForm: AppointmentFormState = form,
  ): string[] => {
    const assistantIds = new Set<string>(targetForm.assistantIds);

    if (
      targetForm.appointmentType === "walk_in" &&
      targetForm.walkInAssistantId
    ) {
      assistantIds.add(targetForm.walkInAssistantId);
    }

    return Array.from(assistantIds);
  };

  const resetForm = (date = selectedDate) => {
    setForm({
      ...emptyAppointmentForm,
      startDate: date,
      doctorId: getDefaultDoctorId(),
      assistantIds: [],
      appointmentType: "scheduled",
      arrivalTime: "",
      waitMinutes: null,
      walkInAssistantId: null,
    });
  };

  const handleAppointmentDialogOpenChange = (open: boolean) => {
    setAppointmentDialogOpen(open);

    if (!open) {
      setEditingAppointment(null);
    }
  };

  const handleAppointmentDetailsOpenChange = (open: boolean) => {
    setAppointmentDetailsOpen(open);

    if (!open) {
      setSelectedAppointment(null);
    }
  };

  const openManualAppointmentDialog = () => {
    if (!canCreateAppointment) return;
    setSelectedSlot(null);
    setEditingAppointment(null);

    setForm({
      ...emptyAppointmentForm,
      startDate: selectedDate,
      doctorId: getDefaultDoctorId(),
      assistantIds: [],
      appointmentType: "scheduled",
      arrivalTime: "",
      waitMinutes: null,
      walkInAssistantId: null,
    });

    setAppointmentDialogOpen(true);
  };

  useEffect(() => {
    if (searchParams.get("action") !== "newAppointment") return;
    if (permissionsLoading) return;

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("action");
    setSearchParams(nextSearchParams, { replace: true });

    if (canCreateAppointment) openManualAppointmentDialog();
    // La acción se consume una sola vez; el formulario conserva sus valores predeterminados actuales.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canCreateAppointment, permissionsLoading, searchParams, setSearchParams]);

  const handleSelectCalendarSlot = (slot: CalendarSlotSelection) => {
    updateSelectedDate(slot.startDate);
    setSelectedSlot(slot);
    setSlotActionDialogOpen(true);
  };

  const openAppointmentFromSelectedSlot = () => {
    if (!selectedSlot) return;

    setEditingAppointment(null);

    setForm({
      ...emptyAppointmentForm,
      doctorId: selectedSlot.doctorId,
      startDate: selectedSlot.startDate,
      startTime: selectedSlot.startTime,
      endTime: selectedSlot.endTime,
      assistantIds: [],
      appointmentType: "scheduled",
      arrivalTime: "",
      waitMinutes: null,
      walkInAssistantId: null,
    });

    setSlotActionDialogOpen(false);
    setAppointmentDialogOpen(true);
  };

  const openBlockFromSelectedSlot = () => {
    if (!selectedSlot) return;

    setSlotActionDialogOpen(false);
    setBlockDialogOpen(true);
  };

  const openAppointmentDetails = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setAppointmentDetailsOpen(true);
  };

  const openEditAppointment = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setSelectedAppointment(null);
    setSelectedSlot(null);
    setAppointmentDetailsOpen(false);

    setForm({
      patientId: appointment.patientId ?? null,
      patientName: appointment.patientName,
      serviceId: appointment.serviceId ?? null,
      serviceName: appointment.serviceName,
      doctorId: appointment.doctorId,
      assistantIds: appointment.assistantIds,
      startDate: appointment.startDate,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      reason: appointment.reason,
      notes: appointment.notes ?? "",
      appointmentType: appointment.appointmentType ?? "scheduled",
      arrivalTime: appointment.arrivalTime ?? "",
      waitMinutes: appointment.waitMinutes ?? null,
      walkInAssistantId: appointment.walkInAssistantId ?? null,
    });

    setAppointmentDialogOpen(true);
  };

  const getDoctorSchedulesForDate = (doctorId: string, date: string) => {
    const dayOfWeek = getDayOfWeek(date);

    const doctorSchedules = schedules.filter((schedule) => {
      return (
        schedule.status === "active" &&
        schedule.staffType === "doctor" &&
        schedule.staffId === doctorId
      );
    });

    const specialSchedules = doctorSchedules.filter((schedule) => {
      const isSpecialSchedule =
        schedule.scheduleType === "special" || Boolean(schedule.date);

      return isSpecialSchedule && schedule.date === date;
    });

    if (specialSchedules.length > 0) {
      return specialSchedules;
    }

    return doctorSchedules.filter((schedule) => {
      const isWeeklySchedule =
        !schedule.date && (schedule.scheduleType ?? "weekly") === "weekly";

      return isWeeklySchedule && schedule.dayOfWeek === dayOfWeek;
    });
  };

  const doctorHasSchedule = (
    doctorId: string,
    date: string,
    startTime: string,
    endTime: string,
  ) => {
    const schedulesForDate = getDoctorSchedulesForDate(doctorId, date);

    return schedulesForDate.some((schedule) => {
      return schedule.startTime <= startTime && schedule.endTime >= endTime;
    });
  };

  const hasActiveBlock = (
    staffType: "doctor" | "assistant",
    staffId: string,
    date: string,
    startTime: string,
    endTime: string,
  ) => {
    return blocks.some((block) => {
      if (block.status !== "active") return false;
      if (block.staffType !== staffType) return false;
      if (block.staffId !== staffId) return false;
      if (!isDateWithinRange(date, block.startDate, block.endDate)) {
        return false;
      }

      if (block.allDay) return true;

      return rangesOverlap(startTime, endTime, block.startTime, block.endTime);
    });
  };

  const hasDoctorConflict = (
    doctorId: string,
    date: string,
    startTime: string,
    endTime: string,
    ignoreAppointmentId?: string,
  ) => {
    return appointments.some((appointment) => {
      if (appointment.id === ignoreAppointmentId) return false;
      if (appointment.status === "cancelled") return false;
      if (appointment.status === "no_show") return false;
      if (appointment.doctorId !== doctorId) return false;
      if (appointment.startDate !== date) return false;

      return rangesOverlap(
        startTime,
        endTime,
        appointment.startTime,
        appointment.endTime,
      );
    });
  };

  const hasAssistantConflict = (
    assistantId: string,
    date: string,
    startTime: string,
    endTime: string,
    ignoreAppointmentId?: string,
  ) => {
    return appointments.some((appointment) => {
      if (appointment.id === ignoreAppointmentId) return false;
      if (appointment.status === "cancelled") return false;
      if (appointment.status === "no_show") return false;
      if (!appointment.assistantIds.includes(assistantId)) return false;
      if (appointment.startDate !== date) return false;

      return rangesOverlap(
        startTime,
        endTime,
        appointment.startTime,
        appointment.endTime,
      );
    });
  };

  const validateAppointment = (ignoreAppointmentId?: string) => {
    const patientName = form.patientName.trim();
    const serviceName = form.serviceName.trim();

    if (!patientName) {
      toast.error("Escribe el nombre del paciente.");
      return false;
    }

    if (!serviceName && !(form.appointmentType === "walk_in" && form.reason.trim())) {
      toast.error(
        form.appointmentType === "walk_in"
          ? "Escribe el servicio o motivo de la atención sin cita."
          : "Selecciona o escribe el servicio a realizar.",
      );
      return false;
    }

    if (!form.doctorId) {
      toast.error("Selecciona un doctor.");
      return false;
    }

    if (!visibleDoctorIds.has(form.doctorId)) {
      toast.error("No tienes acceso a la agenda de ese doctor.");
      return false;
    }

    if (!form.startDate) {
      toast.error("Selecciona la fecha de la cita.");
      return false;
    }

    if (form.appointmentType === "walk_in") {
      if (form.startDate !== today) {
        toast.error("Las atenciones sin cita solo se registran para el día actual.");
        return false;
      }

      if (!form.arrivalTime) {
        toast.error("Selecciona la hora de llegada del paciente.");
        return false;
      }

      if (!form.walkInAssistantId) {
        toast.error("Selecciona al responsable de la atención.");
        return false;
      }

      if (!visibleAssistantIds.has(form.walkInAssistantId)) {
        toast.error("No tienes acceso al asistente seleccionado.");
        return false;
      }
    }

    if (form.startTime >= form.endTime) {
      toast.error("La hora de inicio debe ser menor que la hora de fin.");
      return false;
    }

    if (
      !doctorHasSchedule(
        form.doctorId,
        form.startDate,
        form.startTime,
        form.endTime,
      )
    ) {
      toast.error("El doctor no tiene horario disponible en ese rango.");
      return false;
    }

    if (
      hasActiveBlock(
        "doctor",
        form.doctorId,
        form.startDate,
        form.startTime,
        form.endTime,
      )
    ) {
      toast.error("El doctor tiene un bloqueo en ese horario.");
      return false;
    }

    if (
      hasDoctorConflict(
        form.doctorId,
        form.startDate,
        form.startTime,
        form.endTime,
        ignoreAppointmentId,
      )
    ) {
      toast.error("El doctor ya tiene una cita en ese horario.");
      return false;
    }

    const assistantIdsToValidate = getNormalizedAssistantIds();

    const blockedAssistant = assistantIdsToValidate.find((assistantId) =>
      hasActiveBlock(
        "assistant",
        assistantId,
        form.startDate,
        form.startTime,
        form.endTime,
      ),
    );

    if (blockedAssistant) {
      const assistantName =
        assistantsById.get(blockedAssistant)?.nombre ?? "El asistente";
      toast.error(`${assistantName} tiene un bloqueo en ese horario.`);
      return false;
    }

    const busyAssistant = assistantIdsToValidate.find((assistantId) =>
      hasAssistantConflict(
        assistantId,
        form.startDate,
        form.startTime,
        form.endTime,
        ignoreAppointmentId,
      ),
    );

    if (busyAssistant) {
      const assistantName =
        assistantsById.get(busyAssistant)?.nombre ?? "El asistente";
      toast.error(`${assistantName} ya tiene una cita en ese horario.`);
      return false;
    }

    return true;
  };

  const handleCreateAppointment = async () => {
    if (!canCreateAppointment) {
      toast.error("No tienes permiso para crear citas.");
      return;
    }

    if (!validateAppointment()) return;

    setSaving(true);

    try {
      const appointmentType = form.appointmentType ?? "scheduled";
      const normalizedAssistantIds = getNormalizedAssistantIds();
      const waitMinutes =
        appointmentType === "walk_in"
          ? getWaitMinutes(form.arrivalTime, form.startTime)
          : null;

      const appointmentId = await appointmentService.createAppointment({
        patientId: form.patientId,
        patientName: form.patientName.trim(),
        serviceId: form.serviceId,
        serviceName: form.serviceName.trim(),
        doctorId: form.doctorId,
        assistantIds: normalizedAssistantIds,
        startDate: form.startDate,
        startTime: form.startTime,
        endTime: form.endTime,
        reason: form.reason.trim(),
        notes: form.notes.trim(),
        status: "scheduled",
        appointmentType,
        arrivalTime: appointmentType === "walk_in" ? form.arrivalTime : null,
        waitMinutes,
        walkInAssistantId:
          appointmentType === "walk_in" ? form.walkInAssistantId : null,
        createdBy: agendaUser?.uid ?? null,
        updatedBy: agendaUser?.uid ?? null,
      });

      const createdAppointmentId =
        typeof appointmentId === "string" ? appointmentId : "";

      await agendaNotificationService.createForDoctor({
        targetDoctorId: form.doctorId,
        type: "appointment_created",
        title:
          appointmentType === "walk_in"
            ? "Atención sin cita registrada"
            : "Nueva cita agendada",
        message: `${form.patientName.trim()} · ${
          form.serviceName.trim() || form.reason.trim() || "Cita"
        }`,
        entityType: "appointment",
        entityId: createdAppointmentId,
        appointmentId: createdAppointmentId,
        startDate: form.startDate,
        startTime: form.startTime,
        endTime: form.endTime,
        createdBy: currentUser?.uid ?? null,
      });

      await createAgendaHistoryLog({
        action: "appointment_created",
        entityType: "appointment",
        entityId: createdAppointmentId,
        doctorId: form.doctorId,
        patientId: form.patientId,
        patientName: form.patientName.trim(),
        title:
          appointmentType === "walk_in"
            ? "Atención sin cita registrada"
            : "Cita creada",
        description: `${form.patientName.trim()} · ${
          form.serviceName.trim() || form.reason.trim() || "Cita"
        }`,
        date: form.startDate,
        startTime: form.startTime,
        endTime: form.endTime,
        before: null,
        after: {
          patientId: form.patientId,
          patientName: form.patientName.trim(),
          serviceId: form.serviceId,
          serviceName: form.serviceName.trim(),
          doctorId: form.doctorId,
          assistantIds: normalizedAssistantIds,
          startDate: form.startDate,
          startTime: form.startTime,
          endTime: form.endTime,
          reason: form.reason.trim(),
          notes: form.notes.trim(),
          status: "scheduled",
          appointmentType,
          arrivalTime: appointmentType === "walk_in" ? form.arrivalTime : null,
          waitMinutes,
          walkInAssistantId:
            appointmentType === "walk_in" ? form.walkInAssistantId : null,
        },
      });

      toast.success("Cita creada correctamente.");
      updateSelectedDate(form.startDate);
      setAppointmentDialogOpen(false);
      resetForm(form.startDate);
      await loadAppointments();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo crear la cita.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateAppointment = async () => {
    if (!editingAppointment) return;

    if (!canUpdateAppointment) {
      toast.error("No tienes permiso para editar citas.");
      return;
    }

    if (!validateAppointment(editingAppointment.id)) return;

    const previousAppointment = editingAppointment;

    const nextPatientName = form.patientName.trim();
    const nextServiceName = form.serviceName.trim();
    const nextReason = form.reason.trim();
    const nextNotes = form.notes.trim();
    const nextAppointmentType = form.appointmentType ?? "scheduled";
    const nextWaitMinutes =
      nextAppointmentType === "walk_in"
        ? getWaitMinutes(form.arrivalTime, form.startTime)
        : null;
    const nextWalkInAssistantId =
      nextAppointmentType === "walk_in" ? form.walkInAssistantId : null;
    const nextAssistantIds = getNormalizedAssistantIds();

    const previousDoctorName =
      doctorsById.get(previousAppointment.doctorId)?.nombre ??
      "Doctor anterior";

    const nextDoctorName =
      doctorsById.get(form.doctorId)?.nombre ?? "Doctor nuevo";

    const changes: string[] = [];

    if (previousAppointment.doctorId !== form.doctorId) {
      changes.push(`Doctor: ${previousDoctorName} → ${nextDoctorName}`);
    }

    if ((previousAppointment.appointmentType ?? "scheduled") !== nextAppointmentType) {
      changes.push(
        nextAppointmentType === "walk_in"
          ? "Tipo: cita programada → sin cita"
          : "Tipo: sin cita → cita programada",
      );
    }

    if (previousAppointment.patientName !== nextPatientName) {
      changes.push(
        `Paciente: ${previousAppointment.patientName} → ${nextPatientName}`,
      );
    }

    if (previousAppointment.serviceName !== nextServiceName) {
      changes.push(
        `Servicio: ${previousAppointment.serviceName || "Sin servicio"} → ${
          nextServiceName || "Sin servicio"
        }`,
      );
    }

    if (previousAppointment.startDate !== form.startDate) {
      changes.push(`Fecha: ${previousAppointment.startDate} → ${form.startDate}`);
    }

    if (
      previousAppointment.startTime !== form.startTime ||
      previousAppointment.endTime !== form.endTime
    ) {
      changes.push(
        `Horario: ${previousAppointment.startTime} - ${previousAppointment.endTime} → ${form.startTime} - ${form.endTime}`,
      );
    }

    if ((previousAppointment.reason ?? "") !== nextReason) {
      changes.push("Motivo actualizado");
    }

    if ((previousAppointment.notes ?? "") !== nextNotes) {
      changes.push("Notas actualizadas");
    }

    if ((previousAppointment.arrivalTime ?? "") !== form.arrivalTime) {
      changes.push("Hora de llegada actualizada");
    }

    if ((previousAppointment.waitMinutes ?? null) !== nextWaitMinutes) {
      changes.push("Tiempo de espera actualizado");
    }

    if ((previousAppointment.walkInAssistantId ?? null) !== nextWalkInAssistantId) {
      changes.push("Responsable de atención actualizado");
    }

    const updateMessage =
      changes.length > 0
        ? changes.join(" · ")
        : `Se actualizaron datos de la cita de ${nextPatientName}.`;

    setSaving(true);

    try {
      await appointmentService.updateAppointment(previousAppointment.id, {
        patientId: form.patientId,
        patientName: nextPatientName,
        serviceId: form.serviceId,
        serviceName: nextServiceName,
        doctorId: form.doctorId,
        assistantIds: nextAssistantIds,
        startDate: form.startDate,
        startTime: form.startTime,
        endTime: form.endTime,
        reason: nextReason,
        notes: nextNotes,
        appointmentType: nextAppointmentType,
        arrivalTime:
          nextAppointmentType === "walk_in" ? form.arrivalTime : null,
        waitMinutes: nextWaitMinutes,
        walkInAssistantId: nextWalkInAssistantId,
        updatedBy: agendaUser?.uid ?? null,
      });

      if (previousAppointment.doctorId !== form.doctorId) {
        await agendaNotificationService.createForDoctor({
          targetDoctorId: previousAppointment.doctorId,
          type: "appointment_updated",
          title: "Cita reasignada fuera de tu agenda",
          message: `La cita de ${previousAppointment.patientName} fue reasignada a ${nextDoctorName}. ${updateMessage}`,
          entityType: "appointment",
          entityId: previousAppointment.id,
          appointmentId: previousAppointment.id,
          startDate: previousAppointment.startDate,
          startTime: previousAppointment.startTime,
          endTime: previousAppointment.endTime,
          createdBy: currentUser?.uid ?? null,
        });

        await agendaNotificationService.createForDoctor({
          targetDoctorId: form.doctorId,
          type: "appointment_updated",
          title: "Cita asignada a tu agenda",
          message: `${nextPatientName} · ${updateMessage}`,
          entityType: "appointment",
          entityId: previousAppointment.id,
          appointmentId: previousAppointment.id,
          startDate: form.startDate,
          startTime: form.startTime,
          endTime: form.endTime,
          createdBy: currentUser?.uid ?? null,
        });
      } else {
        await agendaNotificationService.createForDoctor({
          targetDoctorId: form.doctorId,
          type: "appointment_updated",
          title: "Cita modificada",
          message: `${nextPatientName} · ${updateMessage}`,
          entityType: "appointment",
          entityId: previousAppointment.id,
          appointmentId: previousAppointment.id,
          startDate: form.startDate,
          startTime: form.startTime,
          endTime: form.endTime,
          createdBy: currentUser?.uid ?? null,
        });
      }

      await createAgendaHistoryLog({
        action: "appointment_updated",
        entityType: "appointment",
        entityId: previousAppointment.id,
        doctorId: form.doctorId,
        patientId: form.patientId,
        patientName: nextPatientName,
        title:
          previousAppointment.doctorId !== form.doctorId
            ? "Cita reasignada"
            : "Cita modificada",
        description: updateMessage,
        date: form.startDate,
        startTime: form.startTime,
        endTime: form.endTime,
        before: {
          patientId: previousAppointment.patientId,
          patientName: previousAppointment.patientName,
          serviceId: previousAppointment.serviceId,
          serviceName: previousAppointment.serviceName,
          doctorId: previousAppointment.doctorId,
          assistantIds: previousAppointment.assistantIds,
          startDate: previousAppointment.startDate,
          startTime: previousAppointment.startTime,
          endTime: previousAppointment.endTime,
          reason: previousAppointment.reason,
          notes: previousAppointment.notes ?? "",
          status: previousAppointment.status,
          appointmentType: previousAppointment.appointmentType ?? "scheduled",
          arrivalTime: previousAppointment.arrivalTime ?? null,
          waitMinutes: previousAppointment.waitMinutes ?? null,
          walkInAssistantId: previousAppointment.walkInAssistantId ?? null,
        },
        after: {
          patientId: form.patientId,
          patientName: nextPatientName,
          serviceId: form.serviceId,
          serviceName: nextServiceName,
          doctorId: form.doctorId,
          assistantIds: nextAssistantIds,
          startDate: form.startDate,
          startTime: form.startTime,
          endTime: form.endTime,
          reason: nextReason,
          notes: nextNotes,
          status: previousAppointment.status,
          appointmentType: nextAppointmentType,
          arrivalTime:
            nextAppointmentType === "walk_in" ? form.arrivalTime : null,
          waitMinutes: nextWaitMinutes,
          walkInAssistantId: nextWalkInAssistantId,
        },
      });

      toast.success("Cita actualizada correctamente.");
      updateSelectedDate(form.startDate);
      setAppointmentDialogOpen(false);
      setEditingAppointment(null);
      resetForm(form.startDate);
      await loadAppointments();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo actualizar la cita.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitAppointment = async () => {
    if (editingAppointment) {
      await handleUpdateAppointment();
      return;
    }

    await handleCreateAppointment();
  };

  const handleCreateBlock = async (blockForm: AgendaBlockFormState) => {
    if (!selectedSlot) return;

    if (!canCreateBlock) {
      toast.error("No tienes permiso para crear bloqueos.");
      return;
    }

    if (!blockForm.reason.trim()) {
      toast.error("Escribe el motivo del bloqueo.");
      return;
    }

    if (!blockForm.allDay && blockForm.startTime >= blockForm.endTime) {
      toast.error("La hora inicial debe ser menor que la hora final.");
      return;
    }

    setSaving(true);

    try {
      const blockId = await availabilityService.createBlock({
        staffType: "doctor",
        staffId: selectedSlot.doctorId,
        startDate: selectedSlot.startDate,
        endDate: selectedSlot.startDate,
        startTime: blockForm.allDay ? "00:00" : blockForm.startTime,
        endTime: blockForm.allDay ? "23:59" : blockForm.endTime,
        allDay: blockForm.allDay,
        reason: blockForm.reason.trim(),
        notes: blockForm.notes.trim(),
        status: "active",
        createdBy: agendaUser?.uid ?? null,
        updatedBy: agendaUser?.uid ?? null,
      });

      const createdBlockId = typeof blockId === "string" ? blockId : "";

      await agendaNotificationService.createForDoctor({
        targetDoctorId: selectedSlot.doctorId,
        type: "block_created",
        title: "Nuevo bloqueo en tu agenda",
        message: blockForm.reason.trim(),
        entityType: "block",
        entityId: createdBlockId,
        blockId: createdBlockId,
        startDate: selectedSlot.startDate,
        startTime: blockForm.allDay ? "00:00" : blockForm.startTime,
        endTime: blockForm.allDay ? "23:59" : blockForm.endTime,
        createdBy: currentUser?.uid ?? null,
      });

      await createAgendaHistoryLog({
        action: "block_created",
        entityType: "block",
        entityId: createdBlockId,
        doctorId: selectedSlot.doctorId,
        patientId: null,
        patientName: null,
        title: "Bloqueo creado",
        description: blockForm.reason.trim(),
        date: selectedSlot.startDate,
        startTime: blockForm.allDay ? "00:00" : blockForm.startTime,
        endTime: blockForm.allDay ? "23:59" : blockForm.endTime,
        before: null,
        after: {
          staffType: "doctor",
          staffId: selectedSlot.doctorId,
          startDate: selectedSlot.startDate,
          endDate: selectedSlot.startDate,
          startTime: blockForm.allDay ? "00:00" : blockForm.startTime,
          endTime: blockForm.allDay ? "23:59" : blockForm.endTime,
          allDay: blockForm.allDay,
          reason: blockForm.reason.trim(),
          notes: blockForm.notes.trim(),
          status: "active",
        },
      });

      toast.success("Horario bloqueado correctamente.");
      updateSelectedDate(selectedSlot.startDate);
      setBlockDialogOpen(false);
      await loadAppointments();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo crear el bloqueo.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangeStatus = async (
    appointment: Appointment,
    status: AppointmentStatus,
  ): Promise<boolean> => {
    if (!visibleDoctorIds.has(appointment.doctorId)) {
      toast.error("No tienes acceso a esta cita.");
      return false;
    }

    if (status === "cancelled" && !canCancelAppointment) {
      toast.error("No tienes permiso para cancelar citas.");
      return false;
    }

    if (status !== "cancelled" && !canUpdateAppointment) {
      toast.error("No tienes permiso para actualizar citas.");
      return false;
    }

    const confirmed = await confirm({
      title: "Cambiar estado de la cita",
      description: `${appointment.patientName} cambiará a estado ${statusLabels[status].toLowerCase()}.`,
      confirmLabel: "Cambiar estado",
      destructive: status === "cancelled",
    });

    if (!confirmed) return false;

    setSaving(true);

    try {
      await appointmentService.updateAppointmentStatus(
        appointment.id,
        status,
        agendaUser?.uid,
      );

      await agendaNotificationService.createForDoctor({
        targetDoctorId: appointment.doctorId,
        type:
          status === "cancelled"
            ? "appointment_cancelled"
            : "appointment_status_changed",
        title:
          status === "cancelled"
            ? "Cita cancelada"
            : "Cambio de estado de cita",
        message: `${appointment.patientName} · ${statusLabels[status]}`,
        entityType: "appointment",
        entityId: appointment.id,
        appointmentId: appointment.id,
        startDate: appointment.startDate,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        createdBy: currentUser?.uid ?? null,
      });

      await createAgendaHistoryLog({
        action:
          status === "cancelled"
            ? "appointment_cancelled"
            : "appointment_status_changed",
        entityType: "appointment",
        entityId: appointment.id,
        doctorId: appointment.doctorId,
        patientId: appointment.patientId,
        patientName: appointment.patientName,
        title:
          status === "cancelled"
            ? "Cita cancelada"
            : "Estado de cita actualizado",
        description: `${appointment.patientName}: ${
          statusLabels[appointment.status]
        } → ${statusLabels[status]}`,
        date: appointment.startDate,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        before: {
          status: appointment.status,
        },
        after: {
          status,
        },
      });

      toast.success("Cita actualizada correctamente.");
      await loadAppointments();

      return true;
    } catch (error) {
      console.error(error);
      toast.error("No se pudo actualizar la cita.");

      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleChangeStatusFromDetails = async (
    appointment: Appointment,
    status: AppointmentStatus,
  ) => {
    const updated = await handleChangeStatus(appointment, status);

    if (!updated) return;

    setAppointmentDetailsOpen(false);
    setSelectedAppointment(null);
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-visible border bg-card shadow-sm">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-base font-semibold">Filtros del calendario</h2>

            <div className="flex flex-wrap gap-2">
              {canCreateAppointment && (
                <Button onClick={openManualAppointmentDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva cita
                </Button>
              )}

            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="agenda-date">Día</Label>
              <Input
                id="agenda-date"
                type="date"
                value={selectedDate}
                onChange={(event) => updateSelectedDate(event.target.value)}
              />
            </div>

            <div className="min-w-0 space-y-2">
              <Label htmlFor="agenda-doctor-filter">Doctor</Label>
              <SearchableSelect
                id="agenda-doctor-filter"
                options={doctorFilterOptions}
                value={selectedDoctorId}
                placeholder="Buscar doctor..."
                emptyMessage="No se encontraron doctores."
                disabled={!canSelectAllVisibleDoctors}
                onValueChange={(value) => setSelectedDoctorId(value || "all")}
              />
            </div>

            <div className="min-w-0 space-y-2">
              <Label htmlFor="agenda-assistant-filter">Asistente</Label>
              <SearchableSelect
                id="agenda-assistant-filter"
                options={assistantFilterOptions}
                value={selectedAssistantId}
                placeholder="Buscar asistente..."
                emptyMessage="No se encontraron asistentes."
                onValueChange={(value) =>
                  setSelectedAssistantId(value || "all")
                }
              />
            </div>

            <div className="min-w-0 space-y-2">
              <Label htmlFor="agenda-status-filter">Estado</Label>
              <Select
                value={selectedStatus}
                onValueChange={(value) => setSelectedStatus(value as AppointmentStatus | "all")}
              >
                <SelectTrigger id="agenda-status-filter"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="scheduled">Programadas</SelectItem>
                  <SelectItem value="confirmed">Confirmadas</SelectItem>
                  <SelectItem value="completed">Atendidas</SelectItem>
                  <SelectItem value="cancelled">Canceladas</SelectItem>
                  <SelectItem value="no_show">No asistió</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Calendario clínico
            </p>
            <h2 className="text-xl font-semibold capitalize leading-tight">
              {calendarTitle}
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={goToPreviousPeriod}>
              Anterior
            </Button>

            <Button variant="outline" size="sm" onClick={goToToday}>
              Hoy
            </Button>

            <Button variant="outline" size="sm" onClick={goToNextPeriod}>
              Siguiente
            </Button>

            <div className="flex rounded-lg border bg-muted/30 p-1">
              <Button
                type="button"
                size="sm"
                variant={viewMode === "month" ? "default" : "ghost"}
                onClick={() => setViewMode("month")}
              >
                Mes
              </Button>

              <Button
                type="button"
                size="sm"
                variant={viewMode === "week" ? "default" : "ghost"}
                onClick={() => setViewMode("week")}
              >
                Semana
              </Button>

              <Button
                type="button"
                size="sm"
                variant={viewMode === "doctorDay" ? "default" : "ghost"}
                onClick={() => setViewMode("doctorDay")}
              >
                Día
              </Button>
            </div>
          </div>
        </div>

        {agendaProfileLoading ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Cargando perfil de agenda
              </CardTitle>
              <CardDescription>
                Verificando calendarios visibles.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : visibleDoctors.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                No hay doctor vinculado
              </CardTitle>
              <CardDescription>
                Solicita la asignación de tu agenda para consultar el calendario.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            {viewMode === "month" && (
              <MonthlyCalendarView
                selectedDate={selectedDate}
                appointments={filteredAppointments}
                blocks={scopedBlocks}
                doctors={visibleDoctors}
                onSelectDate={handleSelectDateFromSummaryView}
                onSelectAppointment={openAppointmentDetails}
              />
            )}

            {viewMode === "week" && (
              <WeeklyCalendarView
                selectedDate={selectedDate}
                appointments={filteredAppointments}
                blocks={scopedBlocks}
                doctors={visibleDoctors}
                onSelectDate={handleSelectDateFromSummaryView}
                onSelectAppointment={openAppointmentDetails}
              />
            )}

            {viewMode === "doctorDay" && (
              <DailyCalendarView
                doctors={visibleDoctors}
                appointments={filteredAppointments}
                schedules={schedules}
                blocks={scopedBlocks}
                selectedDate={selectedDate}
                selectedDoctorId={selectedDoctorId}
                onSelectSlot={handleSelectCalendarSlot}
                onSelectAppointment={openAppointmentDetails}
              />
            )}
          </>
        )}
      </section>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="mt-1 text-2xl font-semibold">{daySummary.total}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Programadas</p>
            <p className="mt-1 text-2xl font-semibold">
              {daySummary.scheduledAppointments}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Sin cita</p>
            <p className="mt-1 text-2xl font-semibold">{daySummary.walkIns}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Atendidas</p>
            <p className="mt-1 text-2xl font-semibold">{daySummary.completed}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Canceladas</p>
            <p className="mt-1 text-2xl font-semibold">{daySummary.cancelled}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pacientes del día</CardTitle>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Cargando citas...
            </div>
          ) : dayAppointments.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No hay citas para este día.
            </div>
          ) : (
            <div className="grid gap-3">
              {dayAppointments.map((appointment) => {
                const doctor = doctorsById.get(appointment.doctorId);
                const appointmentAssistants = appointment.assistantIds
                  .map((assistantId) => assistantsById.get(assistantId)?.nombre)
                  .filter(Boolean);
                const doctorColor = doctor?.color || "#2563EB";

                return (
                  <div
                    key={appointment.id}
                    className="rounded-lg border bg-muted/20 p-3 transition-colors hover:bg-muted/30"
                    style={{
                      borderLeftWidth: 5,
                      borderLeftColor: doctorColor,
                      backgroundColor: `${doctorColor}0D`,
                    }}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={
                              appointment.status === "cancelled"
                                ? "destructive"
                                : appointment.status === "completed"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {statusLabels[appointment.status]}
                          </Badge>

                          {appointment.appointmentType === "walk_in" && (
                            <Badge variant="secondary">Sin cita</Badge>
                          )}

                          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {appointment.startTime} - {appointment.endTime}
                          </span>
                        </div>

                        <h3 className="font-semibold">
                          {appointment.patientName}
                        </h3>

                        <p className="text-sm text-muted-foreground">
                          {appointment.serviceName || appointment.reason}
                        </p>

                        {appointment.appointmentType === "walk_in" && (
                          <p className="text-xs text-muted-foreground">
                            Llegada: {appointment.arrivalTime || "No registrada"}
                            {appointment.waitMinutes != null
                              ? ` · Espera: ${appointment.waitMinutes} min`
                              : ""}
                          </p>
                        )}

                        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                          <Stethoscope className="h-4 w-4" />
                          {doctor?.nombre ?? "Doctor no encontrado"}
                        </p>

                        {appointmentAssistants.length > 0 && (
                          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                            <UserCheck className="h-4 w-4" />
                            {appointmentAssistants.join(", ")}
                          </p>
                        )}

                        {appointment.notes && (
                          <p className="text-xs text-muted-foreground">
                            {appointment.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openAppointmentDetails(appointment)}
                        >
                          Ver detalles
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {confirmationDialog}

      <AppointmentDetailsDialog
        open={appointmentDetailsOpen}
        onOpenChange={handleAppointmentDetailsOpenChange}
        appointment={selectedAppointment}
        doctorName={selectedAppointmentDoctor}
        assistantNames={selectedAppointmentAssistantNames}
        walkInAssistantName={selectedAppointmentWalkInAssistantName}
        canUpdate={canUpdateAppointment}
        canCancel={canCancelAppointment}
        saving={saving}
        onEdit={openEditAppointment}
        onChangeStatus={handleChangeStatusFromDetails}
      />

      <CalendarSlotActionDialog
        open={slotActionDialogOpen}
        onOpenChange={setSlotActionDialogOpen}
        slot={selectedSlot}
        doctor={selectedSlotDoctor}
        canCreateAppointment={canCreateAppointment}
        canCreateBlock={canCreateBlock}
        onCreateAppointment={openAppointmentFromSelectedSlot}
        onCreateBlock={openBlockFromSelectedSlot}
      />

      <AppointmentDialog
        open={appointmentDialogOpen && (editingAppointment ? canUpdateAppointment : canCreateAppointment)}
        onOpenChange={handleAppointmentDialogOpenChange}
        form={form}
        setForm={setForm}
        patients={patients}
        services={services}
        doctors={visibleDoctors}
        assistants={visibleAssistants}
        saving={saving}
        title={
          editingAppointment
            ? "Editar cita"
            : form.appointmentType === "walk_in"
              ? "Registrar sin cita"
              : "Nueva cita"
        }
        description={
          editingAppointment
            ? "Actualiza los datos de la cita seleccionada."
            : form.appointmentType === "walk_in"
              ? "Registra rápidamente a un paciente que llegó sin cita previa."
              : "Busca paciente y servicio desde los catálogos existentes. También puedes escribirlos manualmente cuando todavía no estén registrados."
        }
        submitLabel={
          editingAppointment
            ? "Guardar cambios"
            : form.appointmentType === "walk_in"
              ? "Registrar sin cita"
              : "Crear cita"
        }
        onSubmit={handleSubmitAppointment}
      />

      <AgendaBlockDialog
        open={blockDialogOpen && canCreateBlock}
        onOpenChange={setBlockDialogOpen}
        slot={selectedSlot}
        doctor={selectedSlotDoctor}
        saving={saving}
        onSubmit={handleCreateBlock}
      />
    </div>
  );
};

export default AppointmentManager;
