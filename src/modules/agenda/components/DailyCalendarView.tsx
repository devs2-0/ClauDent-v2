import { CalendarClock, Clock, Stethoscope, UserPlus } from "lucide-react";
import { formatTimeRange, normalizeTime, timeToMinutes } from "@/shared/utils/time";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";

import type {
  AgendaBlock,
  Appointment,
  AppointmentStatus,
  DayOfWeek,
  Doctor,
  StaffSchedule,
} from "../types/agenda.types";

interface DailyCalendarViewProps {
  doctors: Doctor[];
  appointments: Appointment[];
  schedules: StaffSchedule[];
  blocks: AgendaBlock[];
  selectedDate: string;
  selectedDoctorId: string;
  onSelectSlot?: (slot: {
    doctorId: string;
    startDate: string;
    startTime: string;
    endTime: string;
  }) => void;
  onSelectAppointment?: (appointment: Appointment) => void;
}

const statusLabels: Record<AppointmentStatus, string> = {
  scheduled: "Programada",
  confirmed: "Confirmada",
  completed: "Atendida",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

const DEFAULT_DOCTOR_COLOR = "#2563EB";

const minutesToTime = (totalMinutes: number) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}`;
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

const createTimeSlots = () => {
  const start = 8 * 60;
  const end = 20 * 60;
  const step = 30;

  const slots: { startTime: string; endTime: string }[] = [];

  for (let minute = start; minute < end; minute += step) {
    slots.push({
      startTime: minutesToTime(minute),
      endTime: minutesToTime(minute + step),
    });
  }

  return slots;
};

const getStatusVariant = (
  status: AppointmentStatus,
): "default" | "destructive" | "outline" | "secondary" => {
  if (status === "cancelled") return "destructive";
  if (status === "completed") return "secondary";
  if (status === "confirmed") return "default";

  return "outline";
};

const getSoftColor = (color: string, opacity: number) => {
  const normalized = color.trim();

  if (!/^#[0-9A-Fa-f]{6}$/.test(normalized)) {
    return undefined;
  }

  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
};

const timeSlots = createTimeSlots();

const DailyCalendarView = ({
  doctors,
  appointments,
  schedules,
  blocks,
  selectedDate,
  selectedDoctorId,
  onSelectSlot,
  onSelectAppointment,
}: DailyCalendarViewProps) => {
  const visibleDoctors = doctors.filter((doctor) => {
    const isActive = doctor.status === "active";
    const matchesFilter =
      selectedDoctorId === "all" || doctor.id === selectedDoctorId;

    return isActive && matchesFilter;
  });

  const selectedDayOfWeek = getDayOfWeek(selectedDate);
  const appointmentsWithoutTime = appointments.filter((appointment) =>
    appointment?.startDate === selectedDate &&
    !normalizeTime(appointment?.startTime) &&
    visibleDoctors.some((doctor) => doctor.id === appointment.doctorId),
  );

  const getDoctorSchedulesForDate = (doctorId: string) => {
    const doctorSchedules = schedules.filter((schedule) => {
      return (
        schedule?.status === "active" &&
        normalizeTime(schedule.startTime) && normalizeTime(schedule.endTime) &&
        schedule.staffType === "doctor" &&
        schedule.staffId === doctorId
      );
    });

    const specialSchedules = doctorSchedules.filter((schedule) => {
      const isSpecialSchedule =
        schedule.scheduleType === "special" || Boolean(schedule.date);

      return isSpecialSchedule && schedule.date === selectedDate;
    });

    if (specialSchedules.length > 0) {
      return specialSchedules;
    }

    return doctorSchedules.filter((schedule) => {
      const isWeeklySchedule =
        !schedule.date && (schedule.scheduleType ?? "weekly") === "weekly";

      return isWeeklySchedule && schedule.dayOfWeek === selectedDayOfWeek;
    });
  };

  const getDoctorScheduleForSlot = (
    doctorId: string,
    startTime: string,
    endTime: string,
  ) => {
    const schedulesForDate = getDoctorSchedulesForDate(doctorId);

    return schedulesForDate.find((schedule) => {
      return schedule.startTime <= startTime && schedule.endTime >= endTime;
    });
  };

  const getDoctorBlockForSlot = (
    doctorId: string,
    startTime: string,
    endTime: string,
  ) => {
    return blocks.find((block) => {
      if (block?.status !== "active") return false;
      if (block.staffType !== "doctor") return false;
      if (block.staffId !== doctorId) return false;
      if (!isDateWithinRange(selectedDate, block.startDate, block.endDate)) {
        return false;
      }

      if (block.allDay) return true;

      return rangesOverlap(startTime, endTime, block.startTime, block.endTime);
    });
  };

  const getAppointmentStartingInSlot = (
    doctorId: string,
    startTime: string,
    endTime: string,
  ) => {
    return appointments.find((appointment) => {
      if (!appointment || !normalizeTime(appointment.startTime)) return false;
      if (appointment.doctorId !== doctorId) return false;
      if (appointment.startDate !== selectedDate) return false;

      return (
        appointment.startTime >= startTime && appointment.startTime < endTime
      );
    });
  };

  const hasAppointmentOverlappingSlot = (
    doctorId: string,
    startTime: string,
    endTime: string,
  ) => {
    return appointments.some((appointment) => {
      if (!appointment) return false;
      if (appointment.status === "cancelled") return false;
      if (appointment.status === "no_show") return false;
      if (appointment.doctorId !== doctorId) return false;
      if (appointment.startDate !== selectedDate) return false;

      return rangesOverlap(
        startTime,
        endTime,
        appointment.startTime,
        appointment.endTime,
      );
    });
  };

  const handleSelectAvailableSlot = (
    doctorId: string,
    startTime: string,
    endTime: string,
  ) => {
    onSelectSlot?.({
      doctorId,
      startDate: selectedDate,
      startTime,
      endTime,
    });
  };

  if (visibleDoctors.length === 0) {
    return (
      <Card className="rounded-none border-0 shadow-none">
        <CardContent className="p-6">
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No hay doctores activos para mostrar.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-none border-0 bg-background shadow-none">
      <CardContent className="p-0">
        {appointmentsWithoutTime.length > 0 && (
          <div className="space-y-2 border-b bg-muted/40 p-3">
            <p className="text-sm font-medium">Horario no definido</p>
            <div className="flex flex-wrap gap-2">
              {appointmentsWithoutTime.map((appointment) => (
                <Button key={appointment.id} variant="outline" size="sm"
                  onClick={() => onSelectAppointment?.(appointment)}>
                  {appointment.patientName} · Sin hora
                </Button>
              ))}
            </div>
          </div>
        )}
        <div className="border-b bg-muted/20 px-4 py-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Día por doctores</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div
            className="grid min-w-[820px]"
            style={{
              gridTemplateColumns: `82px repeat(${visibleDoctors.length}, minmax(230px, 1fr))`,
            }}
          >
            <div className="sticky left-0 z-[2] border-b bg-background/95 p-3 text-xs font-medium text-muted-foreground backdrop-blur">
              Hora
            </div>

            {visibleDoctors.map((doctor) => {
              const doctorColor = doctor.color || DEFAULT_DOCTOR_COLOR;

              return (
                <div
                  key={doctor.id}
                  className="border-b border-l p-3"
                  style={{
                    backgroundColor: getSoftColor(doctorColor, 0.09),
                    borderTopColor: doctorColor,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3.5 w-3.5 rounded-full border shadow-sm"
                      style={{
                        backgroundColor: doctorColor,
                      }}
                    />

                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {doctor.nombre}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {doctor.especialidad || "Sin especialidad"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {timeSlots.map((slot) => (
              <div key={slot.startTime} className="contents">
                <div className="sticky left-0 z-[1] border-b bg-background/95 p-3 text-xs text-muted-foreground backdrop-blur">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {slot.startTime}
                  </div>
                </div>

                {visibleDoctors.map((doctor) => {
                  const doctorColor = doctor.color || DEFAULT_DOCTOR_COLOR;

                  const schedule = getDoctorScheduleForSlot(
                    doctor.id,
                    slot.startTime,
                    slot.endTime,
                  );

                  const isSpecialSchedule =
                    schedule?.scheduleType === "special";

                  const block = getDoctorBlockForSlot(
                    doctor.id,
                    slot.startTime,
                    slot.endTime,
                  );

                  const appointment = getAppointmentStartingInSlot(
                    doctor.id,
                    slot.startTime,
                    slot.endTime,
                  );

                  const hasBusyAppointment = hasAppointmentOverlappingSlot(
                    doctor.id,
                    slot.startTime,
                    slot.endTime,
                  );

                  const isAvailable =
                    Boolean(schedule) && !block && !hasBusyAppointment;

                  return (
                    <div
                      key={`${doctor.id}-${slot.startTime}`}
                      className={[
                        "min-h-[84px] border-b border-l p-2 transition-colors duration-200",
                        !schedule ? "bg-muted/20" : "",
                        block ? "bg-muted/40" : "",
                        isAvailable ? "bg-background hover:bg-muted/20" : "",
                      ].join(" ")}
                    >
                      {appointment ? (
                        <button
                          type="button"
                          className="w-full rounded-xl border p-3 text-left text-sm shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                          style={{
                            borderColor: getSoftColor(doctorColor, 0.45),
                            borderLeftWidth: 6,
                            borderLeftColor: doctorColor,
                            backgroundColor:
                              getSoftColor(doctorColor, 0.11) ?? undefined,
                          }}
                          onClick={() => onSelectAppointment?.(appointment)}
                        >
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Badge
                              variant={getStatusVariant(appointment.status)}
                            >
                              {statusLabels[appointment.status]}
                            </Badge>

                            {appointment.appointmentType === "walk_in" && (
                              <Badge variant="secondary" className="gap-1">
                                <UserPlus className="h-3 w-3" />
                                Sin cita
                              </Badge>
                            )}

                            <span className="text-xs text-muted-foreground">
                              {formatTimeRange(appointment?.startTime, appointment?.endTime)}
                            </span>
                          </div>

                          <p className="line-clamp-1 font-medium">
                            {appointment.patientName}
                          </p>

                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                            {appointment.serviceName || appointment.reason}
                          </p>

                          {appointment.appointmentType === "walk_in" && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Llegada: {appointment.arrivalTime || "No registrada"}
                              {typeof appointment.waitMinutes === "number"
                                ? ` · Espera: ${appointment.waitMinutes} min`
                                : ""}
                            </p>
                          )}
                        </button>
                      ) : block ? (
                        <div className="h-full rounded-xl border border-dashed bg-muted/50 p-3 text-sm">
                          <Badge variant="secondary">Bloqueado</Badge>

                          <p className="mt-2 line-clamp-1 font-medium">
                            {block.reason}
                          </p>

                          <p className="mt-1 text-xs text-muted-foreground">
                            {block.allDay
                              ? "Todo el día"
                              : formatTimeRange(block?.startTime, block?.endTime)}
                          </p>
                        </div>
                      ) : !schedule ? (
                        <div className="flex h-full items-center justify-center rounded-xl border border-dashed p-3 text-center text-xs text-muted-foreground">
                          Fuera de horario
                        </div>
                      ) : hasBusyAppointment ? (
                        <div className="flex h-full items-center justify-center rounded-xl border border-dashed p-3 text-center text-xs text-muted-foreground">
                          Ocupado
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-full min-h-[62px] w-full rounded-xl border border-dashed text-xs text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
                          style={{
                            borderColor: getSoftColor(doctorColor, 0.35),
                          }}
                          onClick={() =>
                            handleSelectAvailableSlot(
                              doctor.id,
                              slot.startTime,
                              slot.endTime,
                            )
                          }
                        >
                          <Stethoscope className="mr-2 h-4 w-4" />
                          {isSpecialSchedule
                            ? "Disponible especial"
                            : "Disponible"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DailyCalendarView;
