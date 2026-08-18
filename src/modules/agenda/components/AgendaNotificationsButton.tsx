import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { toast } from "sonner";

import { useAuth } from "@/auth";
import { db } from "@/lib/firebase";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";

import type { Doctor } from "../types/agenda.types";
import {
  agendaNotificationService,
  type AgendaNotification,
} from "../services/agendaNotificationService";

interface AgendaNotificationsButtonProps {
  doctors: Doctor[];
}

const typeLabels: Record<string, string> = {
  appointment_created: "Nueva cita",
  appointment_updated: "Cita modificada",
  appointment_cancelled: "Cita cancelada",
  appointment_status_changed: "Cambio de estado",
  block_created: "Bloqueo creado",
  special_schedule_created: "Horario especial",
};

const formatNotificationDate = (value: unknown) => {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  return "";
};

const AgendaNotificationsButton = ({
  doctors,
}: AgendaNotificationsButtonProps) => {
  const { currentUser } = useAuth();

  const [doctorId, setDoctorId] = useState<string>("");
  const [notifications, setNotifications] = useState<AgendaNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);

  const autoOpenedRef = useRef(false);

  const linkedDoctorFromCollection = useMemo(() => {
    if (!currentUser?.uid) return null;

    return doctors.find((doctor) => doctor.userUid === currentUser.uid) ?? null;
  }, [currentUser?.uid, doctors]);

  useEffect(() => {
    let cancelled = false;

    const loadDoctorLink = async () => {
      if (!currentUser?.uid) {
        setDoctorId("");
        return;
      }

      try {
        const userSnapshot = await getDoc(
          doc(db, "usuarios", currentUser.uid),
        );

        const data = userSnapshot.data();

        const linkedDoctorId =
          typeof data?.doctorId === "string" && data.doctorId.trim()
            ? data.doctorId
            : linkedDoctorFromCollection?.id ?? "";

        if (!cancelled) {
          setDoctorId(linkedDoctorId);
        }
      } catch (error) {
        console.error(error);

        if (!cancelled) {
          setDoctorId(linkedDoctorFromCollection?.id ?? "");
        }
      }
    };

    void loadDoctorLink();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid, linkedDoctorFromCollection?.id]);

  const loadNotifications = async () => {
    if (!doctorId) {
      setNotifications([]);
      return;
    }

    setLoading(true);

    try {
      const data =
        await agendaNotificationService.listUnreadByDoctorId(doctorId);

      setNotifications(data);

      if (data.length > 0 && !autoOpenedRef.current) {
        autoOpenedRef.current = true;
        setOpen(true);
      }
    } catch (error) {
      console.error(error);
      toast.error("No se pudieron cargar las notificaciones de agenda.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();

    const intervalId = window.setInterval(() => {
      void loadNotifications();
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId]);

  const handleMarkAllAsRead = async () => {
    if (notifications.length === 0) return;

    setMarking(true);

    try {
      await agendaNotificationService.markManyAsRead(
        notifications.map((notification) => notification.id),
        currentUser?.uid,
      );

      setNotifications([]);
      setOpen(false);
      toast.success("Notificaciones marcadas como leídas.");
    } catch (error) {
      console.error(error);
      toast.error("No se pudieron marcar como leídas.");
    } finally {
      setMarking(false);
    }
  };

  if (!doctorId) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={loading}
        className="relative"
      >
        <Bell className="mr-2 h-4 w-4" />
        Notificaciones

        {notifications.length > 0 && (
          <span className="ml-2 rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">
            {notifications.length}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Notificaciones de agenda</DialogTitle>
            <DialogDescription>
              Cambios pendientes relacionados con tu agenda.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadNotifications()}
                disabled={loading || marking}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Actualizar
              </Button>

              {notifications.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleMarkAllAsRead()}
                  disabled={marking}
                >
                  <CheckCheck className="mr-2 h-4 w-4" />
                  Marcar todo como leído
                </Button>
              )}
            </div>

            {loading ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Cargando notificaciones...
              </div>
            ) : notifications.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No tienes notificaciones pendientes.
              </div>
            ) : (
              <div className="grid gap-3">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="rounded-xl border bg-background p-4"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {typeLabels[notification.type] ?? "Agenda"}
                      </Badge>

                      {notification.createdAt && (
                        <span className="text-xs text-muted-foreground">
                          {formatNotificationDate(notification.createdAt)}
                        </span>
                      )}
                    </div>

                    <p className="font-medium">{notification.title}</p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {notification.message}
                    </p>

                    {notification.startDate && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {notification.startDate}
                        {notification.startTime && notification.endTime
                          ? ` · ${notification.startTime} - ${notification.endTime}`
                          : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AgendaNotificationsButton;