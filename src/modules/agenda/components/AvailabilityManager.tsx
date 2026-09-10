import { useCallback, useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { Ban, CalendarOff, ChevronDown, Clock, Plus } from "lucide-react";
import { toast } from "sonner";

import { Can, useAuth, useCan } from "@/auth";
import { db } from "@/lib/firebase";
import { Button } from "@/shared/components/ui/button";
import { formatTimeRange, normalizeTime, timeToMinutes } from "@/shared/utils/time";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/components/ui/collapsible";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { useConfirmAction } from "@/shared/hooks/useConfirmAction";

import { agendaHistoryService } from "../services/agendaHistoryService";
import type { CreateAgendaHistoryLogInput } from "../services/agendaHistoryService";
import { agendaNotificationService } from "../services/agendaNotificationService";
import { availabilityService } from "../services/availabilityService";
import type {
  AgendaBlock,
  AgendaStaffType,
  Assistant,
  DayOfWeek,
  Doctor,
  StaffSchedule,
} from "../types/agenda.types";
import StaffSearchSelect from "./StaffSearchSelect";

type AgendaUserProfile = {
  uid: string;
  email?: string | null;
  status?: string;
  isAdmin?: boolean;
  doctorId?: string | null;
  assistantId?: string | null;
};

type ScheduleDayMode = "single" | "weekdays" | "all";

type ScheduleFormState = {
  staffType: AgendaStaffType;
  staffId: string;
  dayMode: ScheduleDayMode;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
};

type BlockFormState = {
  staffType: AgendaStaffType;
  staffId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  reason: string;
  notes: string;
};

type SpecialScheduleFormState = {
  staffType: AgendaStaffType;
  staffId: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
  notes: string;
};

interface AvailabilityManagerProps {
  doctors: Doctor[];
  assistants: Assistant[];
  refreshKey?: number;
}

const today = new Date().toISOString().slice(0, 10);

const dayLabels: Record<DayOfWeek, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
};

const dayOptions: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0];

const getScheduleDays = (
  dayMode: ScheduleDayMode,
  dayOfWeek: DayOfWeek,
): DayOfWeek[] => {
  if (dayMode === "weekdays") {
    return [1, 2, 3, 4, 5];
  }

  if (dayMode === "all") {
    return [1, 2, 3, 4, 5, 6, 0];
  }

  return [dayOfWeek];
};

const getDayOfWeekFromDate = (dateValue: string): DayOfWeek => {
  const date = new Date(`${dateValue}T12:00:00`);
  return date.getDay() as DayOfWeek;
};

const emptyScheduleForm: ScheduleFormState = {
  staffType: "doctor",
  staffId: "",
  dayMode: "single",
  dayOfWeek: 1,
  startTime: "09:00",
  endTime: "14:00",
};

const emptyBlockForm: BlockFormState = {
  staffType: "doctor",
  staffId: "",
  startDate: today,
  endDate: today,
  startTime: "09:00",
  endTime: "10:00",
  allDay: false,
  reason: "",
  notes: "",
};

const emptySpecialScheduleForm: SpecialScheduleFormState = {
  staffType: "doctor",
  staffId: "",
  date: today,
  startTime: "09:00",
  endTime: "12:00",
  reason: "",
  notes: "",
};

