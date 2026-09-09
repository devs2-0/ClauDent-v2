import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { CalendarCheck, UserPlus } from "lucide-react";

import { Badge } from "@/shared/components/ui/badge";
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

import type { PatientLookup } from "../services/patientLookupService";
import type { ServiceLookup } from "../services/serviceLookupService";
import type {
  AppointmentType,
  Assistant,
  Doctor,
} from "../types/agenda.types";
import SearchableSelect, {
  type SearchableSelectOption,
} from "./SearchableSelect";

export interface AppointmentFormState {
  patientId: string | null;
  patientName: string;
  serviceId: string | null;
  serviceName: string;
  doctorId: string;
  assistantIds: string[];
  startDate: string;
  startTime: string;
  endTime: string;
  reason: string;
  notes: string;
  appointmentType: AppointmentType;
  arrivalTime: string;
  waitMinutes: number | null;
  walkInAssistantId: string | null;
}

interface AppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: AppointmentFormState;
  setForm: Dispatch<SetStateAction<AppointmentFormState>>;
  patients: PatientLookup[];
  services: ServiceLookup[];
  doctors: Doctor[];
  assistants: Assistant[];
  saving: boolean;
  title?: string;
  description?: string;
  submitLabel?: string;
  onSubmit: () => Promise<void>;
}

const getWaitMinutes = (arrivalTime: string, startTime: string) => {
  if (!arrivalTime || !startTime) return null;

  const [arrivalHours = "0", arrivalMinutes = "0"] = arrivalTime.split(":");
  const [startHours = "0", startMinutes = "0"] = startTime.split(":");

  const arrivalTotal = Number(arrivalHours) * 60 + Number(arrivalMinutes);
  const startTotal = Number(startHours) * 60 + Number(startMinutes);

  const diff = startTotal - arrivalTotal;

  return diff > 0 ? diff : 0;
};

