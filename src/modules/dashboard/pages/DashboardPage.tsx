import React, { useEffect, useMemo, useState } from "react";
import { compareTimes, formatTime, normalizeTime, timeToMinutes } from "@/shared/utils/time";
import { Link } from "react-router-dom";
import {
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  CalendarX,
  CircleCheck,
  CircleDollarSign,
  Clock3,
  FilePlus2,
  Package,
  ShoppingCart,
  UserPlus,
  UserRoundPlus,
} from "lucide-react";

import { type PermissionKey, useCan, useCurrentUserProfile } from "@/auth";
import { assistantService } from "@/modules/agenda/services/assistantService";
import { doctorService } from "@/modules/agenda/services/doctorService";
import { appointmentService, type Appointment } from "@/modules/agenda";
import { usePackages } from "@/modules/packages";
import { useCashRegister } from "@/modules/ventas";
import { Badge } from "@/shared/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn, formatCurrency, formatDate } from "@/shared/utils/utils";

interface QuickAction {
  label: string;
  description: string;
  path: string;
  icon: React.ElementType;
  permissions: PermissionKey[];
}

const quickActions: QuickAction[] = [
  {
    label: "Nueva cita",
    description: "Agendar atención",
    path: "/agenda?action=newAppointment",
    icon: CalendarPlus,
    permissions: ["agenda.view", "agenda.appointments.create"],
  },
  {
    label: "Nuevo paciente",
    description: "Registrar expediente",
    path: "/pacientes?action=newPatient",
    icon: UserPlus,
    permissions: ["patients.view", "patients.create"],
  },
  {
    label: "Nueva cotización",
    description: "Crear presupuesto",
    path: "/cotizaciones?action=newQuotation",
    icon: FilePlus2,
    permissions: ["quotations.view", "quotations.create"],
  },
  {
    label: "Nueva venta",
    description: "Registrar cobro",
    path: "/ventas?action=newSale",
    icon: ShoppingCart,
    permissions: ["sales.view", "sales.create"],
  },
];

const getLocalDateValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const ActiveShiftIncomeCard: React.FC = () => {
  const {
    cashClosures,
    cashClosuresLoading,
    cashMovements,
    cashMovementsLoading,
  } = useCashRegister();

  const openCashClosure = useMemo(
    () => cashClosures.find((closure) => closure.estado === "abierto") ?? null,
    [cashClosures],
  );

  const incomeMovements = useMemo(() => {
    if (!openCashClosure) return [];

    return cashMovements.filter(
      (movement) =>
        movement.corteId === openCashClosure.id &&
        movement.estado === "activo" &&
        movement.tipo === "ingreso" &&
        movement.referenciaTipo !== "apertura" &&
        !movement.concepto.toLowerCase().includes("apertura"),
    );
  }, [cashMovements, openCashClosure]);

  const activeShiftIncome = useMemo(
    () =>
      incomeMovements.reduce(
        (total, movement) => total + (Number(movement.monto) || 0),
        0,
      ),
    [incomeMovements],
  );

  const { cashSummaryUnavailable } = useCashRegister();
  const loading = cashClosuresLoading || cashMovementsLoading;

  return (
    <Card className="w-full min-w-0 overflow-hidden border-muted/70 shadow-sm sm:max-w-sm">
      <CardContent className="flex items-center justify-between gap-4 p-3 sm:p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
            <CircleDollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </span>

          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-muted-foreground">
              Ingresos del turno
            </p>
            {loading ? (
              <Skeleton className="mt-1 h-6 w-28" />
            ) : (
              <p className="truncate text-xl font-semibold tracking-tight text-foreground">
                {cashSummaryUnavailable ? "Información no disponible" : formatCurrency(activeShiftIncome)}
              </p>
            )}
            <p className="truncate text-[11px] text-muted-foreground">
              {openCashClosure
                ? openCashClosure.turnoNombre || "Turno activo"
                : "Sin turno activo"}
            </p>
          </div>
        </div>

        {!loading && !cashSummaryUnavailable && (
          <Badge
            variant={openCashClosure ? "default" : "secondary"}
            className="shrink-0"
          >
            {openCashClosure ? "Abierta" : "Cerrada"}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
};

interface DailyAgendaCardProps {
  appointments: Appointment[];
  loading: boolean;
  unavailable: boolean;
  today: string;
}

const DailyAgendaCard: React.FC<DailyAgendaCardProps> = ({
  appointments,
  loading,
  unavailable,
  today,
}) => {
  const todayAppointments = useMemo(
    () => (appointments ?? []).filter((appointment) => appointment?.startDate === today),
    [appointments, today],
  );

  const agendaMetrics = useMemo(
    () => [
      {
        label: "Citas del día",
        value: todayAppointments.length,
        icon: CalendarDays,
        iconClassName: "text-primary",
      },
      {
        label: "Confirmadas",
        value: todayAppointments.filter(
          (appointment) => appointment.status === "confirmed",
        ).length,
        icon: CalendarCheck,
        iconClassName: "text-sky-600 dark:text-sky-400",
      },
      {
        label: "Atendidas",
        value: todayAppointments.filter(
          (appointment) => appointment.status === "completed",
        ).length,
        icon: CircleCheck,
        iconClassName: "text-emerald-600 dark:text-emerald-400",
      },
      {
        label: "Canceladas",
        value: todayAppointments.filter(
          (appointment) => appointment.status === "cancelled",
        ).length,
        icon: CalendarX,
        iconClassName: "text-destructive",
      },
      {
        label: "Sin cita",
        value: todayAppointments.filter(
          (appointment) => appointment.appointmentType === "walk_in",
        ).length,
        icon: UserRoundPlus,
        iconClassName: "text-amber-600 dark:text-amber-400",
      },
      {
        label: "Por confirmar",
        value: todayAppointments.filter(
          (appointment) =>
            appointment.appointmentType !== "walk_in" &&
            appointment.status === "scheduled",
        ).length,
        icon: Clock3,
        iconClassName: "text-amber-600 dark:text-amber-400",
      },
    ],
    [todayAppointments],
  );

  const upcomingAppointments = useMemo(() => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    return [...todayAppointments]
      .filter(
        (appointment) =>
          appointment.appointmentType !== "walk_in" &&
          (appointment.status === "scheduled" ||
            appointment.status === "confirmed") &&
          (!normalizeTime(appointment?.startTime) || timeToMinutes(appointment?.startTime) >= currentMinutes),
      )
      .sort(
        (first, second) =>
          compareTimes(first?.startTime, second?.startTime),
      );
  }, [todayAppointments]);

  return (
    <Card
      className="flex min-h-[420px] min-w-0 flex-col overflow-hidden border-muted/70 shadow-sm lg:h-full lg:min-h-0"
    >
      <CardHeader className="flex shrink-0 flex-row items-start justify-between gap-3 p-4 pb-3 sm:p-5 sm:pb-3">
        <div className="min-w-0">
          <CardTitle className="text-base">Resumen de agenda</CardTitle>
          <p className="mt-1 text-lg font-semibold leading-none text-primary sm:text-xl">
            {formatDate(today)}
          </p>
        </div>
        <Clock3 className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
      </CardHeader>

      <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 pt-0 sm:p-5 sm:pt-0">
        {loading ? (
          <>
            <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-20 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-40 rounded-lg" />
          </>
        ) : unavailable ? (
          <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
            Información no disponible
          </p>
        ) : (
          <>
            <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
              {agendaMetrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <div
                    key={metric.label}
                    className="min-w-0 rounded-lg border bg-muted/20 p-3"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-[11px] text-muted-foreground">
                        {metric.label}
                      </span>
                      <Icon
                        className={`h-3.5 w-3.5 shrink-0 ${metric.iconClassName}`}
                      />
                    </div>
                    <p className="mt-2 text-xl font-semibold tabular-nums">
                      {metric.value}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="rounded-lg border bg-muted/10">
              <div className="shrink-0 border-b px-3 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Próximas citas
                </p>
              </div>

              {upcomingAppointments.length > 0 ? (
                <div className="px-3 py-2">
                  <div className="space-y-2">
                    {upcomingAppointments.map((appointment) => (
                      <div
                        key={appointment.id}
                        className="flex min-w-0 items-center gap-3 rounded-lg border bg-background/40 px-3 py-2"
                      >
                        <span className="w-12 shrink-0 font-semibold tabular-nums text-primary">
                          {formatTime(appointment?.startTime)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {appointment.patientName || "Paciente por confirmar"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {appointment.serviceName ||
                              appointment.reason ||
                              "Consulta"}
                          </p>
                        </div>
                        <Badge
                          variant={
                            appointment.status === "confirmed"
                              ? "default"
                              : "secondary"
                          }
                          className="shrink-0"
                        >
                          {appointment.status === "confirmed"
                            ? "Confirmada"
                            : "Programada"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Sin citas próximas.
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

interface ActivePackagesCardProps {
  activePackages: ReturnType<typeof usePackages>["paquetes"];
  loading: boolean;
  unavailable: boolean;
}

type DashboardPackage = ActivePackagesCardProps["activePackages"][number];

const ActivePackagesCard: React.FC<ActivePackagesCardProps> = ({
  activePackages,
  loading,
  unavailable,
}) => {
  const [selectedPackage, setSelectedPackage] = useState<DashboardPackage | null>(null);

  return (
    <>
      <Card
        className="flex min-h-[420px] min-w-0 flex-col overflow-hidden border-muted/70 shadow-sm lg:h-full lg:min-h-0"
      >
      <CardHeader className="flex shrink-0 flex-row items-start justify-between gap-3 p-4 pb-3 sm:p-5 sm:pb-3">
        <div className="min-w-0">
          <CardTitle className="text-base">Paquetes activos</CardTitle>
          <p className="mt-1 text-lg font-semibold leading-none text-primary sm:text-xl">
            {loading ? "Cargando" : unavailable ? "Información no disponible" : `${activePackages.length} vigentes`}
          </p>
        </div>
        <Package className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
      </CardHeader>

      <CardContent className="min-h-0 flex-1 overflow-y-auto p-4 pt-0 sm:p-5 sm:pt-0">
        {loading ? (
          <div className="space-y-2 pr-1">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : unavailable ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Información no disponible</p>
        ) : activePackages.length === 0 ? (
          <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
            No hay paquetes activos vigentes.
          </p>
        ) : (
          <div className="space-y-2 pr-1">
            {activePackages.map((paquete) => (
              <button
                  type="button"
                  key={paquete.id}
                  onClick={() => setSelectedPackage(paquete)}
                  className="flex w-full min-w-0 items-center justify-between gap-3 overflow-hidden rounded-lg border bg-muted/10 p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {paquete.nombre}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      Vigente hasta {formatDate(paquete.fechaFin)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrency(paquete.precioTotal)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {paquete.serviciosIncluidos.length} servicios
                    </p>
                  </div>
                </button>
            ))}
          </div>
        )}
      </CardContent>
      </Card>

      <Dialog open={Boolean(selectedPackage) && !unavailable} onOpenChange={(open) => !open && setSelectedPackage(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedPackage?.nombre}</DialogTitle>
            <DialogDescription>
              {selectedPackage
                ? `${selectedPackage.serviciosIncluidos.length} servicio${selectedPackage.serviciosIncluidos.length === 1 ? "" : "s"} incluido${selectedPackage.serviciosIncluidos.length === 1 ? "" : "s"}`
                : "Servicios incluidos"}
            </DialogDescription>
          </DialogHeader>
          {selectedPackage && (
            <div className="space-y-3">
              {selectedPackage.serviciosIncluidos.length === 0 ? (
                <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">
                  Sin servicios registrados.
                </p>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {selectedPackage.serviciosIncluidos.map((service, index) => (
                    <div
                      key={`${service.servicioId || service.nombre}-${index}`}
                      className="flex min-w-0 items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{service.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          Cantidad: {Number(service.cantidad) || 1}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-medium tabular-nums">
                        {formatCurrency((Number(service.precioOriginal) || 0) * (Number(service.cantidad) || 1))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 border-t pt-3 text-xs text-muted-foreground">
                <Badge variant="secondary">{formatCurrency(selectedPackage.precioTotal)}</Badge>
                <Badge variant="outline">Vigente hasta {formatDate(selectedPackage.fechaFin)}</Badge>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

const Dashboard: React.FC = () => {
  const { can } = useCan();
  const { profile } = useCurrentUserProfile();
  const { paquetes, paquetesLoading, paquetesUnavailable } = usePackages();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [agendaUnavailable, setAgendaUnavailable] = useState(false);

  const today = getLocalDateValue();
  const canViewAgenda = can("agenda.view");
  const canViewAllDoctors = can("agenda.doctors.viewAll") || can("agenda.doctors.manage") || can("agenda.assistants.manage");
  const canViewPackages = can("packages.view");
  const canViewActiveShiftIncome =
    can("sales.view") ||
    can("sales.reports.view") ||
    can("reports.view") ||
    can("sales.cashShift.open") ||
    can("sales.cashShift.close") ||
    can("sales.cashCuts.history.view");

  const visibleQuickActions = quickActions.filter((action) =>
    action.permissions.every((permission) => can(permission)),
  );

  const activePackages = useMemo(
    () =>
      paquetes
        .filter(
          (paquete) =>
            paquete.estado === "activo" &&
            paquete.fechaInicio <= today &&
            paquete.fechaFin >= today,
        )
        .sort((first, second) => first.fechaFin.localeCompare(second.fechaFin)),
    [paquetes, today],
  );

  useEffect(() => {
    let mounted = true;

    if (!canViewAgenda) {
      setAppointments([]);
      setAppointmentsLoading(false);
      setAgendaUnavailable(false);
      return () => {
        mounted = false;
      };
    }

    setAppointmentsLoading(true);
    setAgendaUnavailable(false);

    void Promise.all([appointmentService.listAppointments(), doctorService.listDoctors(), assistantService.listAssistants()])
      .then(([nextAppointments, doctors, assistants]) => {
        if (!mounted) return;
        const activeDoctors = doctors.filter((doctor) => doctor.status === "active");
        const linkedDoctor = profile?.doctorId || activeDoctors.find((doctor) => doctor.userUid === profile?.uid)?.id;
        const assistant = assistants.find((item) => item.status === "active" && (item.id === profile?.assistantId || item.userUid === profile?.uid));
        const visibleIds = new Set(canViewAllDoctors || (assistant && assistant.doctorIdsAsignados.length === 0)
          ? activeDoctors.map((doctor) => doctor.id)
          : [linkedDoctor, ...(assistant?.doctorIdsAsignados ?? [])].filter(Boolean));
        setAppointments(nextAppointments.filter((appointment) => visibleIds.has(appointment.doctorId)));
      })
      .catch(() => {
        if (mounted) setAgendaUnavailable(true);
      })
      .finally(() => {
        if (mounted) setAppointmentsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [canViewAgenda, canViewAllDoctors, profile?.uid, profile?.doctorId, profile?.assistantId]);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-7rem)] w-full max-w-[1600px] flex-col gap-4 overflow-x-hidden pb-4">
      <header className="flex shrink-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-base font-semibold text-primary sm:text-lg">Bienvenido</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Panel de ClauDent
          </h1>
        </div>

        {canViewActiveShiftIncome ? <ActiveShiftIncomeCard /> : <Card className="p-4"><p className="text-xs text-muted-foreground">Ingresos del turno</p><p className="text-sm">Información no disponible</p></Card>}
      </header>

      {visibleQuickActions.length > 0 && (
        <section
          className="shrink-0 rounded-xl border bg-card p-4 shadow-sm sm:p-5"
          aria-labelledby="quick-access-title"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="quick-access-title" className="text-base font-semibold sm:text-lg">
              Acceso rápido
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:gap-5">
            {visibleQuickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={`${action.path}-${action.label}`}
                  to={action.path}
                  className="group flex min-h-16 min-w-0 items-center gap-3 overflow-hidden rounded-xl border bg-muted/15 p-3 transition-colors hover:border-primary/40 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-4"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/15">
                    <Icon className="h-5 w-5 text-primary" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold leading-tight text-foreground">
                      {action.label}
                    </span>
                    <span className="mt-1 block truncate text-xs leading-tight text-muted-foreground">
                      {action.description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="grid gap-4 lg:h-[calc(100dvh-22rem)] lg:min-h-[460px] lg:grid-cols-2 lg:overflow-hidden">
        <DailyAgendaCard appointments={canViewAgenda ? appointments : []} loading={appointmentsLoading} unavailable={!canViewAgenda || agendaUnavailable} today={today} />
        <ActivePackagesCard activePackages={canViewPackages ? activePackages : []} loading={canViewPackages && paquetesLoading} unavailable={!canViewPackages || paquetesUnavailable} />
      </section>
    </div>
  );
};

export default Dashboard;
