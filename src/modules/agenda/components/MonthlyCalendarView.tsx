import { CalendarDays, Clock, UserPlus } from "lucide-react";
import { formatTime } from "@/shared/utils/time";

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
import {
  fromDateInputValue,
  getMonthGridDays,
} from "../utils/calendarDateUtils";

interface MonthlyCalendarViewProps {
  selectedDate: string;
  appointments: Appointment[];
  blocks: AgendaBlock[];
  doctors: Doctor[];
  onSelectDate: (date: string) => void;
  onSelectAppointment: (appointment: Appointment) => void;
}

const weekdayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

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

const MonthlyCalendarView = ({
  selectedDate,
  appointments,
  blocks,
  doctors,
  onSelectDate,
  onSelectAppointment,
}: MonthlyCalendarViewProps) => {
  const monthGrid = getMonthGridDays(selectedDate);
  const today = new Date().toISOString().slice(0, 10);

  const doctorsById = new Map(doctors.map((doctor) => [doctor.id, doctor]));

  const appointmentsByDate = appointments.reduce<Record<string, Appointment[]>>(
    (accumulator, appointment) => {
      if (!appointment?.startDate) return accumulator;
      if (!accumulator[appointment.startDate]) {
        accumulator[appointment.startDate] = [];
      }

      accumulator[appointment.startDate].push(appointment);

      return accumulator;
    },
    {},
  );

  const activeBlocks = blocks.filter((block) => block?.status === "active");

  return (
    <Card className="rounded-none border-0 shadow-none">
      <CardHeader className="border-b bg-muted/20 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="h-4 w-4" />
          Mes
        </CardTitle>
      </CardHeader>

      <CardContent className="p-3 sm:p-4">
        <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
          <div className="grid grid-cols-7 border-b bg-muted/40">
            {weekdayLabels.map((label) => (
              <div
                key={label}
                className="border-r p-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground last:border-r-0 sm:p-3"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {monthGrid.days.map((day) => {
              const dayAppointments = appointmentsByDate[day] ?? [];
              const dayBlocks = activeBlocks.filter((block) =>
                isDateWithinRange(day, block.startDate, block.endDate),
              );
              const walkInCount = dayAppointments.filter(
                (appointment) => appointment.appointmentType === "walk_in",
              ).length;

              const date = fromDateInputValue(day);
              const isCurrentMonth = date.getMonth() === monthGrid.month;
              const isToday = day === today;
              const isSelected = day === selectedDate;

              const visibleBlocks = dayBlocks.slice(0, 1);
              const remainingAppointmentSlots = Math.max(
                4 - visibleBlocks.length,
                0,
              );
              const visibleAppointments = dayAppointments.slice(
                0,
                remainingAppointmentSlots,
              );

              const hiddenCount =
                dayBlocks.length +
                dayAppointments.length -
                visibleBlocks.length -
                visibleAppointments.length;

              return (
                <div
                  key={day}
                  className={[
                    "group min-h-[150px] border-b border-r p-2 align-top transition-colors duration-200 hover:bg-muted/20",
                    !isCurrentMonth ? "bg-muted/10 text-muted-foreground" : "",
                    isSelected ? "ring-2 ring-primary ring-inset" : "",
                  ].join(" ")}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className={[
                        "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all duration-200 hover:scale-105 hover:bg-muted",
                        isToday ? "bg-primary text-primary-foreground shadow-sm" : "",
                      ].join(" ")}
                      onClick={() => onSelectDate(day)}
                    >
                      {date.getDate()}
                    </button>

                    <div className="flex flex-wrap justify-end gap-1">
                      {walkInCount > 0 && (
                        <Badge
                          variant="secondary"
                          className="gap-1 px-1.5 py-0 text-[10px]"
                        >
                          <UserPlus className="h-3 w-3" />
                          {walkInCount}
                        </Badge>
                      )}

                      {(dayAppointments.length > 0 || dayBlocks.length > 0) && (
                        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                          {dayAppointments.length + dayBlocks.length}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {visibleBlocks.map((block) => {
                      const doctor =
                        block.staffType === "doctor"
                          ? doctorsById.get(block.staffId)
                          : undefined;

                      return (
                        <button
                          key={block.id}
                          type="button"
                          className="w-full rounded-lg border border-dashed bg-muted/40 px-2 py-1.5 text-left text-xs transition-all duration-200 hover:bg-muted hover:shadow-sm"
                          onClick={() => onSelectDate(day)}
                        >
                          <div className="flex items-center gap-1.5">
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
                                Día
                              </Badge>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {formatTime(block?.startTime)}
                              </span>
                            )}
                          </div>

                          <p className="mt-1 truncate font-medium">
                            {block.reason}
                          </p>

                          <p className="truncate text-muted-foreground">
                            {doctor?.nombre ??
                              (block.staffType === "assistant"
                                ? "Asistente"
                                : "Doctor")}
                          </p>
                        </button>
                      );
                    })}

                    {visibleAppointments.map((appointment) => {
                      const doctor = doctorsById.get(appointment.doctorId);
                      const doctorColor = normalizeHexColor(doctor?.color);

                      return (
                        <button
                          key={appointment.id}
                          type="button"
                          className="w-full rounded-lg border px-2 py-1.5 text-left text-xs shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                          style={{
                            backgroundColor: hexToRgba(doctorColor, 0.08),
                            borderColor: hexToRgba(doctorColor, 0.26),
                            borderLeftWidth: 4,
                            borderLeftColor: doctorColor,
                          }}
                          onClick={() => onSelectAppointment(appointment)}
                        >
                          <div className="flex items-center gap-1.5">
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
                                W
                              </Badge>
                            )}
                          </div>

                          <p className="mt-1 truncate font-semibold">
                            {formatTime(appointment?.startTime)} · {appointment.patientName}
                          </p>

                          <div className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: doctorColor }}
                            />
                            <p className="truncate">
                              {doctor?.nombre ?? "Sin doctor"}
                            </p>
                          </div>
                        </button>
                      );
                    })}

                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        className="rounded-md px-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        onClick={() => onSelectDate(day)}
                      >
                        +{hiddenCount} más
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={() => onSelectDate(selectedDate)}>
            Ver día seleccionado
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MonthlyCalendarView;
