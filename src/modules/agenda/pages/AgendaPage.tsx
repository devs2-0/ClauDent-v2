import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  RefreshCw,
  Search,
  Stethoscope,
  UserRoundCheck,
  UserRoundX,
  UsersRound,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth, useCan } from "@/auth";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { SectionHelp } from "@/shared/components/SectionHelp";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/components/ui/collapsible";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import { Textarea } from "@/shared/components/ui/textarea";
import { useConfirmAction } from "@/shared/hooks/useConfirmAction";

import { assistantService } from "../services/assistantService";
import { doctorService } from "../services/doctorService";
import type { Assistant, Doctor } from "../types/agenda.types";

import AppointmentManager from "../components/AppointmentManager";
import AvailabilityManager from "../components/AvailabilityManager";
import AgendaNotificationsButton from "../components/AgendaNotificationsButton";
import AgendaHistoryPanel from "../components/AgendaHistoryPanel";

const DEFAULT_DOCTOR_COLOR = "#2563EB";


interface DoctorFormState {
  nombre: string;
  email: string;
  telefono: string;
  especialidad: string;
  color: string;
  visibleEnAgenda: boolean;
}

interface AssistantFormState {
  nombre: string;
  email: string;
  telefono: string;
  notas: string;
  doctorIdsAsignados: string[];
  visibleEnAgenda: boolean;
}

const emptyDoctorForm: DoctorFormState = {
  nombre: "",
  email: "",
  telefono: "",
  especialidad: "",
  color: DEFAULT_DOCTOR_COLOR,
  visibleEnAgenda: true,
};

const emptyAssistantForm: AssistantFormState = {
  nombre: "",
  email: "",
  telefono: "",
  notas: "",
  doctorIdsAsignados: [],
  visibleEnAgenda: true,
};

