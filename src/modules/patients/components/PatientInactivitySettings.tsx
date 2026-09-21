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
import { Switch } from "@/shared/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { durationUnitLabels, patientDurationUnits, type DurationUnit } from "@/shared/utils/duration";

const PatientInactivitySettings = () => {
  const { can } = useCan();
  const { settings, updateSettings } = usePatientInactivitySettings();
  const [daysInput, setDaysInput] = useState(String(settings.value));
  const [unit, setUnit] = useState<DurationUnit>(settings.unit);
  const [enabled, setEnabled] = useState(settings.enabled);
  const canUpdateSettings = can("settings.update");

  useEffect(() => {
    setDaysInput(String(settings.value));
    setUnit(settings.unit);
    setEnabled(settings.enabled);
  }, [settings]);

  const handleSave = () => {
    if (!canUpdateSettings) return;
    const parsedDays = Number(daysInput);
    if (!Number.isSafeInteger(parsedDays) || parsedDays < 1 || parsedDays > 3650) {
      toast.error("Ingresa un número entero entre 1 y 3650.");
      return;
    }

    try {
      updateSettings({ value: parsedDays, unit, enabled });
      toast.success("Periodo de inactividad actualizado.");
    } catch {
      toast.error("No se pudo guardar la configuración en este dispositivo.");
    }
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
                    Los avisos toman la última cita atendida, procedimiento o consulta odontológica capturada, según tus permisos. Si no hay actividad disponible, usan la fecha de registro e indican esa fuente. La sugerencia inicial es de 4 meses.
                  </p>
                  <p>
                    Esta preferencia se conserva en este dispositivo porque actualmente no existe una configuración general compatible en Firestore.
                  </p>
                </SectionHelp>
              </div>
              <CardDescription>Avisos de pacientes sin revisión. Se guarda en este dispositivo.</CardDescription>
            </div>
          </div>
          <Badge variant="secondary">{settings.value} {durationUnitLabels[settings.unit].toLocaleLowerCase('es')}</Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="mb-4 flex items-center gap-2">
          <Switch id="patient-inactivity-enabled" checked={enabled} onCheckedChange={setEnabled} disabled={!canUpdateSettings} />
          <Label htmlFor="patient-inactivity-enabled">Avisar sobre pacientes sin revisión</Label>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full space-y-2 sm:max-w-52">
            <Label htmlFor="patient-inactivity-days">Duración sin actividad</Label>
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
          <div className="space-y-2 sm:w-40">
            <Label htmlFor="patient-inactivity-unit">Unidad</Label>
            <Select value={unit} onValueChange={(value) => setUnit(value as DurationUnit)} disabled={!canUpdateSettings}>
              <SelectTrigger id="patient-inactivity-unit"><SelectValue /></SelectTrigger>
              <SelectContent>{patientDurationUnits.map((value) => <SelectItem key={value} value={value}>{durationUnitLabels[value]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {canUpdateSettings && <Button type="button" onClick={handleSave}>Guardar</Button>}
        </div>
      </CardContent>
    </Card>
  );
};

export default PatientInactivitySettings;
