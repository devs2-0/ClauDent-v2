import { useEffect, useMemo, useState } from "react";
import { Activity, Clock, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

import {
  agendaHistoryService,
  type AgendaHistoryAction,
  type AgendaHistoryLog,
} from "../services/agendaHistoryService";
import type { Doctor } from "../types/agenda.types";

interface AgendaHistoryPanelProps {
  doctors: Doctor[];
  selectedDoctorId?: string | null;
  canViewAllDoctors?: boolean;
  refreshKey?: number;
}

const actionLabels: Record<AgendaHistoryAction, string> = {
  appointment_created: "Cita creada",
  appointment_updated: "Cita modificada",
  appointment_cancelled: "Cita cancelada",
  appointment_status_changed: "Estado actualizado",
  block_created: "Bloqueo creado",
  schedule_created: "Horario semanal creado",
  special_schedule_created: "Horario especial creado",
};

const formatCreatedAt = (value: unknown) => {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().toLocaleString("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
      hour12: false,
    });
  }

  return "Fecha no disponible";
};

const getDoctorName = (doctors: Doctor[], doctorId?: string | null) => {
  if (!doctorId) return "Sin doctor";

  return (
    doctors.find((doctor) => doctor.id === doctorId)?.nombre ??
    "Doctor no encontrado"
  );
};

const AgendaHistoryPanel = ({
  doctors,
  selectedDoctorId,
  canViewAllDoctors = false,
  refreshKey = 0,
}: AgendaHistoryPanelProps) => {
  const [history, setHistory] = useState<AgendaHistoryLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = async () => {
    setLoading(true);

    try {
      const data =
        canViewAllDoctors || !selectedDoctorId
          ? await agendaHistoryService.listRecent()
          : await agendaHistoryService.listByDoctorId(selectedDoctorId);

      setHistory(data);
    } catch (error) {
      console.error(error);
      toast.error("No se pudo cargar el historial de agenda.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoctorId, canViewAllDoctors, refreshKey]);

  const groupedHistory = useMemo(() => {
    return history.map((item) => ({
      ...item,
      doctorName: getDoctorName(doctors, item.doctorId),
      createdAtLabel: formatCreatedAt(item.createdAt),
      actionLabel: actionLabels[item.action] ?? "Movimiento de agenda",
    }));
  }, [doctors, history]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Historial de agenda
          </CardTitle>

          <CardDescription>
            Consulta los movimientos recientes de citas, bloqueos y horarios.
          </CardDescription>
        </div>

        <Button variant="outline" onClick={() => void loadHistory()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Cargando historial...
          </div>
        ) : groupedHistory.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Todavía no hay movimientos registrados.
          </div>
        ) : (
          <div className="space-y-3">
            {groupedHistory.map((item) => (
              <div key={item.id} className="rounded-lg border bg-muted/20 p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">{item.title}</p>

                    <p className="text-sm text-muted-foreground">
                      {item.actionLabel} · {item.doctorName}
                    </p>

                    {item.description && (
                      <p className="text-sm">{item.description}</p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {item.date && <span>Fecha: {item.date}</span>}

                      {item.startTime && item.endTime && (
                        <span>
                          Hora: {item.startTime} - {item.endTime}
                        </span>
                      )}

                      {item.patientName && (
                        <span>Paciente: {item.patientName}</span>
                      )}

                      {item.createdByEmail && (
                        <span>Usuario: {item.createdByEmail}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {item.createdAtLabel}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AgendaHistoryPanel;