const AvailabilityManager = ({
  doctors,
  assistants,
  refreshKey = 0,
}: AvailabilityManagerProps) => {
  const { currentUser } = useAuth();
  const { can } = useCan();

  const [agendaUser, setAgendaUser] = useState<AgendaUserProfile | null>(null);
  const [agendaProfileLoading, setAgendaProfileLoading] = useState(true);

  const [schedules, setSchedules] = useState<StaffSchedule[]>([]);
  const [blocks, setBlocks] = useState<AgendaBlock[]>([]);

  const [scheduleForm, setScheduleForm] =
    useState<ScheduleFormState>(emptyScheduleForm);
  const [blockForm, setBlockForm] = useState<BlockFormState>(emptyBlockForm);
  const [specialScheduleForm, setSpecialScheduleForm] =
    useState<SpecialScheduleFormState>(emptySpecialScheduleForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scheduleView, setScheduleView] = useState<"weekly" | "special">("weekly");
  const [scheduleListOpen, setScheduleListOpen] = useState(false);
  const [blocksListOpen, setBlocksListOpen] = useState(false);
  const { confirm, confirmationDialog } = useConfirmAction();

  const canViewAllAvailability =
    agendaUser?.isAdmin === true ||
    can("agenda.doctors.viewAll") ||
    can("agenda.doctors.manage") ||
    can("agenda.assistants.manage");

  const canManageAllAvailability =
    agendaUser?.isAdmin === true ||
    can("agenda.doctors.manage") ||
    can("agenda.assistants.manage");

  const canManageSchedules = canManageAllAvailability;
  const canManageStaffSchedule = (staffType: AgendaStaffType) => can(staffType === "doctor" ? "agenda.doctors.manage" : "agenda.assistants.manage");

  const canCreateBlocks =
    can("agenda.blocks.create");

  const canDeleteBlocks =
    can("agenda.blocks.delete");

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
    return doctors.filter(
      (doctor) => doctor.status === "active" && doctor.visibleEnAgenda,
    );
  }, [doctors]);

  const activeAssistants = useMemo(() => {
    return assistants.filter(
      (assistant) =>
        assistant.status === "active" && assistant.visibleEnAgenda,
    );
  }, [assistants]);

  const canViewAllStaff = canViewAllAvailability;

  const visibleDoctors = useMemo(() => {
    if (canViewAllStaff) {
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
    canViewAllStaff,
    currentUser?.uid,
  ]);

  const visibleDoctorIds = useMemo(() => {
    return new Set(visibleDoctors.map((doctor) => doctor.id));
  }, [visibleDoctors]);

  const visibleAssistants = useMemo(() => {
    if (canViewAllStaff) {
      return activeAssistants;
    }

    const linkedAssistantId =
      agendaUser?.assistantId ||
      activeAssistants.find(
        (assistant) => assistant.userUid === currentUser?.uid,
      )?.id;

    if (linkedAssistantId) {
      return activeAssistants.filter(
        (assistant) => assistant.id === linkedAssistantId,
      );
    }

    return activeAssistants.filter((assistant) =>
      assistant.doctorIdsAsignados.some((doctorId) =>
        visibleDoctorIds.has(doctorId),
      ),
    );
  }, [
    activeAssistants,
    agendaUser?.assistantId,
    canViewAllStaff,
    currentUser?.uid,
    visibleDoctorIds,
  ]);

  const visibleAssistantIds = useMemo(() => {
    return new Set(visibleAssistants.map((assistant) => assistant.id));
  }, [visibleAssistants]);

  const getFirstStaffId = useCallback((staffType: AgendaStaffType) => {
    if (staffType === "doctor") {
      return visibleDoctors[0]?.id ?? "";
    }

    return visibleAssistants[0]?.id ?? "";
  }, [visibleAssistants, visibleDoctors]);

  const isVisibleStaff = useCallback((staffType: AgendaStaffType, staffId: string) => {
    if (!staffId) return false;

    if (staffType === "doctor") {
      return visibleDoctorIds.has(staffId);
    }

    return visibleAssistantIds.has(staffId);
  }, [visibleAssistantIds, visibleDoctorIds]);

  useEffect(() => {
    if (agendaProfileLoading) return;

    setScheduleForm((current) => {
      if (isVisibleStaff(current.staffType, current.staffId)) {
        return current;
      }

      const nextStaffType: AgendaStaffType =
        visibleDoctors.length > 0 ? "doctor" : "assistant";

      return {
        ...current,
        staffType: nextStaffType,
        staffId: getFirstStaffId(nextStaffType),
      };
    });

    setBlockForm((current) => {
      if (isVisibleStaff(current.staffType, current.staffId)) {
        return current;
      }

      const nextStaffType: AgendaStaffType =
        visibleDoctors.length > 0 ? "doctor" : "assistant";

      return {
        ...current,
        staffType: nextStaffType,
        staffId: getFirstStaffId(nextStaffType),
      };
    });

    setSpecialScheduleForm((current) => {
      if (isVisibleStaff(current.staffType, current.staffId)) {
        return current;
      }

      const nextStaffType: AgendaStaffType =
        visibleDoctors.length > 0 ? "doctor" : "assistant";

      return {
        ...current,
        staffType: nextStaffType,
        staffId: getFirstStaffId(nextStaffType),
      };
    });
  }, [
    agendaProfileLoading,
    visibleDoctors,
    visibleAssistants,
    visibleDoctorIds,
    visibleAssistantIds,
    getFirstStaffId,
    isVisibleStaff,
  ]);

  const staffName = (staffType: AgendaStaffType, staffId: string) => {
    if (staffType === "doctor") {
      return (
        doctors.find((doctor) => doctor.id === staffId)?.nombre ??
        "Doctor no encontrado"
      );
    }

    return (
      assistants.find((assistant) => assistant.id === staffId)?.nombre ??
      "Asistente no encontrado"
    );
  };

  const scopedSchedules = useMemo(() => {
    return schedules.filter((schedule) => {
      if (schedule.status !== "active") return false;

      if (schedule.staffType === "doctor") {
        return visibleDoctorIds.has(schedule.staffId);
      }

      return visibleAssistantIds.has(schedule.staffId);
    });
  }, [schedules, visibleAssistantIds, visibleDoctorIds]);

  const scopedWeeklySchedules = useMemo(() => {
    return scopedSchedules.filter((schedule) => {
      return !schedule.date && (schedule.scheduleType ?? "weekly") === "weekly";
    });
  }, [scopedSchedules]);

  const scopedSpecialSchedules = useMemo(() => {
    return scopedSchedules.filter((schedule) => {
      return schedule.scheduleType === "special" || Boolean(schedule.date);
    });
  }, [scopedSchedules]);

  const scopedBlocks = useMemo(() => {
    return blocks.filter((block) => {
      if (block.status !== "active") return false;

      if (block.staffType === "doctor") {
        return visibleDoctorIds.has(block.staffId);
      }

      return visibleAssistantIds.has(block.staffId);
    });
  }, [blocks, visibleAssistantIds, visibleDoctorIds]);

  const loadAvailability = async () => {
    setLoading(true);

    try {
      const [schedulesData, blocksData] = await Promise.all([
        availabilityService.listSchedules(),
        availabilityService.listBlocks(),
      ]);

      setSchedules(schedulesData);
      setBlocks(blocksData);
    } catch (error) {
      console.error(error);
      toast.error("No se pudo cargar la disponibilidad.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAvailability();
  }, [refreshKey]);

  const handleCreateSchedule = async () => {
    if (!canManageStaffSchedule(scheduleForm.staffType)) return;
    if (!canManageSchedules) {
      toast.error("No tienes permiso para gestionar horarios.");
      return;
    }

    if (!scheduleForm.staffId) {
      toast.error("Selecciona el personal.");
      return;
    }

    if (!isVisibleStaff(scheduleForm.staffType, scheduleForm.staffId)) {
      toast.error("No tienes acceso a ese personal.");
      return;
    }

    if (!normalizeTime(scheduleForm.startTime) || !normalizeTime(scheduleForm.endTime)) {
      toast.error("Selecciona una hora de inicio y fin válidas.");
      return;
    }
    if (timeToMinutes(scheduleForm.startTime) >= timeToMinutes(scheduleForm.endTime)) {
      toast.error("La hora de inicio debe ser menor que la hora de fin.");
      return;
    }

    const daysToCreate = getScheduleDays(
      scheduleForm.dayMode,
      scheduleForm.dayOfWeek,
    );

    setSaving(true);

    try {
      await Promise.all(
        daysToCreate.map(async (dayOfWeek) => {
          const scheduleId = await availabilityService.createSchedule({
            staffType: scheduleForm.staffType,
            staffId: scheduleForm.staffId,
            dayOfWeek,
            startTime: scheduleForm.startTime,
            endTime: scheduleForm.endTime,
            status: "active",
            scheduleType: "weekly",
            date: null,
            createdBy: currentUser?.uid ?? null,
            updatedBy: currentUser?.uid ?? null,
          });

          const createdScheduleId =
            typeof scheduleId === "string" ? scheduleId : "";

          await createAgendaHistoryLog({
            action: "schedule_created",
            entityType: "schedule",
            entityId: createdScheduleId,
            doctorId:
              scheduleForm.staffType === "doctor"
                ? scheduleForm.staffId
                : null,
            patientId: null,
            patientName: null,
            title: "Horario semanal creado",
            description: `${dayLabels[dayOfWeek]} · ${scheduleForm.startTime} a ${scheduleForm.endTime}`,
            date: null,
            startTime: scheduleForm.startTime,
            endTime: scheduleForm.endTime,
            before: null,
            after: {
              staffType: scheduleForm.staffType,
              staffId: scheduleForm.staffId,
              scheduleType: "weekly",
              dayOfWeek,
              startTime: scheduleForm.startTime,
              endTime: scheduleForm.endTime,
              status: "active",
            },
          });
        }),
      );

      toast.success(
        daysToCreate.length === 1
          ? "Horario agregado correctamente."
          : "Horarios agregados correctamente.",
      );

      await loadAvailability();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo agregar el horario.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSpecialSchedule = async () => {
    if (!canManageStaffSchedule(specialScheduleForm.staffType)) return;
    if (!canManageAllAvailability) {
      toast.error("No tienes permiso para crear horarios especiales.");
      return;
    }

    if (!specialScheduleForm.staffId) {
      toast.error("Selecciona el personal.");
      return;
    }

    if (
      !isVisibleStaff(
        specialScheduleForm.staffType,
        specialScheduleForm.staffId,
      )
    ) {
      toast.error("No tienes acceso a ese personal.");
      return;
    }

    if (!specialScheduleForm.reason.trim()) {
      toast.error("Escribe el motivo del horario especial.");
      return;
    }

    if (!normalizeTime(specialScheduleForm.startTime) || !normalizeTime(specialScheduleForm.endTime)) {
      toast.error("Selecciona una hora de inicio y fin válidas.");
      return;
    }
    if (timeToMinutes(specialScheduleForm.startTime) >= timeToMinutes(specialScheduleForm.endTime)) {
      toast.error("La hora de inicio debe ser menor que la hora de fin.");
      return;
    }

    setSaving(true);

    try {
      const scheduleId = await availabilityService.createSchedule({
        staffType: specialScheduleForm.staffType,
        staffId: specialScheduleForm.staffId,
        dayOfWeek: getDayOfWeekFromDate(specialScheduleForm.date),
        startTime: specialScheduleForm.startTime,
        endTime: specialScheduleForm.endTime,
        status: "active",
        scheduleType: "special",
        date: specialScheduleForm.date,
        reason: specialScheduleForm.reason.trim(),
        notes: specialScheduleForm.notes.trim(),
        createdBy: currentUser?.uid ?? null,
        updatedBy: currentUser?.uid ?? null,
      });

      const createdScheduleId =
        typeof scheduleId === "string" ? scheduleId : "";

      if (specialScheduleForm.staffType === "doctor") {
        await agendaNotificationService.createForDoctor({
          targetDoctorId: specialScheduleForm.staffId,
          type: "special_schedule_created",
          title: "Horario especial agregado",
          message: `${specialScheduleForm.reason.trim()} · ${specialScheduleForm.date} de ${specialScheduleForm.startTime} a ${specialScheduleForm.endTime}`,
          entityType: "schedule",
          entityId: createdScheduleId,
          scheduleId: createdScheduleId,
          startDate: specialScheduleForm.date,
          startTime: specialScheduleForm.startTime,
          endTime: specialScheduleForm.endTime,
          createdBy: currentUser?.uid ?? null,
        });
      }

      await createAgendaHistoryLog({
        action: "special_schedule_created",
        entityType: "schedule",
        entityId: createdScheduleId,
        doctorId:
          specialScheduleForm.staffType === "doctor"
            ? specialScheduleForm.staffId
            : null,
        patientId: null,
        patientName: null,
        title: "Horario especial creado",
        description: `${specialScheduleForm.reason.trim()} · ${
          specialScheduleForm.date
        } de ${specialScheduleForm.startTime} a ${specialScheduleForm.endTime}`,
        date: specialScheduleForm.date,
        startTime: specialScheduleForm.startTime,
        endTime: specialScheduleForm.endTime,
        before: null,
        after: {
          staffType: specialScheduleForm.staffType,
          staffId: specialScheduleForm.staffId,
          scheduleType: "special",
          date: specialScheduleForm.date,
          dayOfWeek: getDayOfWeekFromDate(specialScheduleForm.date),
          startTime: specialScheduleForm.startTime,
          endTime: specialScheduleForm.endTime,
          reason: specialScheduleForm.reason.trim(),
          notes: specialScheduleForm.notes.trim(),
          status: "active",
        },
      });

      toast.success("Horario especial agregado correctamente.");

      setSpecialScheduleForm((current) => ({
        ...emptySpecialScheduleForm,
        staffType: current.staffType,
        staffId: current.staffId,
      }));

      await loadAvailability();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo agregar el horario especial.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivateSchedule = async (scheduleId: string) => {
    const target = schedules.find((schedule) => schedule.id === scheduleId);
    if (!target || !canManageStaffSchedule(target.staffType)) return;
    if (!canManageSchedules) {
      toast.error("No tienes permiso para desactivar horarios.");
      return;
    }

    const confirmed = await confirm({
      title: "Desactivar horario",
      description: "Este horario dejará de estar disponible para nuevas citas.",
      confirmLabel: "Desactivar",
      destructive: true,
    });

    if (!confirmed) return;

    setSaving(true);

    try {
      await availabilityService.deactivateSchedule(
        scheduleId,
        currentUser?.uid,
      );

      toast.success("Horario desactivado correctamente.");
      await loadAvailability();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo desactivar el horario.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBlock = async () => {
    if (!canCreateBlocks) {
      toast.error("No tienes permiso para crear bloqueos.");
      return;
    }

    if (!blockForm.staffId) {
      toast.error("Selecciona el personal.");
      return;
    }

    if (!isVisibleStaff(blockForm.staffType, blockForm.staffId)) {
      toast.error("No tienes acceso a ese personal.");
      return;
    }

    if (!blockForm.reason.trim()) {
      toast.error("Escribe el motivo del bloqueo.");
      return;
    }

    if (blockForm.startDate > blockForm.endDate) {
      toast.error("La fecha inicial no puede ser mayor que la fecha final.");
      return;
    }

    if (!blockForm.allDay && (!normalizeTime(blockForm.startTime) || !normalizeTime(blockForm.endTime))) {
      toast.error("Selecciona una hora de inicio y fin válidas.");
      return;
    }
    if (!blockForm.allDay && timeToMinutes(blockForm.startTime) >= timeToMinutes(blockForm.endTime)) {
      toast.error("La hora inicial debe ser menor que la hora final.");
      return;
    }

    setSaving(true);

    try {
      const blockId = await availabilityService.createBlock({
        staffType: blockForm.staffType,
        staffId: blockForm.staffId,
        startDate: blockForm.startDate,
        endDate: blockForm.endDate,
        startTime: blockForm.allDay ? "00:00" : blockForm.startTime,
        endTime: blockForm.allDay ? "23:59" : blockForm.endTime,
        allDay: blockForm.allDay,
        reason: blockForm.reason.trim(),
        notes: blockForm.notes.trim(),
        status: "active",
        createdBy: currentUser?.uid ?? null,
        updatedBy: currentUser?.uid ?? null,
      });

      const createdBlockId = typeof blockId === "string" ? blockId : "";

      if (blockForm.staffType === "doctor") {
        await agendaNotificationService.createForDoctor({
          targetDoctorId: blockForm.staffId,
          type: "block_created",
          title: "Nuevo bloqueo en tu agenda",
          message: blockForm.reason.trim(),
          entityType: "block",
          entityId: createdBlockId,
          blockId: createdBlockId,
          startDate: blockForm.startDate,
          startTime: blockForm.allDay ? "00:00" : blockForm.startTime,
          endTime: blockForm.allDay ? "23:59" : blockForm.endTime,
          createdBy: currentUser?.uid ?? null,
        });
      }

      await createAgendaHistoryLog({
        action: "block_created",
        entityType: "block",
        entityId: createdBlockId,
        doctorId: blockForm.staffType === "doctor" ? blockForm.staffId : null,
        patientId: null,
        patientName: null,
        title: "Bloqueo creado desde disponibilidad",
        description: blockForm.reason.trim(),
        date: blockForm.startDate,
        startTime: blockForm.allDay ? "00:00" : blockForm.startTime,
        endTime: blockForm.allDay ? "23:59" : blockForm.endTime,
        before: null,
        after: {
          staffType: blockForm.staffType,
          staffId: blockForm.staffId,
          startDate: blockForm.startDate,
          endDate: blockForm.endDate,
          startTime: blockForm.allDay ? "00:00" : blockForm.startTime,
          endTime: blockForm.allDay ? "23:59" : blockForm.endTime,
          allDay: blockForm.allDay,
          reason: blockForm.reason.trim(),
          notes: blockForm.notes.trim(),
          status: "active",
        },
      });

      toast.success("Bloqueo creado correctamente.");

      setBlockForm((current) => ({
        ...emptyBlockForm,
        staffType: current.staffType,
        staffId: current.staffId,
      }));

      await loadAvailability();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo crear el bloqueo.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelBlock = async (blockId: string) => {
    if (!canDeleteBlocks) {
      toast.error("No tienes permiso para cancelar bloqueos.");
      return;
    }

    const confirmed = await confirm({
      title: "Quitar bloqueo",
      description: "El horario volverá a quedar disponible para citas.",
      confirmLabel: "Quitar bloqueo",
      destructive: true,
    });

    if (!confirmed) return;

    setSaving(true);

    try {
      await availabilityService.cancelBlock(blockId, currentUser?.uid);

      toast.success("Bloqueo cancelado correctamente.");
      await loadAvailability();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo cancelar el bloqueo.");
    } finally {
      setSaving(false);
    }
  };

  const handleScheduleStaffTypeChange = (staffType: AgendaStaffType) => {
    setScheduleForm((current) => ({
      ...current,
      staffType,
      staffId: getFirstStaffId(staffType),
    }));
  };

  const handleBlockStaffTypeChange = (staffType: AgendaStaffType) => {
    setBlockForm((current) => ({
      ...current,
      staffType,
      staffId: getFirstStaffId(staffType),
    }));
  };

  const handleSpecialScheduleStaffTypeChange = (
    staffType: AgendaStaffType,
  ) => {
    setSpecialScheduleForm((current) => ({
      ...current,
      staffType,
      staffId: getFirstStaffId(staffType),
    }));
  };

  const hasVisibleStaff =
    visibleDoctors.length > 0 || visibleAssistants.length > 0;

  if (agendaProfileLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Cargando disponibilidad
          </CardTitle>
          <CardDescription>
            Estamos verificando qué disponibilidad puede ver tu usuario.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!hasVisibleStaff) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            No hay disponibilidad visible
          </CardTitle>
          <CardDescription>
            Solicita la asignación de tu agenda para gestionar esta disponibilidad.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {scheduleView === "weekly" && (
      <Card className="order-1 xl:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Generar horario
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          {canManageSchedules && (
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="schedule-staff-type">Tipo</Label>

                  <select
                    id="schedule-staff-type"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={scheduleForm.staffType}
                    onChange={(event) =>
                      handleScheduleStaffTypeChange(
                        event.target.value as AgendaStaffType,
                      )
                    }
                  >
                    {visibleDoctors.length > 0 && canManageStaffSchedule("doctor") && (
                      <option value="doctor">Doctor</option>
                    )}

                    {visibleAssistants.length > 0 && canManageStaffSchedule("assistant") && (
                      <option value="assistant">Asistente</option>
                    )}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="schedule-staff-id">Personal</Label>

                  <StaffSearchSelect
                    id="schedule-staff-id"
                    staffType={scheduleForm.staffType}
                    doctors={visibleDoctors}
                    assistants={visibleAssistants}
                    value={scheduleForm.staffId}
                    onValueChange={(staffId) =>
                      setScheduleForm((current) => ({
                        ...current,
                        staffId,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="availability-schedule-view">Configurar disponibilidad</Label>
                  <select
                    id="availability-schedule-view"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={scheduleView}
                    onChange={(event) => setScheduleView(event.target.value as "weekly" | "special")}
                  >
                    <option value="weekly">Horario semanal</option>
                    {canManageAllAvailability && <option value="special">Fecha especial</option>}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="schedule-day-mode">Aplicar a</Label>

                  <select
                    id="schedule-day-mode"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={scheduleForm.dayMode}
                    onChange={(event) =>
                      setScheduleForm((current) => ({
                        ...current,
                        dayMode: event.target.value as ScheduleDayMode,
                      }))
                    }
                  >
                    <option value="single">Un día específico</option>
                    <option value="weekdays">Lunes a viernes</option>
                    <option value="all">Todos los días</option>
                  </select>
                </div>

                {scheduleForm.dayMode === "single" && (
                  <div className="space-y-2">
                    <Label htmlFor="schedule-day">Día</Label>

                    <select
                      id="schedule-day"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={scheduleForm.dayOfWeek}
                      onChange={(event) =>
                        setScheduleForm((current) => ({
                          ...current,
                          dayOfWeek: Number(event.target.value) as DayOfWeek,
                        }))
                      }
                    >
                      {dayOptions.map((day) => (
                        <option key={day} value={day}>
                          {dayLabels[day]}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="schedule-start">Inicio</Label>

                    <Input
                      id="schedule-start"
                      type="time"
                      value={scheduleForm.startTime}
                      onChange={(event) =>
                        setScheduleForm((current) => ({
                          ...current,
                          startTime: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="schedule-end">Fin</Label>

                    <Input
                      id="schedule-end"
                      type="time"
                      value={scheduleForm.endTime}
                      onChange={(event) =>
                        setScheduleForm((current) => ({
                          ...current,
                          endTime: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <Button onClick={handleCreateSchedule} disabled={saving || !canManageStaffSchedule(scheduleForm.staffType)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {saving ? "Guardando..." : "Agregar horario"}
                </Button>
              </div>
            </div>
          )}

          <Collapsible open={scheduleListOpen} onOpenChange={setScheduleListOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" className="w-full justify-between">
                <span>Horarios registrados ({scopedWeeklySchedules.length})</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${scheduleListOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 max-h-72 overflow-y-auto rounded-lg border bg-muted/10 p-2">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Cargando horarios...</div>
          ) : scopedWeeklySchedules.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No hay horarios registrados.</div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {scopedWeeklySchedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="rounded-lg border bg-card p-3"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-medium">
                        {staffName(schedule.staffType, schedule.staffId)}
                      </p>

                      <p className="text-sm text-muted-foreground">
                        {schedule.staffType === "doctor"
                          ? "Doctor"
                          : "Asistente"}
                      </p>

                      <p className="mt-2 text-sm">
                        {dayLabels[schedule.dayOfWeek]} · {formatTimeRange(schedule.startTime, schedule.endTime)}
                      </p>
                    </div>

                    {canManageSchedules && (
                      <Can permission={schedule.staffType === "doctor" ? "agenda.doctors.manage" : "agenda.assistants.manage"}><Button
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={() =>
                          void handleDeactivateSchedule(schedule.id)
                        }
                      >
                        Desactivar
                      </Button></Can>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
      )}

      {canManageAllAvailability && scheduleView === "special" && (
        <Card className="order-1 xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Generar horario
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="special-staff-type">Tipo</Label>

                  <select
                    id="special-staff-type"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={specialScheduleForm.staffType}
                    onChange={(event) =>
                      handleSpecialScheduleStaffTypeChange(
                        event.target.value as AgendaStaffType,
                      )
                    }
                  >
                    {visibleDoctors.length > 0 && (
                      <option value="doctor">Doctor</option>
                    )}

                    {visibleAssistants.length > 0 && (
                      <option value="assistant">Asistente</option>
                    )}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="special-staff-id">Personal</Label>

                  <StaffSearchSelect
                    id="special-staff-id"
                    staffType={specialScheduleForm.staffType}
                    doctors={visibleDoctors}
                    assistants={visibleAssistants}
                    value={specialScheduleForm.staffId}
                    onValueChange={(staffId) =>
                      setSpecialScheduleForm((current) => ({
                        ...current,
                        staffId,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="availability-schedule-view">Configurar disponibilidad</Label>
                  <select
                    id="availability-schedule-view"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={scheduleView}
                    onChange={(event) => setScheduleView(event.target.value as "weekly" | "special")}
                  >
                    <option value="weekly">Horario semanal</option>
                    <option value="special">Fecha especial</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="special-date">Fecha</Label>

                  <Input
                    id="special-date"
                    type="date"
                    value={specialScheduleForm.date}
                    onChange={(event) =>
                      setSpecialScheduleForm((current) => ({
                        ...current,
                        date: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="special-start-time">Inicio</Label>

                    <Input
                      id="special-start-time"
                      type="time"
                      value={specialScheduleForm.startTime}
                      onChange={(event) =>
                        setSpecialScheduleForm((current) => ({
                          ...current,
                          startTime: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="special-end-time">Fin</Label>

                    <Input
                      id="special-end-time"
                      type="time"
                      value={specialScheduleForm.endTime}
                      onChange={(event) =>
                        setSpecialScheduleForm((current) => ({
                          ...current,
                          endTime: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="special-reason">Motivo *</Label>

                  <Input
                    id="special-reason"
                    value={specialScheduleForm.reason}
                    onChange={(event) =>
                      setSpecialScheduleForm((current) => ({
                        ...current,
                        reason: event.target.value,
                      }))
                    }
                    placeholder="Ej. Jornada especial, sábado de atención, campaña"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="special-notes">Notas</Label>

                  <Textarea
                    id="special-notes"
                    value={specialScheduleForm.notes}
                    onChange={(event) =>
                      setSpecialScheduleForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    placeholder="Detalles internos opcionales."
                  />
                </div>
              </div>

              <div className="mt-4">
                <Button onClick={handleCreateSpecialSchedule} disabled={saving || !canManageStaffSchedule(specialScheduleForm.staffType)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {saving ? "Guardando..." : "Agregar horario especial"}
                </Button>
              </div>
            </div>

            {scopedSpecialSchedules.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No hay horarios especiales activos.
              </div>
            ) : (
              <div className="grid gap-3">
                {scopedSpecialSchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="rounded-xl border bg-background p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="font-medium">
                          {schedule.reason || "Horario especial"}
                        </p>

                        <p className="text-sm text-muted-foreground">
                          {staffName(schedule.staffType, schedule.staffId)} ·{" "}
                          {schedule.staffType === "doctor"
                            ? "Doctor"
                            : "Asistente"}
                        </p>

                        <p className="mt-2 text-sm">
                          {schedule.date} · {formatTimeRange(schedule.startTime, schedule.endTime)}
                        </p>

                        {schedule.notes && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {schedule.notes}
                          </p>
                        )}
                      </div>

                      <Can permission={schedule.staffType === "doctor" ? "agenda.doctors.manage" : "agenda.assistants.manage"}><Button
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={() =>
                          void handleDeactivateSchedule(schedule.id)
                        }
                      >
                        Desactivar
                      </Button></Can>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="order-2 xl:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarOff className="h-5 w-5" />
            Bloqueos y días no disponibles
          </CardTitle>

          <CardDescription>Vacaciones, permisos y otros periodos sin citas.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {canCreateBlocks && (
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="block-staff-type">Tipo</Label>

                  <select
                    id="block-staff-type"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={blockForm.staffType}
                    onChange={(event) =>
                      handleBlockStaffTypeChange(
                        event.target.value as AgendaStaffType,
                      )
                    }
                  >
                    {visibleDoctors.length > 0 && (
                      <option value="doctor">Doctor</option>
                    )}

                    {visibleAssistants.length > 0 && (
                      <option value="assistant">Asistente</option>
                    )}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="block-staff-id">Personal</Label>

                  <StaffSearchSelect
                    id="block-staff-id"
                    staffType={blockForm.staffType}
                    doctors={visibleDoctors}
                    assistants={visibleAssistants}
                    value={blockForm.staffId}
                    onValueChange={(staffId) =>
                      setBlockForm((current) => ({
                        ...current,
                        staffId,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="block-start-date">Desde</Label>

                  <Input
                    id="block-start-date"
                    type="date"
                    value={blockForm.startDate}
                    onChange={(event) =>
                      setBlockForm((current) => ({
                        ...current,
                        startDate: event.target.value,
                        endDate:
                          current.endDate < event.target.value
                            ? event.target.value
                            : current.endDate,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="block-end-date">Hasta</Label>

                  <Input
                    id="block-end-date"
                    type="date"
                    value={blockForm.endDate}
                    onChange={(event) =>
                      setBlockForm((current) => ({
                        ...current,
                        endDate: event.target.value,
                      }))
                    }
                  />
                </div>

                <label className="flex items-center gap-3 rounded-lg border p-3 md:col-span-2">
                  <Checkbox
                    checked={blockForm.allDay}
                    onCheckedChange={(checked) =>
                      setBlockForm((current) => ({
                        ...current,
                        allDay: checked === true,
                      }))
                    }
                  />

                  <span className="text-sm">Bloquear todo el día</span>
                </label>

                {!blockForm.allDay && (
                  <div className="grid grid-cols-2 gap-3 md:col-span-2">
                    <div className="space-y-2">
                      <Label htmlFor="block-start-time">Inicio</Label>

                      <Input
                        id="block-start-time"
                        type="time"
                        value={blockForm.startTime}
                        onChange={(event) =>
                          setBlockForm((current) => ({
                            ...current,
                            startTime: event.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="block-end-time">Fin</Label>

                      <Input
                        id="block-end-time"
                        type="time"
                        value={blockForm.endTime}
                        onChange={(event) =>
                          setBlockForm((current) => ({
                            ...current,
                            endTime: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="block-reason">Motivo *</Label>

                  <Input
                    id="block-reason"
                    value={blockForm.reason}
                    onChange={(event) =>
                      setBlockForm((current) => ({
                        ...current,
                        reason: event.target.value,
                      }))
                    }
                    placeholder="Ej. Vacaciones, curso, permiso, comida"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="block-notes">Notas</Label>

                  <Textarea
                    id="block-notes"
                    value={blockForm.notes}
                    onChange={(event) =>
                      setBlockForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    placeholder="Detalles internos opcionales."
                  />
                </div>
              </div>

              <div className="mt-4">
                <Button
                  variant="destructive"
                  onClick={handleCreateBlock}
                  disabled={saving}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  {saving ? "Guardando..." : "Crear bloqueo"}
                </Button>
              </div>
            </div>
          )}

          <Collapsible open={blocksListOpen} onOpenChange={setBlocksListOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" className="w-full justify-between">
                <span>Bloqueos activos ({scopedBlocks.length})</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${blocksListOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 max-h-72 overflow-y-auto rounded-lg border bg-muted/10 p-2">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Cargando bloqueos...</div>
          ) : scopedBlocks.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No hay bloqueos activos.</div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {scopedBlocks.map((block) => (
                <div
                  key={block.id}
                  className="rounded-lg border bg-card p-3"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-medium">{block.reason}</p>

                      <p className="text-sm text-muted-foreground">
                        {staffName(block.staffType, block.staffId)} ·{" "}
                        {block.staffType === "doctor"
                          ? "Doctor"
                          : "Asistente"}
                      </p>

                      <p className="mt-2 text-sm">
                        {block.startDate}
                        {block.endDate !== block.startDate
                          ? ` a ${block.endDate}`
                          : ""}{" "}
                        ·{" "}
                        {block.allDay
                          ? "Todo el día"
                          : formatTimeRange(block.startTime, block.endTime)}
                      </p>

                      {block.notes && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {block.notes}
                        </p>
                      )}
                    </div>

                    {canDeleteBlocks && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={() => void handleCancelBlock(block.id)}
                      >
                        Cancelar bloqueo
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
      {confirmationDialog}
    </div>
  );
};

export default AvailabilityManager;
