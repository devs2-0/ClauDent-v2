import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { toast } from "sonner";

import { useCan } from "@/auth";
import { usePatientInactivitySettings } from "@/modules/patients/hooks/usePatientInactivitySettings";
import { SectionHelp } from "@/shared/components/SectionHelp";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

const PatientInactivitySettings = () => {
  const { can } = useCan();
  const { inactivityDays, updateInactivityDays } = usePatientInactivitySettings();
  const [daysInput, setDaysInput] = useState(String(inactivityDays));
  const canUpdateSettings = can("settings.update");

  useEffect(() => {
    setDaysInput(String(inactivityDays));
  }, [inactivityDays]);

  const handleSave = () => {
    const parsedDays = Number(daysInput);
    if (!Number.isFinite(parsedDays) || parsedDays < 1 || parsedDays > 3650) {
      toast.error("Ingresa un periodo entre 1 y 3650 días.");
      return;
    }

    const savedDays = updateInactivityDays(parsedDays);
    setDaysInput(String(savedDays));
    toast.success("Periodo de inactividad actualizado.");
  };

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Clock3 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <CardTitle className="text-lg">Inactividad de pacientes</CardTitle>
                <SectionHelp title="Inactividad de pacientes">
                  <p>
                    El filtro toma la última cita atendida o procedimiento registrado. Si aún no existe actividad, utiliza la fecha de registro del paciente.
                  </p>
                  <p>
                    Esta preferencia se conserva en este dispositivo porque actualmente no existe una configuración general compatible en Firestore.
                  </p>
                </SectionHelp>
              </div>
              <CardDescription>Periodo usado por el filtro del directorio.</CardDescription>
            </div>
          </div>
          <Badge variant="secondary">{inactivityDays} días</Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full space-y-2 sm:max-w-52">
            <Label htmlFor="patient-inactivity-days">Días sin actividad</Label>
            <Input
              id="patient-inactivity-days"
              type="number"
              min={1}
              max={3650}
              step={1}
              value={daysInput}
              onChange={(event) => setDaysInput(event.target.value)}
              disabled={!canUpdateSettings}
            />
          </div>
          <Button type="button" onClick={handleSave} disabled={!canUpdateSettings}>
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PatientInactivitySettings;
