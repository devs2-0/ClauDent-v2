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
                      onClick={() => setOpen(false)}
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
    if (!canViewCashAlerts) return renderNotifications(...sources);

    return (
      <CashNotificationsSource path={cashPath}>
        {(cashSource) => renderNotifications(...sources, cashSource)}
      </CashNotificationsSource>
    );
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

  // La fuente de Pacientes queda preparada en el modelo visual. Se conectará cuando exista
  // una señal global confiable que no requiera consultar cada expediente individualmente.
  return renderAgendaSource();
};
