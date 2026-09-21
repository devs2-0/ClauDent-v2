import { durationUnitLabels } from "@/shared/utils/duration";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Boxes,
  CalendarDays,
  Check,
  CircleDollarSign,
  PackageX,
  ShieldAlert,
  UsersRound,
} from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { Link } from "react-router-dom";

import { useAuth, useCan } from "@/auth";
import { usePatients } from "@/modules/patients";
import { usePatientInactivitySettings } from "@/modules/patients/hooks/usePatientInactivitySettings";
import { usePatientClinicalActivity } from "@/modules/patients/hooks/usePatientClinicalActivity";
import { isBirthdayToday, patientReviewDue } from "@/modules/patients/utils/patientAlerts";
import { safeLocalDate } from "@/shared/utils/firestoreData";
import { useGlobalNotificationSeen } from "@/app/hooks/useGlobalNotificationSeen";
import {
  agendaNotificationService,
  type AgendaNotification,
} from "@/modules/agenda/services/agendaNotificationService";
import { useInventory } from "@/modules/inventario";
import { useCashRegister } from "@/modules/ventas";
import { db } from "@/lib/firebase";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/utils/utils";

type GlobalNotification = {
  id: string;
  title: string;
  detail: string;
  source: "inventory" | "agenda" | "cash" | "security" | "patients";
  path: string;
  urgent?: boolean;
  timestamp?: number;
};

type NotificationSourceResult = {
  notifications: GlobalNotification[];
  loading: boolean;
};

const sourceLabels: Record<GlobalNotification["source"], string> = {
  inventory: "Inventario",
  agenda: "Agenda",
  cash: "Caja",
  security: "Seguridad",
  patients: "Pacientes",
};

const timestampToMillis = (value: unknown) => {
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }

  return undefined;
};

