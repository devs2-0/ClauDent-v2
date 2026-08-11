import { CalendarRange, Clock, Stethoscope } from "lucide-react";

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
  Doctor,
} from "../types/agenda.types";
import { formatShortDay, getWeekDays } from "../utils/calendarDateUtils";

interface WeeklyCalendarViewProps {
  selectedDate: string;
  appointments: Appointment[];
  blocks: AgendaBlock[];
  doctors: Doctor[];
  onSelectDate: (date: string) => void;
  onSelectAppointment: (appointment: Appointment) => void;
}

const statusLabels: Record<AppointmentStatus, string> = {
  scheduled: "Programada",
  confirmed: "Confirmada",
  completed: "Atendida",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

const getStatusVariant = (
  status: AppointmentStatus,
): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "cancelled") return "destructive";
  if (status === "completed") return "secondary";
  if (status === "confirmed") return "default";

  return "outline";
};

const isDateWithinRange = (date: string, startDate: string, endDate: string) => {
  return date >= startDate && date <= endDate;
};

const WeeklyCalendarView = ({
  selectedDate,
  appointments,
  blocks,
  doctors,
  onSelectDate,
  onSelectAppointment,
}: WeeklyCalendarViewProps) => {
  const weekDays = getWeekDays(selectedDate);
  const today = new Date().toISOString().slice(0, 10);
  const doctorsById = new Map(doctors.map((doctor) => [doctor.id, doctor]));

  const appointmentsByDate = appointments.reduce<Record<string, Appointment[]>>(
    (accumulator, appointment) => {
      if (!accumulator[appointment.startDate]) {
        accumulator[appointment.startDate] = [];
      }

      accumulator[appointment.startDate].push(appointment);

      return accumulator;
    },
    {},
  );

  const activeBlocks = blocks.filter((block) => block.status === "active");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarRange className="h-5 w-5" />
          Vista semanal
        </CardTitle>
        <CardDescription>
          Resumen de lunes a domingo. Da clic en una cita para ver su detalle.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="grid gap-4 xl:grid-cols-7">
          {weekDays.map((day) => {
            const dayAppointments = appointmentsByDate[day] ?? [];
            const dayBlocks = activeBlocks.filter((block) =>
              isDateWithinRange(day, block.startDate, block.endDate),
            );

            const isToday = day === today;
            const isSelected = day === selectedDate;

            return (
              <div
                key={day}
                className={[
                  "rounded-xl border bg-background p-3",
                  isSelected ? "ring-2 ring-primary" : "",
                ].join(" ")}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <p
                      className={[
                        "text-sm font-semibold capitalize",
                        isToday ? "text-primary" : "",
                      ].join(" ")}
                    >
                      {formatShortDay(day)}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {dayAppointments.length} cita(s) · {dayBlocks.length}{" "}
                      bloqueo(s)
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelectDate(day)}
                  >
                    Ver día
                  </Button>
                </div>

                {dayAppointments.length === 0 && dayBlocks.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                    Sin citas ni bloqueos
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dayBlocks.map((block) => {
                      const doctor =
                        block.staffType === "doctor"
                          ? doctorsById.get(block.staffId)
                          : undefined;

                      return (
                        <button
                          key={block.id}
                          type="button"
                          className="w-full rounded-lg border border-dashed bg-muted/40 p-2 text-left text-xs transition hover:bg-muted"
                          onClick={() => onSelectDate(day)}
                        >
                          <div className="mb-1 flex flex-wrap items-center gap-1">
                            <Badge
                              variant="outline"
                              className="px-1 py-0 text-[10px]"
                            >
                              Bloqueo
                            </Badge>

                            {block.allDay ? (
                              <Badge
                                variant="secondary"
                                className="px-1 py-0 text-[10px]"
                              >
                                Todo el día
                              </Badge>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {block.startTime}
                              </span>
                            )}
                          </div>

                          <p className="font-medium">{block.reason}</p>

                          <p className="mt-1 text-muted-foreground">
                            {doctor?.nombre ??
                              (block.staffType === "assistant"
                                ? "Asistente"
                                : "Doctor")}
                          </p>
                        </button>
                      );
                    })}

                    {dayAppointments.map((appointment) => {
                      const doctor = doctorsById.get(appointment.doctorId);

                      return (
                        <button
                          key={appointment.id}
                          type="button"
                          className="w-full rounded-lg border p-2 text-left text-xs transition hover:bg-muted/40"
                          onClick={() => onSelectAppointment(appointment)}
                        >
                          <div className="mb-1 flex flex-wrap items-center gap-1">
                            <Badge
                              variant={getStatusVariant(appointment.status)}
                              className="px-1 py-0 text-[10px]"
                            >
                              {statusLabels[appointment.status]}
                            </Badge>

                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {appointment.startTime}
                            </span>
                          </div>

                          <p className="font-medium">
                            {appointment.patientName}
                          </p>

                          <p className="mt-1 text-muted-foreground">
                            {appointment.serviceName || appointment.reason}
                          </p>

                          <p className="mt-1 inline-flex items-center gap-1 text-muted-foreground">
                            <Stethoscope className="h-3 w-3" />
                            {doctor?.nombre ?? "Doctor no encontrado"}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklyCalendarView;