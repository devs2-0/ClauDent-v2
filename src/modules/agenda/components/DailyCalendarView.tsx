import { CalendarClock, Clock, Stethoscope } from "lucide-react";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

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

const timeToMinutes = (time: string) => {
  const [hours = "0", minutes = "0"] = time.split(":");

  return Number(hours) * 60 + Number(minutes);
};

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

  const getDoctorSchedulesForDate = (doctorId: string) => {
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
      if (block.status !== "active") return false;
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
      <Card>
        <CardHeader>
          <CardTitle>Vista diaria</CardTitle>
          <CardDescription>
            Selecciona o registra doctores activos para mostrar el calendario.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No hay doctores activos para mostrar en el calendario.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-5 w-5" />
          Vista diaria
        </CardTitle>

        <CardDescription>
          Agenda visual por hora y doctor. Da clic en una celda disponible para
          preparar una nueva cita.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto rounded-xl border">
          <div
            className="grid min-w-[760px]"
            style={{
              gridTemplateColumns: `90px repeat(${visibleDoctors.length}, minmax(220px, 1fr))`,
            }}
          >
            <div className="sticky left-0 z-20 border-b bg-background p-3 text-xs font-medium text-muted-foreground">
              Hora
            </div>

            {visibleDoctors.map((doctor) => (
              <div
                key={doctor.id}
                className="border-b border-l bg-background p-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-3.5 w-3.5 rounded-full border"
                    style={{
                      backgroundColor: doctor.color || DEFAULT_DOCTOR_COLOR,
                    }}
                  />

                  <div>
                    <p className="text-sm font-medium">{doctor.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {doctor.especialidad || "Sin especialidad"}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {timeSlots.map((slot) => (
              <div key={slot.startTime} className="contents">
                <div className="sticky left-0 z-10 border-b bg-background p-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {slot.startTime}
                  </div>
                </div>

                {visibleDoctors.map((doctor) => {
                  const schedule = getDoctorScheduleForSlot(
                    doctor.id,
                    slot.startTime,
                    slot.endTime,
                  );

                  const isSpecialSchedule = schedule?.scheduleType === "special";

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
                        "min-h-[88px] border-b border-l p-2 transition-colors",
                        !schedule ? "bg-muted/30" : "",
                        block ? "bg-muted/60" : "",
                        isAvailable ? "bg-background hover:bg-muted/30" : "",
                      ].join(" ")}
                    >
                      {appointment ? (
                        <button
                          type="button"
                          className="w-full rounded-lg border bg-background p-3 text-left text-sm shadow-sm transition hover:bg-muted/30"
                          style={{
                            borderLeftWidth: 5,
                            borderLeftColor:
                              doctor.color || DEFAULT_DOCTOR_COLOR,
                          }}
                          onClick={() => onSelectAppointment?.(appointment)}
                        >
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Badge
                              variant={getStatusVariant(appointment.status)}
                            >
                              {statusLabels[appointment.status]}
                            </Badge>

                            <span className="text-xs text-muted-foreground">
                              {appointment.startTime} - {appointment.endTime}
                            </span>
                          </div>

                          <p className="font-medium">
                            {appointment.patientName}
                          </p>

                          <p className="mt-1 text-xs text-muted-foreground">
                            {appointment.serviceName || appointment.reason}
                          </p>
                        </button>
                      ) : block ? (
                        <div className="rounded-lg border border-dashed p-3 text-sm">
                          <Badge variant="secondary">Bloqueado</Badge>

                          <p className="mt-2 font-medium">{block.reason}</p>

                          <p className="mt-1 text-xs text-muted-foreground">
                            {block.allDay
                              ? "Todo el día"
                              : `${block.startTime} - ${block.endTime}`}
                          </p>
                        </div>
                      ) : !schedule ? (
                        <div className="flex h-full items-center justify-center rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                          Fuera de horario
                        </div>
                      ) : hasBusyAppointment ? (
                        <div className="flex h-full items-center justify-center rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                          Ocupado
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-full min-h-[64px] w-full border border-dashed text-xs text-muted-foreground"
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