const formatTimestamp = (value?: number) => {
  if (!value) return "";

  return new Date(value).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const NotificationIcon = ({ notification }: { notification: GlobalNotification }) => {
  if (notification.source === "security") {
    return <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />;
  }
  if (notification.source === "cash") {
    return <CircleDollarSign className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />;
  }
  if (notification.source === "agenda") {
    return <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />;
  }
  if (notification.source === "patients") {
    return <UsersRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />;
  }
  if (notification.urgent) {
    return <PackageX className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />;
  }

  return <Boxes className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />;
};

interface NotificationsPopoverProps {
  notifications: GlobalNotification[];
  userId?: string | null;
  loading?: boolean;
}

const NotificationsPopover = ({
  notifications,
  userId,
  loading = false,
}: NotificationsPopoverProps) => {
  const [open, setOpen] = useState(false);
  const { isRecentlySeen, markSeen } = useGlobalNotificationSeen(userId);
  const sortedNotifications = useMemo(
    () => [...notifications]
      .sort((first, second) => {
        if (Boolean(first.urgent) !== Boolean(second.urgent)) return first.urgent ? -1 : 1;
        return (second.timestamp ?? 0) - (first.timestamp ?? 0);
      })
      .slice(0, 30),
    [notifications],
  );
  const pendingCount = sortedNotifications.filter(
    (notification) => !isRecentlySeen(notification.id),
  ).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 text-muted-foreground hover:text-foreground"
              aria-label={pendingCount > 0 ? `${pendingCount} avisos sin revisar` : "Avisos globales"}
            >
              <Bell className="h-4 w-4" />
              {pendingCount > 0 && (
                <span className="absolute right-0.5 top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Avisos</TooltipContent>
      </Tooltip>

      <PopoverContent align="end" sideOffset={10} className="z-50 w-[min(23rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Avisos</p>
            <p className="text-xs text-muted-foreground">Información importante del consultorio</p>
          </div>
          {pendingCount > 0 && <Badge variant="secondary">{pendingCount}</Badge>}
        </div>

        <div className="max-h-[min(26rem,65vh)] overflow-y-auto overscroll-contain p-2">
          {loading ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">Revisando avisos...</p>
          ) : sortedNotifications.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <Bell className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-medium">Todo al día</p>
              <p className="mt-1 text-xs text-muted-foreground">No hay avisos pendientes.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {sortedNotifications.map((notification) => {
                const seen = isRecentlySeen(notification.id);

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "rounded-lg border bg-muted/30 transition-colors hover:bg-muted/50",
                      seen && "opacity-70",
                    )}
                  >
                    <Link
                      to={notification.path}
                      onClick={() => { markSeen(notification.id); setOpen(false); }}
                      className="flex items-start gap-2 rounded-t-lg p-3 pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <NotificationIcon notification={notification} />
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{notification.title}</span>
                          <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px] font-normal">
                            {sourceLabels[notification.source]}
                          </Badge>
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{notification.detail}</span>
                        {notification.timestamp && (
                          <span className="mt-1 block text-[11px] text-muted-foreground/80">
                            {formatTimestamp(notification.timestamp)}
                          </span>
                        )}
                      </span>
                    </Link>
                    <div className="flex justify-end border-t border-border/60 px-2 py-1">
                      {seen ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-muted-foreground">
                          <Check className="h-3 w-3" /> Vista
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => markSeen(notification.id)}
                        >
                          Marcar como visto
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const InventoryNotificationsSource = ({
  children,
}: {
  children: (source: NotificationSourceResult) => ReactNode;
}) => {
  const { products, productsLoading, movements, movementsLoading } = useInventory();

  const notifications = useMemo<GlobalNotification[]>(() => {
    const stockNotifications = products
      .filter((product) => product.estado === "activo" && product.stock <= product.stockMinimo)
      .map((product) => ({
        id: `stock-${product.id}`,
        title: product.nombre,
        source: "inventory" as const,
        path: "/inventario",
        detail: product.stock <= 0
          ? "Sin existencias"
          : `${product.stock} ${product.unidad} disponibles · mínimo ${product.stockMinimo}`,
        urgent: product.stock <= 0,
      }));

    const classifiedMovements = movements
      .filter((movement) => movement.notificacionGenerada && movement.materialClasificado)
      .slice(0, 6)
      .map((movement) => ({
        id: `movement-${movement.id}`,
        title: movement.notificacionTitulo || movement.productoNombre,
        source: "inventory" as const,
        path: "/inventario",
        detail: movement.notificacionDetalle || movement.motivo || "Movimiento de inventario registrado",
        timestamp: movement.fecha ? new Date(movement.fecha).getTime() : undefined,
        urgent: movement.requiereDobleAutorizacion,
      }));

    return [...stockNotifications, ...classifiedMovements];
  }, [movements, products]);

  return children({
    notifications,
    loading: productsLoading || movementsLoading,
  });
};

const CashNotificationsSource = ({
  path,
  children,
}: {
  path: string;
  children: (source: NotificationSourceResult) => ReactNode;
}) => {
  const { cashClosures, cashClosuresLoading } = useCashRegister();

  const notifications = useMemo<GlobalNotification[]>(() => {
    const hasOpenShift = cashClosures.some((closure) => closure.estado === "abierto");
    if (cashClosuresLoading || hasOpenShift) return [];

    return [{
      id: "cash-closed",
      title: "Caja cerrada",
      detail: "Abre un turno antes de registrar ventas.",
      source: "cash",
      path,
      urgent: true,
    }];
  }, [cashClosures, cashClosuresLoading, path]);

  return children({
    notifications,
    loading: cashClosuresLoading,
  });
};

const AgendaNotificationsSource = ({
  children,
}: {
  children: (source: NotificationSourceResult) => ReactNode;
}) => {
  const { currentUser } = useAuth();
  const [doctorId, setDoctorId] = useState("");
  const [agendaNotifications, setAgendaNotifications] = useState<AgendaNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (!currentUser?.uid) {
      setDoctorId("");
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    void getDoc(doc(db, "usuarios", currentUser.uid))
      .then((snapshot) => {
        const linkedDoctorId = snapshot.data()?.doctorId;
        if (!cancelled) setDoctorId(typeof linkedDoctorId === "string" ? linkedDoctorId : "");
      })
      .catch(() => {
        if (!cancelled) setDoctorId("");
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid]);

  useEffect(() => {
    let cancelled = false;

    const loadNotifications = async () => {
      if (!doctorId) {
        setAgendaNotifications([]);
        setLoading(false);
        return;
      }

      try {
        const nextNotifications = await agendaNotificationService.listUnreadByDoctorId(doctorId);
        if (!cancelled) setAgendaNotifications(nextNotifications);
      } catch {
        if (!cancelled) setAgendaNotifications([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadNotifications();
    const intervalId = window.setInterval(() => void loadNotifications(), 60000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [doctorId]);

  const notifications = useMemo<GlobalNotification[]>(
    () => agendaNotifications.map((notification) => ({
      id: `agenda-${notification.id}`,
      title: notification.title,
      detail: notification.message || "Hay una actualización en tu agenda.",
      source: "agenda",
      path: "/agenda",
      timestamp: timestampToMillis(notification.createdAt),
      urgent: notification.type === "appointment_cancelled",
    })),
    [agendaNotifications],
  );

  return children({ notifications, loading });
};

const PatientNotificationsSource = ({ children }: {
  children: (source: NotificationSourceResult) => ReactNode;
}) => {
  const { can } = useCan();
  const { patients, patientsLoading, patientsUnavailable } = usePatients();
  const { settings, automatic } = usePatientInactivitySettings();
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setToday(new Date());
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  // Only patients who could be due need clinical-history reads. Unknown registration
  // dates remain candidates so an actual clinical date can still be used.
  const candidateIds = useMemo(() => settings.enabled ? patients.filter((patient) =>
    !patient.fechaRegistro || patientReviewDue(patient, settings, today),
  ).map((patient) => patient.id) : [], [patients, settings, today]);
  const { historyActivityByPatient, appointmentActivityByPatient, consultationActivityByPatient, clinicalActivityLoading, clinicalActivityUnavailable } = usePatientClinicalActivity(candidateIds);
  const notifications = useMemo<GlobalNotification[]>(() => {
    if (patientsUnavailable) return [];
    const dateKey = safeLocalDate(today);
    return patients.flatMap((patient) => {
      const result: GlobalNotification[] = [];
      const path = can('patients.record.view') ? `/pacientes/${patient.id}` : '/pacientes';
      if (isBirthdayToday(patient.fechaNacimiento, today)) result.push({
        id: `patient-birthday-${patient.id}-${dateKey}`,
        title: 'Cumpleaños de hoy', detail: `${patient.nombres} ${patient.apellidos}`,
        source: 'patients', path, timestamp: new Date(`${dateKey}T00:00:00`).getTime(),
      });
      if (settings.enabled && !clinicalActivityLoading) {
        const due = patientReviewDue(patient, settings, today, historyActivityByPatient.get(patient.id), appointmentActivityByPatient.get(patient.id), consultationActivityByPatient.get(patient.id));
        if (due) result.push({
          id: `patient-review-${patient.id}-${due.referenceDate}-${settings.value}-${settings.unit}`,
          title: 'Recordatorio de inactividad',
          detail: `${patient.nombres} ${patient.apellidos} · Lleva al menos ${settings.value} ${durationUnitLabels[settings.unit].toLowerCase()} sin actividad. ${patientReviewDue(patient, automatic, today, historyActivityByPatient.get(patient.id), appointmentActivityByPatient.get(patient.id), consultationActivityByPatient.get(patient.id)) ? "Cumple el periodo de inactividad automática" : "Pasará a inactivo"} a los ${automatic.value} ${durationUnitLabels[automatic.unit].toLowerCase()}. Desde ${due.referenceDate}, según ${due.source}.${clinicalActivityUnavailable ? ' Información clínica parcial.' : ''}`,
          source: 'patients', path, timestamp: due.due.getTime(),
        });
      }
      return result;
    });
  }, [patients, patientsUnavailable, today, settings, automatic, clinicalActivityLoading, clinicalActivityUnavailable, historyActivityByPatient, appointmentActivityByPatient, consultationActivityByPatient, can]);
  return children({ notifications, loading: patientsLoading });
};

export const GlobalNotificationsButton = () => {
  const { currentUser, sessions } = useAuth();
  const { can, loading } = useCan();
  const canViewInventoryAlerts = can("inventory.view");
  const canViewAgendaAlerts = can("agenda.view") && can("agenda.notifications.view");
  const canViewCashAlerts = can("sales.create") || can("sales.cashShift.open");
  const cashPath = can("sales.cashShift.open") ? "/caja" : "/ventas";

  const securityNotifications = useMemo<GlobalNotification[]>(() => {
    if (!can("security.sessions.view")) return [];

    const remoteSessions = sessions.filter(
      (session) => !session.isCurrent && session.status !== "revoked",
    );
    if (remoteSessions.length === 0) return [];

    return [{
      id: "security-remote-sessions",
      title: "Sesiones en otros dispositivos",
      detail: `${remoteSessions.length} sesión${remoteSessions.length === 1 ? "" : "es"} permanece${remoteSessions.length === 1 ? "" : "n"} abierta${remoteSessions.length === 1 ? "" : "s"}.`,
      source: "security",
      path: "/administracion",
    }];
  }, [can, sessions]);

  const renderNotifications = (...sources: NotificationSourceResult[]) => (
    <NotificationsPopover
      notifications={[
        ...securityNotifications,
        ...sources.flatMap((source) => source.notifications),
      ]}
      userId={currentUser?.uid}
      loading={sources.some((source) => source.loading)}
    />
  );

  const renderCashSource = (...sources: NotificationSourceResult[]) => {
    if (!canViewCashAlerts) return renderPatientSource(...sources);

    return (
      <CashNotificationsSource path={cashPath}>
        {(cashSource) => renderPatientSource(...sources, cashSource)}
      </CashNotificationsSource>
    );
  };

  const renderPatientSource = (...sources: NotificationSourceResult[]) => {
    if (!can('patients.view')) return renderNotifications(...sources);
    return <PatientNotificationsSource>{(patientSource) => renderNotifications(...sources, patientSource)}</PatientNotificationsSource>;
  };

  const renderAgendaSource = (...sources: NotificationSourceResult[]) => {
    if (!canViewAgendaAlerts) return renderCashSource(...sources);

    return (
      <AgendaNotificationsSource>
        {(agendaSource) => renderCashSource(...sources, agendaSource)}
      </AgendaNotificationsSource>
    );
  };

  if (loading) {
    return <NotificationsPopover notifications={[]} userId={currentUser?.uid} loading />;
  }

  if (canViewInventoryAlerts) {
    return (
      <InventoryNotificationsSource>
        {(inventorySource) => renderAgendaSource(inventorySource)}
      </InventoryNotificationsSource>
    );
  }

  return renderAgendaSource();
};
