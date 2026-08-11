import { CalendarDays } from "lucide-react";

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
          <CalendarDays className="h-5 w-5" />
          Vista mensual
        </CardTitle>
        <CardDescription>
          Resumen general del mes. Da clic en un día para abrirlo o en una cita
          para ver su detalle.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="overflow-hidden rounded-xl border">
          <div className="grid grid-cols-7 border-b bg-muted/40">
            {weekdayLabels.map((label) => (
              <div
                key={label}
                className="border-r p-3 text-center text-xs font-medium text-muted-foreground last:border-r-0"
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

              const date = fromDateInputValue(day);
              const isCurrentMonth = date.getMonth() === monthGrid.month;
              const isToday = day === today;

              const visibleBlocks = dayBlocks.slice(0, 2);
              const remainingAppointmentSlots = Math.max(
                3 - visibleBlocks.length,
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
                    "min-h-[140px] border-b border-r p-2 align-top",
                    !isCurrentMonth ? "bg-muted/20 text-muted-foreground" : "",
                    day === selectedDate ? "ring-2 ring-primary ring-inset" : "",
                  ].join(" ")}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className={[
                        "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium hover:bg-muted",
                        isToday ? "bg-primary text-primary-foreground" : "",
                      ].join(" ")}
                      onClick={() => onSelectDate(day)}
                    >
                      {date.getDate()}
                    </button>

                    {(dayAppointments.length > 0 || dayBlocks.length > 0) && (
                      <Badge variant="secondary">
                        {dayAppointments.length + dayBlocks.length}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1">
                    {visibleBlocks.map((block) => {
                      const doctor =
                        block.staffType === "doctor"
                          ? doctorsById.get(block.staffId)
                          : undefined;

                      return (
                        <button
                          key={block.id}
                          type="button"
                          className="w-full rounded-md border border-dashed bg-muted/40 px-2 py-1 text-left text-xs transition hover:bg-muted"
                          onClick={() => onSelectDate(day)}
                        >
                          <div className="flex items-center gap-1">
                            <Badge
                              variant="outline"
                              className="px-1 py-0 text-[10px]"
                            >
                              Bloqueo
                            </Badge>

                            {block.allDay && (
                              <Badge
                                variant="secondary"
                                className="px-1 py-0 text-[10px]"
                              >
                                Todo el día
                              </Badge>
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

                      return (
                        <button
                          key={appointment.id}
                          type="button"
                          className="w-full rounded-md border bg-background px-2 py-1 text-left text-xs shadow-sm transition hover:bg-muted/40"
                          onClick={() => onSelectAppointment(appointment)}
                        >
                          <div className="flex items-center gap-1">
                            <Badge
                              variant={getStatusVariant(appointment.status)}
                              className="px-1 py-0 text-[10px]"
                            >
                              {statusLabels[appointment.status]}
                            </Badge>
                          </div>

                          <p className="mt-1 truncate font-medium">
                            {appointment.startTime} · {appointment.patientName}
                          </p>

                          <p className="truncate text-muted-foreground">
                            {doctor?.nombre ?? "Sin doctor"}
                          </p>
                        </button>
                      );
                    })}

                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground"
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
          <Button variant="outline" onClick={() => onSelectDate(selectedDate)}>
            Ver día seleccionado
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MonthlyCalendarView;