const addMinutesToTime = (time: string, minutesToAdd: number) => {
  const [hours = "0", minutes = "0"] = time.split(":");
  const totalMinutes = Number(hours) * 60 + Number(minutes) + minutesToAdd;
  const normalizedMinutes = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59));
  const nextHours = Math.floor(normalizedMinutes / 60);
  const nextMinutes = normalizedMinutes % 60;

  return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(
    2,
    "0",
  )}`;
};

const AppointmentDialog = ({
  open,
  onOpenChange,
  form,
  setForm,
  patients,
  services,
  doctors,
  assistants,
  saving,
  title = "Nueva cita",
  description = "Busca paciente y servicio desde los catálogos existentes. También puedes escribirlos manualmente cuando todavía no estén registrados.",
  submitLabel = "Crear cita",
  onSubmit,
}: AppointmentDialogProps) => {
  const [assistantSearch, setAssistantSearch] = useState("");

  const patientOptions = useMemo<SearchableSelectOption[]>(() => {
    return patients.map((patient) => ({
      value: patient.id,
      label: patient.nombreCompleto || "Paciente sin nombre",
      description: [
        patient.telefonoPrincipal,
        patient.correo,
        patient.estado === "inactivo" ? "Inactivo" : "",
      ]
        .filter(Boolean)
        .join(" · "),
      searchText: patient.searchText,
      disabled: patient.estado === "inactivo",
    }));
  }, [patients]);

  const serviceOptions = useMemo<SearchableSelectOption[]>(() => {
    return services.map((service) => ({
      value: service.id,
      label: service.nombre,
      description: [
        service.codigo,
        service.categoria,
        service.precio > 0 ? `$${service.precio.toFixed(2)}` : "",
        service.estado === "inactivo" ? "Inactivo" : "",
      ]
        .filter(Boolean)
        .join(" · "),
      searchText: service.searchText,
      disabled: service.estado === "inactivo",
    }));
  }, [services]);

  const doctorOptions = useMemo<SearchableSelectOption[]>(() => {
    return doctors.map((doctor) => ({
      value: doctor.id,
      label: doctor.nombre,
      description: doctor.especialidad || "Sin especialidad",
      searchText: [
        doctor.nombre,
        doctor.email ?? "",
        doctor.telefono ?? "",
        doctor.especialidad ?? "",
      ].join(" "),
    }));
  }, [doctors]);

  const selectedDoctor = doctors.find((doctor) => doctor.id === form.doctorId);
  const selectedPatient = patients.find(
    (patient) => patient.id === form.patientId,
  );
  const selectedService = services.find(
    (service) => service.id === form.serviceId,
  );

  const isWalkIn = form.appointmentType === "walk_in";

  const availableAssistants = useMemo(() => {
    return assistants.filter((assistant) => {
      if (!form.doctorId) return true;

      return (
        assistant.doctorIdsAsignados.length === 0 ||
        assistant.doctorIdsAsignados.includes(form.doctorId)
      );
    });
  }, [assistants, form.doctorId]);

  const assistantOptions = useMemo<SearchableSelectOption[]>(() => {
    return availableAssistants.map((assistant) => ({
      value: assistant.id,
      label: assistant.nombre,
      description:
        assistant.doctorIdsAsignados.length > 0
          ? `${assistant.doctorIdsAsignados.length} doctor(es) asignado(s)`
          : "Sin doctores asignados",
      searchText: [
        assistant.nombre,
        assistant.email ?? "",
        assistant.telefono ?? "",
        assistant.notas ?? "",
      ].join(" "),
    }));
  }, [availableAssistants]);

  const filteredAssistants = useMemo(() => {
    const query = assistantSearch.trim().toLowerCase();

    if (!query) return availableAssistants;

    return availableAssistants.filter((assistant) => {
      return [
        assistant.nombre,
        assistant.email ?? "",
        assistant.telefono ?? "",
        assistant.notas ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [assistantSearch, availableAssistants]);

  const selectedAssistantItems = form.assistantIds
    .map((assistantId) =>
      assistants.find((assistant) => assistant.id === assistantId),
    )
    .filter((assistant): assistant is Assistant => Boolean(assistant));

  const selectedWalkInAssistant = assistants.find(
    (assistant) => assistant.id === form.walkInAssistantId,
  );

  const toggleAssistant = (assistantId: string) => {
    setForm((current) => {
      const exists = current.assistantIds.includes(assistantId);

      return {
        ...current,
        assistantIds: exists
          ? current.assistantIds.filter((id) => id !== assistantId)
          : [...current.assistantIds, assistantId],
      };
    });
  };

  const handleSelectPatient = (
    patientId: string,
    option?: SearchableSelectOption,
  ) => {
    const patient = patients.find((item) => item.id === patientId);

    setForm((current) => ({
      ...current,
      patientId: patientId || null,
      patientName:
        patient?.nombreCompleto || option?.label || current.patientName,
    }));
  };

  const handleManualPatient = (patientName: string) => {
    setForm((current) => ({
      ...current,
      patientId: null,
      patientName,
    }));
  };

  const handleSelectService = (
    serviceId: string,
    option?: SearchableSelectOption,
  ) => {
    const service = services.find((item) => item.id === serviceId);

    setForm((current) => ({
      ...current,
      serviceId: serviceId || null,
      serviceName: service?.nombre || option?.label || current.serviceName,
    }));
  };

  const handleManualService = (serviceName: string) => {
    setForm((current) => ({
      ...current,
      serviceId: null,
      serviceName,
    }));
  };

  const handleSelectDoctor = (doctorId: string) => {
    setForm((current) => ({
      ...current,
      doctorId,
      assistantIds: [],
      walkInAssistantId: null,
    }));

    setAssistantSearch("");
  };

  const handleAppointmentTypeChange = (appointmentType: AppointmentType) => {
    setForm((current) => ({
      ...current,
      appointmentType,
      endTime:
        appointmentType === "walk_in"
          ? addMinutesToTime(current.startTime, 30)
          : current.endTime,
      arrivalTime: appointmentType === "walk_in" ? current.arrivalTime : "",
      waitMinutes:
        appointmentType === "walk_in"
          ? getWaitMinutes(current.arrivalTime, current.startTime)
          : null,
      walkInAssistantId:
        appointmentType === "walk_in" ? current.walkInAssistantId : null,
    }));
  };

  const handleArrivalTimeChange = (arrivalTime: string) => {
    setForm((current) => ({
      ...current,
      arrivalTime,
      waitMinutes: getWaitMinutes(arrivalTime, current.startTime),
    }));
  };

  const handleStartTimeChange = (startTime: string) => {
    setForm((current) => ({
      ...current,
      startTime,
      endTime:
        current.appointmentType === "walk_in"
          ? addMinutesToTime(startTime, 30)
          : current.endTime,
      waitMinutes:
        current.appointmentType === "walk_in"
          ? getWaitMinutes(current.arrivalTime, startTime)
          : current.waitMinutes,
    }));
  };

  const handleWalkInAssistantChange = (assistantId: string) => {
    setForm((current) => {
      const nextAssistantId = assistantId || null;

      return {
        ...current,
        walkInAssistantId: nextAssistantId,
        assistantIds:
          nextAssistantId && !current.assistantIds.includes(nextAssistantId)
            ? [...current.assistantIds, nextAssistantId]
            : current.assistantIds,
      };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {(selectedDoctor || form.startDate) && (
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex flex-wrap items-center gap-2">
              {selectedDoctor && (
                <p className="text-sm font-medium">{selectedDoctor.nombre}</p>
              )}

              {isWalkIn && <Badge variant="secondary">Sin cita</Badge>}
            </div>

            <p className="text-xs text-muted-foreground">
              {form.startDate} · {form.startTime} - {form.endTime}
            </p>

            {isWalkIn && form.arrivalTime && (
              <p className="mt-1 text-xs text-muted-foreground">
                Llegada: {form.arrivalTime}
                {form.waitMinutes !== null
                  ? ` · Espera estimada: ${form.waitMinutes} min`
                  : ""}
              </p>
            )}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="appointment-type">Tipo de registro</Label>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className={`rounded-xl border p-4 text-left transition ${
                  form.appointmentType === "scheduled"
                    ? "border-primary bg-primary/5"
                    : "bg-background hover:bg-muted/40"
                }`}
                onClick={() => handleAppointmentTypeChange("scheduled")}
              >
                <div className="flex items-center gap-2 font-medium">
                  <CalendarCheck className="h-4 w-4" />
                  Cita programada
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Para pacientes agendados con anticipación.
                </p>
              </button>

              <button
                type="button"
                className={`rounded-xl border p-4 text-left transition ${
                  form.appointmentType === "walk_in"
                    ? "border-primary bg-primary/5"
                    : "bg-background hover:bg-muted/40"
                }`}
                onClick={() => handleAppointmentTypeChange("walk_in")}
              >
                <div className="flex items-center gap-2 font-medium">
                  <UserPlus className="h-4 w-4" />
                  Sin cita
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Para pacientes que llegan sin cita previa.
                </p>
              </button>
            </div>
          </div>

          {isWalkIn && (
            <>
              <div className="space-y-2">
                <Label htmlFor="walkin-arrival-time">Hora de llegada *</Label>
                <Input
                  id="walkin-arrival-time"
                  type="time"
                  value={form.arrivalTime}
                  onChange={(event) =>
                    handleArrivalTimeChange(event.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="walkin-assistant">Asistente responsable</Label>
                <SearchableSelect
                  id="walkin-assistant"
                  options={assistantOptions}
                  value={form.walkInAssistantId ?? ""}
                  placeholder="Buscar asistente..."
                  emptyMessage="No se encontraron asistentes."
                  onValueChange={handleWalkInAssistantChange}
                />

                {selectedWalkInAssistant && (
                  <p className="text-xs text-muted-foreground">
                    Responsable del registro: {selectedWalkInAssistant.nombre}
                  </p>
                )}
              </div>
            </>
          )}

          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="appointment-patient">Paciente *</Label>

            <SearchableSelect
              id="appointment-patient"
              options={patientOptions}
              value={form.patientId ?? ""}
              inputValue={form.patientName}
              placeholder="Buscar por nombre, teléfono, correo o CURP..."
              emptyMessage="No se encontraron pacientes."
              allowCustomValue
              customValueLabel={(query) =>
                `Usar "${query}" sin vincular expediente`
              }
              onInputValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  patientId: null,
                  patientName: value,
                }))
              }
              onValueChange={handleSelectPatient}
              onCustomValue={handleManualPatient}
            />

            {selectedPatient ? (
              <p className="text-xs text-muted-foreground">
                Paciente vinculado al expediente: {" "}
                {selectedPatient.nombreCompleto}
              </p>
            ) : form.patientName.trim() ? (
              <p className="text-xs text-muted-foreground">
                Paciente escrito manualmente. La cita no quedará vinculada a un
                expediente existente.
              </p>
            ) : null}
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="appointment-service">
              {isWalkIn ? "Servicio o motivo" : "Servicio a realizar *"}
            </Label>

            <SearchableSelect
              id="appointment-service"
              options={serviceOptions}
              value={form.serviceId ?? ""}
              inputValue={form.serviceName}
              placeholder="Buscar servicio por nombre, código o categoría..."
              emptyMessage="No se encontraron servicios."
              allowCustomValue
              customValueLabel={(query) =>
                `Usar "${query}" sin vincular catálogo`
              }
              onInputValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  serviceId: null,
                  serviceName: value,
                }))
              }
              onValueChange={handleSelectService}
              onCustomValue={handleManualService}
            />

            {selectedService ? (
              <p className="text-xs text-muted-foreground">
                Servicio vinculado: {selectedService.nombre}
                {selectedService.precio > 0
                  ? ` · $${selectedService.precio.toFixed(2)}`
                  : ""}
              </p>
            ) : form.serviceName.trim() ? (
              <p className="text-xs text-muted-foreground">
                Servicio escrito manualmente. La cita no quedará vinculada al
                catálogo.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="appointment-reason">Motivo / observación</Label>
            <Input
              id="appointment-reason"
              value={form.reason}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
              placeholder="Ej. Dolor, revisión, seguimiento"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="appointment-doctor">Doctor *</Label>

            <SearchableSelect
              id="appointment-doctor"
              options={doctorOptions}
              value={form.doctorId}
              placeholder="Buscar doctor..."
              emptyMessage="No se encontraron doctores."
              onValueChange={(value) => handleSelectDoctor(value)}
            />
          </div>

          {isWalkIn ? (
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="walkin-start">Hora de atención</Label>
              <Input
                id="walkin-start"
                type="time"
                value={form.startTime}
                onChange={(event) => handleStartTimeChange(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                La atención sin cita se registra para {form.startDate}. La duración se
                aparta automáticamente por 30 minutos.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 lg:col-span-2">
              <div className="space-y-2">
                <Label htmlFor="appointment-date">Fecha</Label>
                <Input
                  id="appointment-date"
                  type="date"
                  value={form.startDate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      startDate: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="appointment-start">Inicio</Label>
                <Input
                  id="appointment-start"
                  type="time"
                  value={form.startTime}
                  onChange={(event) => handleStartTimeChange(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="appointment-end">Fin</Label>
                <Input
                  id="appointment-end"
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

          {!isWalkIn && (
          <div className="space-y-3 lg:col-span-2">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div className="space-y-1">
                <Label htmlFor="assistant-search">Asistentes</Label>

                {selectedAssistantItems.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedAssistantItems.map((assistant) => (
                      <Badge key={assistant.id} variant="secondary">
                        {assistant.nombre}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <Input
                id="assistant-search"
                value={assistantSearch}
                onChange={(event) => setAssistantSearch(event.target.value)}
                placeholder="Buscar asistente..."
                className="md:max-w-xs"
              />
            </div>

            {availableAssistants.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                No hay asistentes activos disponibles para este doctor.
              </p>
            ) : filteredAssistants.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                No hay asistentes que coincidan con la búsqueda.
              </p>
            ) : (
              <div className="grid max-h-52 gap-2 overflow-y-auto md:grid-cols-2">
                {filteredAssistants.map((assistant) => (
                  <label
                    key={assistant.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"
                  >
                    <Checkbox
                      checked={form.assistantIds.includes(assistant.id)}
                      onCheckedChange={() => toggleAssistant(assistant.id)}
                    />

                    <span className="text-sm">{assistant.nombre}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          )}

          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="appointment-notes">Notas internas</Label>
            <Textarea
              id="appointment-notes"
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="Notas internas opcionales."
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

          <Button onClick={() => void onSubmit()} disabled={saving}>
            {isWalkIn ? (
              <UserPlus className="mr-2 h-4 w-4" />
            ) : (
              <CalendarCheck className="mr-2 h-4 w-4" />
            )}
            {saving ? "Guardando..." : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentDialog;
