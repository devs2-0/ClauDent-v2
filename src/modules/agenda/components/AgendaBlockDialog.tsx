import { useEffect, useState } from "react";
import { Ban } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";

import type { Doctor } from "../types/agenda.types";
import type { CalendarSlotSelection } from "./CalendarSlotActionDialog";

export interface AgendaBlockFormState {
  reason: string;
  notes: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
}

interface AgendaBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: CalendarSlotSelection | null;
  doctor?: Doctor;
  saving: boolean;
  onSubmit: (form: AgendaBlockFormState) => Promise<void>;
}

const emptyBlockForm: AgendaBlockFormState = {
  reason: "",
  notes: "",
  allDay: false,
  startTime: "09:00",
  endTime: "09:30",
};

const AgendaBlockDialog = ({
  open,
  onOpenChange,
  slot,
  doctor,
  saving,
  onSubmit,
}: AgendaBlockDialogProps) => {
  const [form, setForm] = useState<AgendaBlockFormState>(emptyBlockForm);

  useEffect(() => {
    if (!open || !slot) return;

    setForm({
      reason: "",
      notes: "",
      allDay: false,
      startTime: slot.startTime,
      endTime: slot.endTime,
    });
  }, [open, slot]);

  if (!slot) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Bloquear horario</DialogTitle>
          <DialogDescription>
            Marca este horario como no disponible para evitar que se agenden
            citas encima.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border bg-muted/30 p-4">
          <p className="text-sm font-medium">
            {doctor?.nombre ?? "Doctor seleccionado"}
          </p>

          <p className="text-xs text-muted-foreground">
            {slot.startDate} ·{" "}
            {form.allDay ? "Todo el día" : `${form.startTime} - ${form.endTime}`}
          </p>
        </div>

        <div className="grid gap-4">
          <label className="flex items-center gap-3 rounded-lg border p-3">
            <Checkbox
              checked={form.allDay}
              onCheckedChange={(checked) =>
                setForm((current) => ({
                  ...current,
                  allDay: checked === true,
                }))
              }
            />

            <span className="text-sm">Bloquear todo el día</span>
          </label>

          {!form.allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="block-start-time">Inicio</Label>
                <Input
                  id="block-start-time"
                  type="time"
                  value={form.startTime}
                  onChange={(event) =>
                    setForm((current) => ({
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
                  value={form.endTime}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      endTime: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="block-reason">Motivo *</Label>
            <Input
              id="block-reason"
              value={form.reason}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
              placeholder="Ej. Curso, comida, permiso, junta"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="block-notes">Notas</Label>
            <Textarea
              id="block-notes"
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="Detalles internos opcionales."
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>

          <Button
            variant="destructive"
            onClick={() => void onSubmit(form)}
            disabled={saving}
          >
            <Ban className="mr-2 h-4 w-4" />
            {saving ? "Guardando..." : "Bloquear horario"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AgendaBlockDialog;