const AgendaPage = () => {
  const { currentUser } = useAuth();
  const { can } = useCan();

  const [selectedTab, setSelectedTab] = useState("calendario");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [assistantDoctorSearch, setAssistantDoctorSearch] = useState("");
  const [assignedDoctorsOpen, setAssignedDoctorsOpen] = useState(false);
  const { confirm, confirmationDialog } = useConfirmAction();

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [assistants, setAssistants] = useState<Assistant[]>([]);

  const [doctorDialogOpen, setDoctorDialogOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [doctorForm, setDoctorForm] =
    useState<DoctorFormState>(emptyDoctorForm);

  const [assistantDialogOpen, setAssistantDialogOpen] = useState(false);
  const [editingAssistant, setEditingAssistant] =
    useState<Assistant | null>(null);
  const [assistantForm, setAssistantForm] =
    useState<AssistantFormState>(emptyAssistantForm);

  const canManageDoctors = can("agenda.doctors.manage");
  const canManageAssistants = can("agenda.assistants.manage");
  const canManageAvailability = can("agenda.availability.view");

  const canViewAgendaHistory =
    can("agenda.view") ||
    canManageDoctors ||
    canManageAssistants ||
    can("agenda.appointments.create") ||
    can("agenda.appointments.update") ||
    can("agenda.appointments.cancel") ||
    can("agenda.blocks.create") ||
    can("agenda.blocks.delete");

  const canViewAllHistory =
    canManageDoctors ||
    canManageAssistants ||
    can("agenda.doctors.viewAll");

  const activeDoctors = useMemo(() => {
    return doctors.filter((doctor) => doctor.status === "active");
  }, [doctors]);

  const filteredActiveDoctors = useMemo(() => {
    const term = assistantDoctorSearch.trim().toLocaleLowerCase("es-MX");
    if (!term) return activeDoctors;
    return activeDoctors.filter((doctor) =>
      [doctor.nombre, doctor.especialidad, doctor.email]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("es-MX")
        .includes(term),
    );
  }, [activeDoctors, assistantDoctorSearch]);

  const visibleTabs = useMemo(() => {
    return [
      {
        value: "calendario",
        label: "Calendario",
        icon: CalendarDays,
        visible: can("agenda.view"),
      },
      {
        value: "doctores",
        label: "Doctores",
        icon: Stethoscope,
        visible: can("agenda.doctors.view"),
      },
      {
        value: "asistentes",
        label: "Asistentes",
        icon: UsersRound,
        visible: can("agenda.assistants.view"),
      },
      {
        value: "disponibilidad",
        label: "Disponibilidad",
        icon: Clock,
        visible: canManageAvailability,
      },
      {
        value: "historial",
        label: "Historial",
        icon: CalendarDays,
        visible: canViewAgendaHistory,
      },
    ].filter((tab) => tab.visible);
  }, [
    can,
    canManageDoctors,
    canManageAssistants,
    canManageAvailability,
    canViewAgendaHistory,
  ]);

  const activeTab = visibleTabs.some((tab) => tab.value === selectedTab)
    ? selectedTab
    : visibleTabs[0]?.value;

  const loadData = async () => {
    setLoading(true);

    try {
      const [doctorsData, assistantsData] = await Promise.all([
        doctorService.listDoctors(),
        assistantService.listAssistants(),
      ]);

      setDoctors(doctorsData);
      setAssistants(assistantsData);
    } catch (error) {
      console.error(error);
      toast.error("No se pudo cargar la información de agenda.");
    } finally {
      setLoading(false);
    }
  };

  const refreshAgenda = async () => {
    await loadData();
    setRefreshKey((current) => current + 1);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateDoctorDialog = () => {
    if (!canManageDoctors) return;
    setEditingDoctor(null);
    setDoctorForm(emptyDoctorForm);
    setDoctorDialogOpen(true);
  };

  const openEditDoctorDialog = (doctor: Doctor) => {
    if (!canManageDoctors) return;
    setEditingDoctor(doctor);
    setDoctorForm({
      nombre: doctor.nombre,
      email: doctor.email ?? "",
      telefono: doctor.telefono ?? "",
      especialidad: doctor.especialidad ?? "",
      color: doctor.color ?? DEFAULT_DOCTOR_COLOR,
      visibleEnAgenda: doctor.visibleEnAgenda,
    });
    setDoctorDialogOpen(true);
  };

  const closeDoctorDialog = () => {
    if (saving) return;

    setDoctorDialogOpen(false);
    setEditingDoctor(null);
    setDoctorForm(emptyDoctorForm);
  };

  const handleSaveDoctor = async () => {
    if (!canManageDoctors) {
      toast.error("No tienes permiso para gestionar doctores.");
      return;
    }

    const nombre = doctorForm.nombre.trim();

    if (!nombre) {
      toast.error("El nombre del doctor es obligatorio.");
      return;
    }

    setSaving(true);

    try {
      if (editingDoctor) {
        await doctorService.updateDoctor(editingDoctor.id, {
          nombre,
          email: doctorForm.email.trim().toLowerCase(),
          telefono: doctorForm.telefono.trim(),
          especialidad: doctorForm.especialidad.trim(),
          color: doctorForm.color || DEFAULT_DOCTOR_COLOR,
          visibleEnAgenda: doctorForm.visibleEnAgenda,
          updatedBy: currentUser?.uid ?? null,
        });

        toast.success("Doctor actualizado correctamente.");
      } else {
        await doctorService.createDoctor({
          nombre,
          email: doctorForm.email.trim().toLowerCase(),
          telefono: doctorForm.telefono.trim(),
          especialidad: doctorForm.especialidad.trim(),
          color: doctorForm.color || DEFAULT_DOCTOR_COLOR,
          status: "active",
          visibleEnAgenda: doctorForm.visibleEnAgenda,
          userUid: null,
          createdBy: currentUser?.uid ?? null,
          updatedBy: currentUser?.uid ?? null,
        });

        toast.success("Doctor creado correctamente.");
      }

      closeDoctorDialog();
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo guardar el doctor.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDoctorStatus = async (doctor: Doctor) => {
    if (!canManageDoctors) {
      toast.error("No tienes permiso para gestionar doctores.");
      return;
    }

    const nextStatus = doctor.status === "active" ? "inactive" : "active";

    const confirmed = await confirm({
      title: nextStatus === "inactive" ? "Desactivar doctor" : "Activar doctor",
      description:
        nextStatus === "inactive"
          ? `${doctor.nombre} dejará de aparecer como disponible en la agenda.`
          : `${doctor.nombre} volverá a estar disponible en la agenda.`,
      confirmLabel: nextStatus === "inactive" ? "Desactivar" : "Activar",
      destructive: nextStatus === "inactive",
    });

    if (!confirmed) return;

    try {
      await doctorService.updateDoctor(doctor.id, {
        status: nextStatus,
        visibleEnAgenda:
          nextStatus === "active" ? doctor.visibleEnAgenda : false,
        updatedBy: currentUser?.uid ?? null,
      });

      toast.success(
        nextStatus === "active"
          ? "Doctor activado correctamente."
          : "Doctor desactivado correctamente.",
      );

      await loadData();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo cambiar el estado del doctor.");
    }
  };

  const openCreateAssistantDialog = () => {
    if (!canManageAssistants) return;
    setEditingAssistant(null);
    setAssistantForm(emptyAssistantForm);
    setAssistantDoctorSearch("");
    setAssignedDoctorsOpen(false);
    setAssistantDialogOpen(true);
  };

  const openEditAssistantDialog = (assistant: Assistant) => {
    if (!canManageAssistants) return;
    setEditingAssistant(assistant);
    setAssistantForm({
      nombre: assistant.nombre,
      email: assistant.email ?? "",
      telefono: assistant.telefono ?? "",
      notas: assistant.notas ?? "",
      doctorIdsAsignados: assistant.doctorIdsAsignados ?? [],
      visibleEnAgenda: assistant.visibleEnAgenda,
    });
    setAssistantDoctorSearch("");
    setAssignedDoctorsOpen(false);
    setAssistantDialogOpen(true);
  };

  const closeAssistantDialog = () => {
    if (saving) return;

    setAssistantDialogOpen(false);
    setEditingAssistant(null);
    setAssistantForm(emptyAssistantForm);
  };

  const toggleAssistantDoctor = (doctorId: string) => {
    setAssistantForm((current) => {
      const exists = current.doctorIdsAsignados.includes(doctorId);

      return {
        ...current,
        doctorIdsAsignados: exists
          ? current.doctorIdsAsignados.filter((item) => item !== doctorId)
          : [...current.doctorIdsAsignados, doctorId],
      };
    });
  };

  const handleSaveAssistant = async () => {
    if (!canManageAssistants) {
      toast.error("No tienes permiso para gestionar asistentes.");
      return;
    }

    const nombre = assistantForm.nombre.trim();

    if (!nombre) {
      toast.error("El nombre del asistente es obligatorio.");
      return;
    }

    setSaving(true);

    try {
      if (editingAssistant) {
        await assistantService.updateAssistant(editingAssistant.id, {
          nombre,
          email: assistantForm.email.trim().toLowerCase(),
          telefono: assistantForm.telefono.trim(),
          notas: assistantForm.notas.trim(),
          doctorIdsAsignados: assistantForm.doctorIdsAsignados,
          visibleEnAgenda: assistantForm.visibleEnAgenda,
          updatedBy: currentUser?.uid ?? null,
        });

        toast.success("Asistente actualizado correctamente.");
      } else {
        await assistantService.createAssistant({
          nombre,
          email: assistantForm.email.trim().toLowerCase(),
          telefono: assistantForm.telefono.trim(),
          notas: assistantForm.notas.trim(),
          doctorIdsAsignados: assistantForm.doctorIdsAsignados,
          status: "active",
          visibleEnAgenda: assistantForm.visibleEnAgenda,
          userUid: null,
          createdBy: currentUser?.uid ?? null,
          updatedBy: currentUser?.uid ?? null,
        });

        toast.success("Asistente creado correctamente.");
      }

      closeAssistantDialog();
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo guardar el asistente.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAssistantStatus = async (assistant: Assistant) => {
    if (!canManageAssistants) {
      toast.error("No tienes permiso para gestionar asistentes.");
      return;
    }

    const nextStatus = assistant.status === "active" ? "inactive" : "active";

    const confirmed = await confirm({
      title: nextStatus === "inactive" ? "Desactivar asistente" : "Activar asistente",
      description:
        nextStatus === "inactive"
          ? `${assistant.nombre} dejará de aparecer como disponible en la agenda.`
          : `${assistant.nombre} volverá a estar disponible en la agenda.`,
      confirmLabel: nextStatus === "inactive" ? "Desactivar" : "Activar",
      destructive: nextStatus === "inactive",
    });

    if (!confirmed) return;

    try {
      await assistantService.updateAssistant(assistant.id, {
        status: nextStatus,
        visibleEnAgenda:
          nextStatus === "active" ? assistant.visibleEnAgenda : false,
        updatedBy: currentUser?.uid ?? null,
      });

      toast.success(
        nextStatus === "active"
          ? "Asistente activado correctamente."
          : "Asistente desactivado correctamente.",
      );

      await loadData();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo cambiar el estado del asistente.");
    }
  };

  if (visibleTabs.length === 0) {
    return (
      <main className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Agenda</CardTitle>
            <CardDescription>
              No tienes permisos para ver este módulo.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }



  return (
    <main className="space-y-4">
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">Agenda</h1>
            <SectionHelp title="Acerca de Agenda">
              <p>
                Organiza el calendario interno del consultorio y las citas de los pacientes.
              </p>
              <p>
                También permite configurar doctores, asistentes, disponibilidad y consultar el historial de movimientos de agenda.
              </p>
            </SectionHelp>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => void refreshAgenda()}
              disabled={loading}
              aria-label="Actualizar agenda"
              title="Actualizar agenda"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <AgendaNotificationsButton doctors={activeDoctors} />

        </div>
      </section>

      <Tabs value={activeTab} onValueChange={setSelectedTab}>
        <TabsList className="h-auto w-full flex-nowrap justify-start overflow-x-auto p-1">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;

            return (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                <Icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="calendario" className="relative isolate z-0 mt-4">
          <AppointmentManager doctors={doctors} assistants={assistants} refreshKey={refreshKey} />
        </TabsContent>

        <TabsContent value="doctores" className="mt-4">
          <Card>
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle>Doctores</CardTitle>
                <CardDescription>
                  Administra los doctores que aparecen en la agenda clínica.
                </CardDescription>
              </div>

              {canManageDoctors && (
                <Button onClick={openCreateDoctorDialog}>
                  <Stethoscope className="mr-2 h-4 w-4" />
                  Nuevo doctor
                </Button>
              )}
            </CardHeader>

            <CardContent>
              {loading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Cargando doctores...
                </div>
              ) : doctors.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No hay doctores registrados.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {doctors.map((doctor) => (
                    <div
                      key={doctor.id}
                      className="rounded-lg border bg-muted/20 p-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className="h-4 w-4 rounded-full border"
                              style={{
                                backgroundColor:
                                  doctor.color || DEFAULT_DOCTOR_COLOR,
                              }}
                            />

                            <h3 className="font-semibold">{doctor.nombre}</h3>

                            <Badge
                              variant={
                                doctor.status === "active"
                                  ? "outline"
                                  : "secondary"
                              }
                            >
                              {doctor.status === "active"
                                ? "Activo"
                                : "Inactivo"}
                            </Badge>

                            {doctor.visibleEnAgenda && (
                              <Badge variant="secondary">Visible</Badge>
                            )}
                          </div>

                          <p className="text-sm text-muted-foreground">
                            {doctor.especialidad || "Sin especialidad."}
                          </p>

                          {doctor.email && (
                            <p className="text-xs text-muted-foreground">
                              {doctor.email}
                            </p>
                          )}

                          {doctor.telefono && (
                            <p className="text-xs text-muted-foreground">
                              {doctor.telefono}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {canManageDoctors && (<Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDoctorDialog(doctor)}
                        >
                          Editar
                        </Button>)}

                        {canManageDoctors && (<Button
                          variant={
                            doctor.status === "active"
                              ? "destructive"
                              : "outline"
                          }
                          size="sm"
                          onClick={() => handleToggleDoctorStatus(doctor)}
                        >
                          {doctor.status === "active" ? (
                            <UserRoundX className="mr-2 h-4 w-4" />
                          ) : (
                            <UserRoundCheck className="mr-2 h-4 w-4" />
                          )}
                          {doctor.status === "active"
                            ? "Desactivar"
                            : "Activar"}
                        </Button>)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="asistentes" className="mt-4">
          <Card>
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle>Asistentes</CardTitle>
                <CardDescription>
                  Administra asistentes y vincúlalos con uno o varios doctores.
                </CardDescription>
              </div>

              {canManageAssistants && (
                <Button onClick={openCreateAssistantDialog}>
                  <UsersRound className="mr-2 h-4 w-4" />
                  Nuevo asistente
                </Button>
              )}
            </CardHeader>

            <CardContent>
              {loading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Cargando asistentes...
                </div>
              ) : assistants.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No hay asistentes registrados.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {assistants.map((assistant) => {
                    const assignedDoctorNames = assistant.doctorIdsAsignados
                      .map(
                        (doctorId) =>
                          doctors.find((doctor) => doctor.id === doctorId)
                            ?.nombre,
                      )
                      .filter(Boolean);

                    return (
                      <div
                        key={assistant.id}
                        className="rounded-lg border bg-muted/20 p-3"
                      >
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">
                              {assistant.nombre}
                            </h3>

                            <Badge
                              variant={
                                assistant.status === "active"
                                  ? "outline"
                                  : "secondary"
                              }
                            >
                              {assistant.status === "active"
                                ? "Activo"
                                : "Inactivo"}
                            </Badge>

                            {assistant.visibleEnAgenda && (
                              <Badge variant="secondary">Visible</Badge>
                            )}
                          </div>

                          {assistant.email && (
                            <p className="text-xs text-muted-foreground">
                              {assistant.email}
                            </p>
                          )}

                          {assistant.telefono && (
                            <p className="text-xs text-muted-foreground">
                              {assistant.telefono}
                            </p>
                          )}

                          <p className="text-sm text-muted-foreground">
                            {assignedDoctorNames.length > 0
                              ? `Asignado a: ${assignedDoctorNames.join(", ")}`
                              : "Sin doctores asignados."}
                          </p>

                          {assistant.notas && (
                            <p className="text-xs text-muted-foreground">
                              {assistant.notas}
                            </p>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {canManageAssistants && (<Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditAssistantDialog(assistant)}
                          >
                            Editar
                          </Button>)}

                          {canManageAssistants && (<Button
                            variant={
                              assistant.status === "active"
                                ? "destructive"
                                : "outline"
                            }
                            size="sm"
                            onClick={() =>
                              handleToggleAssistantStatus(assistant)
                            }
                          >
                            {assistant.status === "active" ? (
                              <UserRoundX className="mr-2 h-4 w-4" />
                            ) : (
                              <UserRoundCheck className="mr-2 h-4 w-4" />
                            )}
                            {assistant.status === "active"
                              ? "Desactivar"
                              : "Activar"}
                          </Button>)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disponibilidad" className="mt-4">
          <AvailabilityManager doctors={doctors} assistants={assistants} refreshKey={refreshKey} />
        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          <AgendaHistoryPanel
            doctors={doctors}
            canViewAllDoctors={canViewAllHistory}
            refreshKey={refreshKey}
          />
        </TabsContent>

      </Tabs>

      {confirmationDialog}

      <Dialog open={doctorDialogOpen} onOpenChange={setDoctorDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingDoctor ? "Editar doctor" : "Nuevo doctor"}
            </DialogTitle>
            <DialogDescription>
              Configura la información básica del doctor para agenda.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="doctor-name">Nombre *</Label>
              <Input
                id="doctor-name"
                value={doctorForm.nombre}
                onChange={(event) =>
                  setDoctorForm((current) => ({
                    ...current,
                    nombre: event.target.value,
                  }))
                }
                placeholder="Ej. Dra. Claudia"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doctor-specialty">Especialidad (Opcional)</Label>
              <Input
                id="doctor-specialty"
                value={doctorForm.especialidad}
                onChange={(event) =>
                  setDoctorForm((current) => ({
                    ...current,
                    especialidad: event.target.value,
                  }))
                }
                placeholder="Ej. Ortodoncia"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doctor-email">Correo (Opcional)</Label>
              <Input
                id="doctor-email"
                type="email"
                value={doctorForm.email}
                onChange={(event) =>
                  setDoctorForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="doctor@claudent.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doctor-phone">Teléfono (Opcional)</Label>
              <Input
                id="doctor-phone"
                value={doctorForm.telefono}
                onChange={(event) =>
                  setDoctorForm((current) => ({
                    ...current,
                    telefono: event.target.value,
                  }))
                }
                placeholder="Opcional"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doctor-color">Color en agenda (Opcional)</Label>
              <Input
                id="doctor-color"
                type="color"
                value={doctorForm.color}
                onChange={(event) =>
                  setDoctorForm((current) => ({
                    ...current,
                    color: event.target.value,
                  }))
                }
              />
            </div>

            <label className="flex items-center gap-3 rounded-lg border p-3">
              <Checkbox
                checked={doctorForm.visibleEnAgenda}
                onCheckedChange={(checked) =>
                  setDoctorForm((current) => ({
                    ...current,
                    visibleEnAgenda: checked === true,
                  }))
                }
              />
              <span className="text-sm">Visible en agenda</span>
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeDoctorDialog}
              disabled={saving}
            >
              Cancelar
            </Button>

            <Button onClick={handleSaveDoctor} disabled={saving}>
              {saving ? "Guardando..." : "Guardar doctor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={assistantDialogOpen}
        onOpenChange={setAssistantDialogOpen}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAssistant ? "Editar asistente" : "Nuevo asistente"}
            </DialogTitle>
            <DialogDescription>
              Configura la información básica del asistente y sus doctores
              asignados.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="assistant-name">Nombre *</Label>
              <Input
                id="assistant-name"
                value={assistantForm.nombre}
                onChange={(event) =>
                  setAssistantForm((current) => ({
                    ...current,
                    nombre: event.target.value,
                  }))
                }
                placeholder="Ej. Luis Pérez"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="assistant-email">Correo (Opcional)</Label>
              <Input
                id="assistant-email"
                type="email"
                value={assistantForm.email}
                onChange={(event) =>
                  setAssistantForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="asistente@claudent.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="assistant-phone">Teléfono (Opcional)</Label>
              <Input
                id="assistant-phone"
                value={assistantForm.telefono}
                onChange={(event) =>
                  setAssistantForm((current) => ({
                    ...current,
                    telefono: event.target.value,
                  }))
                }
                placeholder="Opcional"
              />
            </div>

            <label className="flex items-center gap-3 rounded-lg border p-3">
              <Checkbox
                checked={assistantForm.visibleEnAgenda}
                onCheckedChange={(checked) =>
                  setAssistantForm((current) => ({
                    ...current,
                    visibleEnAgenda: checked === true,
                  }))
                }
              />
              <span className="text-sm">Visible en agenda</span>
            </label>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="assistant-notes">Notas (Opcional)</Label>
              <Textarea
                id="assistant-notes"
                value={assistantForm.notas}
                onChange={(event) =>
                  setAssistantForm((current) => ({
                    ...current,
                    notas: event.target.value,
                  }))
                }
                placeholder="Notas internas opcionales."
              />
            </div>

            <Collapsible
              open={assignedDoctorsOpen}
              onOpenChange={setAssignedDoctorsOpen}
              className="space-y-2 md:col-span-2"
            >
              <CollapsibleTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-between">
                  <span>
                    Doctores asignados
                    {assistantForm.doctorIdsAsignados.length > 0 &&
                      ` (${assistantForm.doctorIdsAsignados.length})`}
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${assignedDoctorsOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 rounded-lg border bg-muted/20 p-3">
                {activeDoctors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Primero registra doctores activos.</p>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="search"
                        value={assistantDoctorSearch}
                        onChange={(event) => setAssistantDoctorSearch(event.target.value)}
                        placeholder="Buscar doctor..."
                        className="h-9 pl-9"
                      />
                    </div>
                    <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                      {filteredActiveDoctors.map((doctor) => (
                        <label
                          key={doctor.id}
                          className="flex cursor-pointer items-center gap-3 rounded-md border bg-card p-2"
                        >
                          <Checkbox
                            checked={assistantForm.doctorIdsAsignados.includes(doctor.id)}
                            onCheckedChange={() => toggleAssistantDoctor(doctor.id)}
                          />
                          <span
                            className="h-3.5 w-3.5 rounded-full border"
                            style={{ backgroundColor: doctor.color || DEFAULT_DOCTOR_COLOR }}
                          />
                          <span className="min-w-0 truncate text-sm">{doctor.nombre}</span>
                        </label>
                      ))}
                      {filteredActiveDoctors.length === 0 && (
                        <p className="py-3 text-center text-sm text-muted-foreground">
                          No se encontraron doctores.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeAssistantDialog}
              disabled={saving}
            >
              Cancelar
            </Button>

            <Button onClick={handleSaveAssistant} disabled={saving}>
              {saving ? "Guardando..." : "Guardar asistente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default AgendaPage;
