import { Ban, CalendarPlus, Clock, Sparkles } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";

import type { Doctor } from "../types/agenda.types";

export interface CalendarSlotSelection {
  doctorId: string;
  startDate: string;
  startTime: string;
  endTime: string;
}

interface CalendarSlotActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: CalendarSlotSelection | null;
  doctor?: Doctor;
  canCreateAppointment: boolean;
  canCreateBlock: boolean;
  onCreateAppointment: () => void;
  onCreateBlock: () => void;
}

const CalendarSlotActionDialog = ({
  open,
  onOpenChange,
  slot,
  doctor,
  canCreateAppointment,
  canCreateBlock,
  onCreateAppointment,
  onCreateBlock,
}: CalendarSlotActionDialogProps) => {
  if (!slot) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>¿Qué deseas agregar?</DialogTitle>
          <DialogDescription>
            Selecciona qué acción quieres realizar en este horario.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border bg-muted/30 p-4">
          <p className="text-sm font-medium">
            {doctor?.nombre ?? "Doctor seleccionado"}
          </p>

          <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {slot.startDate} · {slot.startTime} - {slot.endTime}
          </p>
        </div>

        <div className="grid gap-3">
          <Button
            variant="outline"
            className="h-auto justify-start gap-3 p-4 text-left"
            disabled={!canCreateAppointment}
            onClick={onCreateAppointment}
          >
            <CalendarPlus className="h-5 w-5" />

            <span>
              <span className="block font-medium">Nueva cita</span>
              <span className="block text-xs text-muted-foreground">
                Agenda un paciente en este horario.
              </span>
            </span>
          </Button>

          <Button
            variant="outline"
            className="h-auto justify-start gap-3 p-4 text-left"
            disabled={!canCreateBlock}
            onClick={onCreateBlock}
          >
            <Ban className="h-5 w-5" />

            <span>
              <span className="block font-medium">Bloquear horario</span>
              <span className="block text-xs text-muted-foreground">
                Marca este espacio como no disponible.
              </span>
            </span>
          </Button>

          <Button
            variant="outline"
            className="h-auto justify-start gap-3 p-4 text-left"
            disabled
          >
            <Sparkles className="h-5 w-5" />

            <span>
              <span className="block font-medium">Horario especial</span>
              <span className="block text-xs text-muted-foreground">
                Próximamente: cambiar entrada/salida solo para este día.
              </span>
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CalendarSlotActionDialog;