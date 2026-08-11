import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { CalendarCheck } from "lucide-react";

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
import type { Assistant, Doctor } from "../types/agenda.types";
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

  const availableAssistants = useMemo(() => {
    return assistants.filter((assistant) => {
      if (!form.doctorId) return true;

      return (
        assistant.doctorIdsAsignados.length === 0 ||
        assistant.doctorIdsAsignados.includes(form.doctorId)
      );
    });
  }, [assistants, form.doctorId]);

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
    }));

    setAssistantSearch("");
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
            {selectedDoctor && (
              <p className="text-sm font-medium">{selectedDoctor.nombre}</p>
            )}

            <p className="text-xs text-muted-foreground">
              {form.startDate} · {form.startTime} - {form.endTime}
            </p>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
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
                Paciente vinculado al expediente:{" "}
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
            <Label htmlFor="appointment-service">Servicio a realizar *</Label>

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
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    startTime: event.target.value,
                  }))
                }
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
            <CalendarCheck className="mr-2 h-4 w-4" />
            {saving ? "Guardando..." : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentDialog;