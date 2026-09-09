import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  Hourglass,
  Stethoscope,
  UserCheck,
  UserPlus,
  UserRound,
  XCircle,
} from "lucide-react";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";

import type { Appointment, AppointmentStatus } from "../types/agenda.types";

interface AppointmentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  doctorName: string;
  assistantNames: string[];
  walkInAssistantName?: string;
  canUpdate: boolean;
  canCancel: boolean;
  saving: boolean;
  onEdit: (appointment: Appointment) => void;
  onChangeStatus: (
    appointment: Appointment,
    status: AppointmentStatus,
  ) => Promise<void>;
}

const statusLabels: Record<AppointmentStatus, string> = {
  scheduled: "Programada",
  confirmed: "Confirmada",
  completed: "Atendida",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

const getStatusVariant = (status: AppointmentStatus) => {
  if (status === "cancelled") return "destructive";
  if (status === "completed") return "secondary";
  if (status === "confirmed") return "default";

  return "outline";
};

const AppointmentDetailsDialog = ({
  open,
  onOpenChange,
  appointment,
  doctorName,
  assistantNames,
  walkInAssistantName,
  canUpdate,
  canCancel,
  saving,
  onEdit,
  onChangeStatus,
}: AppointmentDetailsDialogProps) => {
  if (!appointment) return null;

  const isWalkIn = appointment.appointmentType === "walk_in";

  const canStillChange =
    appointment.status !== "cancelled" && appointment.status !== "completed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isWalkIn ? "Detalle sin cita" : "Detalle de cita"}
          </DialogTitle>
          <DialogDescription>
            Consulta la información de la cita y actualiza su estado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getStatusVariant(appointment.status)}>
                {statusLabels[appointment.status]}
              </Badge>

              {isWalkIn && (
                <Badge variant="secondary" className="gap-1">
                  <UserPlus className="h-3.5 w-3.5" />
                  Sin cita
                </Badge>
              )}

              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {appointment.startDate} · {appointment.startTime} -{" "}
                {appointment.endTime}
              </span>
            </div>

            <h3 className="mt-3 text-lg font-semibold">
              {appointment.patientName}
            </h3>

            <p className="mt-1 text-sm text-muted-foreground">
              {appointment.serviceName || appointment.reason || "Sin servicio"}
            </p>

            {appointment.reason && appointment.serviceName && (
              <p className="mt-1 text-xs text-muted-foreground">
                Motivo: {appointment.reason}
              </p>
            )}

            {isWalkIn && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {appointment.arrivalTime && (
                  <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-1">
                    <Clock className="h-3.5 w-3.5" />
                    Llegada: {appointment.arrivalTime}
                  </span>
                )}

                {typeof appointment.waitMinutes === "number" && (
                  <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-1">
                    <Hourglass className="h-3.5 w-3.5" />
                    Espera estimada: {appointment.waitMinutes} min
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Stethoscope className="h-4 w-4" />
                Doctor
              </p>

              <p className="text-sm text-muted-foreground">{doctorName}</p>
            </div>

            <div className="rounded-xl border p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                <UserCheck className="h-4 w-4" />
                Asistentes
              </p>

              <p className="text-sm text-muted-foreground">
                {assistantNames.length > 0
                  ? assistantNames.join(", ")
                  : "Sin asistentes asignados"}
              </p>
            </div>

            {isWalkIn && (
              <div className="rounded-xl border p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <UserPlus className="h-4 w-4" />
                  Responsable
                </p>

                <p className="text-sm text-muted-foreground">
                  {walkInAssistantName || "Sin responsable asignado"}
                </p>
              </div>
            )}

            <div className="rounded-xl border p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                <UserRound className="h-4 w-4" />
                Expediente
              </p>

              <p className="text-sm text-muted-foreground">
                {appointment.patientId
                  ? "Paciente vinculado a expediente"
                  : "Paciente escrito manualmente"}
              </p>
            </div>

            <div className="rounded-xl border p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                <CalendarCheck className="h-4 w-4" />
                Servicio
              </p>

              <p className="text-sm text-muted-foreground">
                {appointment.serviceId
                  ? "Servicio vinculado al catálogo"
                  : "Servicio escrito manualmente"}
              </p>
            </div>
          </div>

          {appointment.notes && (
            <div className="rounded-xl border p-4">
              <p className="mb-2 text-sm font-medium">Notas internas</p>
              <p className="text-sm text-muted-foreground">
                {appointment.notes}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-between">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cerrar
          </Button>

          <div className="flex flex-wrap gap-2">
            {canUpdate && appointment.status !== "cancelled" && (
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => onEdit(appointment)}
              >
                Editar cita
              </Button>
            )}

            {appointment.status === "scheduled" && canUpdate && (
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => void onChangeStatus(appointment, "confirmed")}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Confirmar
              </Button>
            )}

            {canStillChange && canUpdate && (
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => void onChangeStatus(appointment, "completed")}
              >
                Marcar atendida
              </Button>
            )}

            {canStillChange && canUpdate && (
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => void onChangeStatus(appointment, "no_show")}
              >
                No asistió
              </Button>
            )}

            {appointment.status !== "cancelled" && canCancel && (
              <Button
                variant="destructive"
                disabled={saving}
                onClick={() => void onChangeStatus(appointment, "cancelled")}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentDetailsDialog;
