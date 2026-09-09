import { CalendarRange, Clock, Stethoscope, UserPlus } from "lucide-react";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
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

const DEFAULT_DOCTOR_COLOR = "#2563EB";

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

const normalizeHexColor = (color?: string | null) => {
  if (!color) return DEFAULT_DOCTOR_COLOR;

  const trimmedColor = color.trim();

  if (/^#[0-9A-F]{6}$/i.test(trimmedColor)) {
    return trimmedColor;
  }

  return DEFAULT_DOCTOR_COLOR;
};

const hexToRgba = (hex: string, opacity: number) => {
  const normalizedHex = normalizeHexColor(hex).replace("#", "");
  const red = parseInt(normalizedHex.slice(0, 2), 16);
  const green = parseInt(normalizedHex.slice(2, 4), 16);
  const blue = parseInt(normalizedHex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
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
    <Card className="overflow-hidden border-muted/70 shadow-sm">
      <CardHeader className="border-b bg-muted/20 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <CalendarRange className="h-4 w-4" />
          Semana
        </CardTitle>
      </CardHeader>

      <CardContent className="p-3 sm:p-4">
        <div className="grid gap-3 xl:grid-cols-7">
          {weekDays.map((day) => {
            const dayAppointments = appointmentsByDate[day] ?? [];
            const dayBlocks = activeBlocks.filter((block) =>
              isDateWithinRange(day, block.startDate, block.endDate),
            );
            const walkInCount = dayAppointments.filter(
              (appointment) => appointment.appointmentType === "walk_in",
            ).length;

            const isToday = day === today;
            const isSelected = day === selectedDate;

            return (
              <div
                key={day}
                className={[
                  "group rounded-2xl border bg-background/95 p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                  isSelected ? "ring-2 ring-primary/70" : "",
                  isToday ? "border-primary/40 bg-primary/[0.03]" : "",
                ].join(" ")}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="min-w-0 text-left"
                    onClick={() => onSelectDate(day)}
                  >
                    <p
                      className={[
                        "truncate text-sm font-semibold capitalize transition-colors group-hover:text-primary",
                        isToday ? "text-primary" : "",
                      ].join(" ")}
                    >
                      {formatShortDay(day)}
                    </p>

                    <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                      <span>{dayAppointments.length} cita(s)</span>
                      {walkInCount > 0 && <span>· {walkInCount} sin cita</span>}
                      {dayBlocks.length > 0 && (
                        <span>· {dayBlocks.length} bloqueo(s)</span>
                      )}
                    </div>
                  </button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => onSelectDate(day)}
                  >
                    Abrir
                  </Button>
                </div>

                {dayAppointments.length === 0 && dayBlocks.length === 0 ? (
                  <button
                    type="button"
                    className="flex min-h-[92px] w-full items-center justify-center rounded-xl border border-dashed bg-muted/20 p-3 text-center text-xs text-muted-foreground transition-colors hover:bg-muted/40"
                    onClick={() => onSelectDate(day)}
                  >
                    Libre
                  </button>
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
                          className="w-full rounded-xl border border-dashed bg-muted/40 p-2 text-left text-xs transition-all duration-200 hover:bg-muted hover:shadow-sm"
                          onClick={() => onSelectDate(day)}
                        >
                          <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className="px-1.5 py-0 text-[10px]"
                            >
                              Bloqueo
                            </Badge>

                            {block.allDay ? (
                              <Badge
                                variant="secondary"
                                className="px-1.5 py-0 text-[10px]"
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

                          <p className="truncate font-medium">{block.reason}</p>

                          <p className="mt-1 truncate text-muted-foreground">
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
                      const doctorColor = normalizeHexColor(doctor?.color);

                      return (
                        <button
                          key={appointment.id}
                          type="button"
                          className="w-full rounded-xl border p-2 text-left text-xs shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                          style={{
                            backgroundColor: hexToRgba(doctorColor, 0.08),
                            borderColor: hexToRgba(doctorColor, 0.28),
                            borderLeftWidth: 5,
                            borderLeftColor: doctorColor,
                          }}
                          onClick={() => onSelectAppointment(appointment)}
                        >
                          <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant={getStatusVariant(appointment.status)}
                              className="px-1.5 py-0 text-[10px]"
                            >
                              {statusLabels[appointment.status]}
                            </Badge>

                            {appointment.appointmentType === "walk_in" && (
                              <Badge
                                variant="secondary"
                                className="gap-1 px-1.5 py-0 text-[10px]"
                              >
                                <UserPlus className="h-3 w-3" />
                                Sin cita
                              </Badge>
                            )}

                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {appointment.startTime}
                            </span>
                          </div>

                          <p className="truncate font-semibold">
                            {appointment.patientName}
                          </p>

                          <p className="mt-1 truncate text-muted-foreground">
                            {appointment.serviceName || appointment.reason}
                          </p>

                          {appointment.appointmentType === "walk_in" && (
                            <p className="mt-1 truncate text-[11px] text-muted-foreground">
                              Llegó {appointment.arrivalTime || "--:--"}
                              {typeof appointment.waitMinutes === "number"
                                ? ` · ${appointment.waitMinutes} min`
                                : ""}
                            </p>
                          )}

                          <p className="mt-1 inline-flex max-w-full items-center gap-1 text-muted-foreground">
                            <Stethoscope className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {doctor?.nombre ?? "Doctor no encontrado"}
                            </span>
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
