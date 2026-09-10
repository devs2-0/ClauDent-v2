import React, { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import {
  ArrowRightCircle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  History,
  Layers,
  Mail,
  Search,
  Eye,
  FileText,
  User,
  CalendarDays,
} from "lucide-react";

import { db } from "@/lib/firebase";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { SectionHelp } from "@/shared/components/SectionHelp";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import {
  getAuditActionLabel,
  getAuditDetailLabel,
  getAuditModuleLabel,
  getAuditSearchText,
} from "@/modules/audit/utils/auditDisplay";
import type { AuditLog } from "@/modules/audit/types/audit.types";

const PAGE_SIZE = 10;
const AUDIT_LIMIT = 300;

const ALL_VALUE = "__all__";

const getLogDateValue = (fecha: unknown) => {
  try {
    if (fecha && typeof fecha === "object" && "toDate" in fecha && typeof (fecha as any).toDate === "function") {
      const date = (fecha as any).toDate() as Date;
      return date.getTime();
    }
  } catch {
    return null;
  }
  return null;
};

const extractMoneyAmount = (detail?: string | null) => {
  if (!detail) return null;
  const match = detail.match(/(?:Total|Monto|Saldo|pendiente|Stock inicial):?\s*\$?\s*(-?\d+(?:,\d{3})*(?:\.\d{1,2})?)/i);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : null;
};

const Bitacora: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filtro, setFiltro] = useState("");
  const [moduleFilter, setModuleFilter] = useState(ALL_VALUE);
  const [actionFilter, setActionFilter] = useState(ALL_VALUE);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    const auditQuery = query(collection(db, "bitacora"), orderBy("fecha", "desc"), limit(AUDIT_LIMIT));
    const unsub = onSnapshot(auditQuery, (snap) => {
      setLogs(snap.docs.map((auditDoc) => ({ id: auditDoc.id, ...auditDoc.data() }) as AuditLog));
    });
    return () => unsub();
  }, []);

  const moduleOptions = useMemo(() => {
    const modules = Array.from(new Set(logs.map((log) => log.modulo).filter(Boolean)));
    return modules.sort((a, b) => getAuditModuleLabel(a).localeCompare(getAuditModuleLabel(b)));
  }, [logs]);

  const actionOptions = useMemo(() => {
    const actions = Array.from(new Set(logs.map((log) => log.accion).filter(Boolean)));
    return actions.sort((a, b) => getAuditActionLabel(a).localeCompare(getAuditActionLabel(b)));
  }, [logs]);

  const logsFiltrados = useMemo(() => {
    const term = filtro.trim().toLowerCase();
    const fromMs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toMs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

    return logs.filter((log) => {
      if (term && !getAuditSearchText(log).includes(term)) return false;
      if (moduleFilter !== ALL_VALUE && log.modulo !== moduleFilter) return false;
      if (actionFilter !== ALL_VALUE && log.accion !== actionFilter) return false;

      const logMs = getLogDateValue(log.fecha);
      if (fromMs !== null && (logMs === null || logMs < fromMs)) return false;
      if (toMs !== null && (logMs === null || logMs > toMs)) return false;

      return true;
    });
  }, [logs, filtro, moduleFilter, actionFilter, dateFrom, dateTo]);

  useEffect(() => {
    setPage(1);
  }, [filtro, moduleFilter, actionFilter, dateFrom, dateTo]);

  const total = logsFiltrados.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE;
  const endIndexExclusive = Math.min(startIndex + PAGE_SIZE, total);
  const visibleLogs = logsFiltrados.slice(startIndex, endIndexExclusive);
  const hasFilters = Boolean(filtro || dateFrom || dateTo || moduleFilter !== ALL_VALUE || actionFilter !== ALL_VALUE);

  const rangeText = useMemo(() => {
    if (total === 0) return "0 de 0";
    return `${startIndex + 1}-${endIndexExclusive} de ${total}`;
  }, [total, startIndex, endIndexExclusive]);

  const fmtFecha = (fecha: unknown) => {
    try {
      if (fecha && typeof fecha === "object" && "toDate" in fecha && typeof (fecha as any).toDate === "function") {
        return (fecha as any).toDate().toLocaleString("es-MX", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    } catch {
      return "Reciente";
    }
    return "Reciente";
  };

  const getAccionColor = (accion: string) => {
    switch (accion) {
      case "CREATE": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "DELETE": return "bg-red-100 text-red-700 border-red-200";
      case "UPDATE": return "bg-blue-100 text-blue-700 border-blue-200";
      case "LOGIN": return "bg-purple-100 text-purple-700 border-purple-200";
      case "LOGOUT": return "bg-amber-100 text-amber-700 border-amber-200";
      case "REVOKE_SESSION":
      case "REVOKE_ALL_SESSIONS": return "bg-orange-100 text-orange-700 border-orange-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const canPrev = safePage > 1;
  const canNext = safePage < totalPages;
  const goPrev = () => setPage((current) => Math.max(1, current - 1));
  const goNext = () => setPage((current) => Math.min(totalPages, current + 1));

  const clearFilters = () => {
    setFiltro("");
    setModuleFilter(ALL_VALUE);
    setActionFilter(ALL_VALUE);
    setDateFrom("");
    setDateTo("");
  };

  const renderLogDetail = (log: AuditLog) => (
    <div className="flex items-start gap-2 text-[13px] md:text-[14px] text-foreground font-medium">
      <ArrowRightCircle className="h-4 w-4 text-primary opacity-50 shrink-0 mt-0.5" />
      <span className="break-words">{getAuditDetailLabel(log.accion, log.detalle)}</span>
    </div>
  );

  const selectedAmount = extractMoneyAmount(selectedLog?.detalle);

  return (
    <div className="w-full min-w-0 space-y-5 p-3 pb-24 animate-in fade-in duration-500 sm:p-4 md:space-y-6 lg:pb-6 xl:p-8">
      <div className="flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2 italic text-primary">
              <History className="h-7 w-7 md:h-8 md:w-8" /> Bitacora
            </h1>
            <SectionHelp title="Acerca de Bitácora">
              <p>
                Consulta el historial de acciones relevantes realizadas dentro del sistema.
              </p>
              <p>
                Usa los filtros para localizar movimientos por usuario, módulo, acción o periodo.
              </p>
            </SectionHelp>
          </div>
        </div>

        <Card className="w-full min-w-0 border-border bg-card p-4">
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(220px,1.5fr)_minmax(160px,180px)_minmax(160px,170px)_minmax(140px,150px)_minmax(140px,150px)_auto]">
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuario, detalle o modulo..."
                className="pl-9 h-10"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
            </div>

            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Modulo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Todos los modulos</SelectItem>
                {moduleOptions.map((module) => (
                  <SelectItem key={module} value={module}>
                    {getAuditModuleLabel(module)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Accion" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Todas las acciones</SelectItem>
                {actionOptions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {getAuditActionLabel(action)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor="audit-date-from" className="text-xs text-muted-foreground">Fecha inicio</Label>
              <Input id="audit-date-from" className="h-10 w-full min-w-0" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor="audit-date-to" className="text-xs text-muted-foreground">Fecha fin</Label>
              <Input id="audit-date-to" className="h-10 w-full min-w-0" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </div>

            <Button className="h-10 w-full xl:w-auto" variant="outline" onClick={clearFilters} disabled={!hasFilters}>
              Limpiar
            </Button>
          </div>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 text-xs text-muted-foreground">
              Mostrando los ultimos {AUDIT_LIMIT} eventos registrados.
            </p>
            <div className="flex shrink-0 items-center justify-end gap-2">
              <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">{rangeText}</span>
              <Button variant="ghost" size="icon" onClick={goPrev} disabled={!canPrev} className="h-9 w-9" aria-label="Anterior">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={goNext} disabled={!canNext} className="h-9 w-9" aria-label="Siguiente">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-3 xl:hidden">
        {visibleLogs.map((log) => (
          <Card key={log.id} className="p-4 border-border shadow-sm bg-card">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarClock className="h-4 w-4 shrink-0" />
                  <span className="font-medium">{fmtFecha(log.fecha)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="max-w-[220px] truncate font-medium sm:max-w-[420px] lg:max-w-[560px]">{log.usuarioEmail || "-"}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-[11px] font-semibold px-2 py-0.5 bg-muted rounded text-muted-foreground uppercase">
                    {getAuditModuleLabel(log.modulo)}
                  </span>
                </div>
              </div>

              <Badge variant="outline" className={`${getAccionColor(log.accion)} font-bold border shadow-sm text-[10px] px-2 py-1`}>
                {getAuditActionLabel(log.accion)}
              </Badge>
            </div>

            <div className="mt-3">{renderLogDetail(log)}</div>
            <Button variant="outline" className="mt-4 w-full" onClick={() => setSelectedLog(log)}>
              <Eye className="mr-2 h-4 w-4" />
              Ver detalle
            </Button>
          </Card>
        ))}

        {visibleLogs.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No se encontraron registros.
          </Card>
        )}
      </div>

      <Card className="hidden min-w-0 border-border bg-card shadow-md xl:block">
        <div className="overflow-x-auto">
          <Table className="min-w-[1080px]">
            <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-bold py-4">Fecha y hora</TableHead>
                  <TableHead className="font-bold">Usuario</TableHead>
                  <TableHead className="font-bold">Accion</TableHead>
                  <TableHead className="font-bold">Modulo</TableHead>
                  <TableHead className="font-bold min-w-[320px]">Detalle del movimiento</TableHead>
                  <TableHead className="font-bold text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {visibleLogs.map((log) => (
                <TableRow key={log.id} className="hover:bg-muted/20 transition-colors border-b">
                  <TableCell className="text-sm font-medium text-muted-foreground">{fmtFecha(log.fecha)}</TableCell>
                  <TableCell className="text-sm">{log.usuarioEmail || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`${getAccionColor(log.accion)} font-bold border shadow-sm`}>
                      {getAuditActionLabel(log.accion)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-semibold px-2 py-1 bg-muted rounded text-muted-foreground uppercase">
                      {getAuditModuleLabel(log.modulo)}
                    </span>
                  </TableCell>
                  <TableCell>{renderLogDetail(log)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedLog(log)} aria-label="Ver detalle">
                      <Eye className="h-4 w-4 text-primary" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {visibleLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No se encontraron registros.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="sm:max-w-[540px] border-t-4 border-t-primary">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Eye className="h-5 w-5" />
              Detalle del movimiento
            </DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-5">
              <div className="text-xs font-medium text-muted-foreground">{selectedLog.id}</div>

              <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">Movimiento</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-2xl font-bold text-primary">
                      {selectedAmount !== null
                        ? selectedAmount.toLocaleString("es-MX", { style: "currency", currency: "MXN" })
                        : getAuditActionLabel(selectedLog.accion)}
                    </p>
                    <Badge variant="outline" className={`${getAccionColor(selectedLog.accion)} mt-2 font-bold border`}>
                      {getAuditActionLabel(selectedLog.accion)}
                    </Badge>
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 bg-muted rounded text-muted-foreground uppercase">
                    {getAuditModuleLabel(selectedLog.modulo)}
                  </span>
                </div>
              </div>

              <div className="divide-y divide-border rounded-md border">
                <div className="grid grid-cols-[28px_1fr] gap-3 p-4">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Detalle</p>
                    <p className="mt-1 text-sm font-medium">{getAuditDetailLabel(selectedLog.accion, selectedLog.detalle)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-[28px_1fr] gap-3 p-4">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Registrado por</p>
                    <p className="mt-1 text-sm font-medium">{selectedLog.usuarioNombre || selectedLog.usuarioEmail || "Sistema"}</p>
                    <p className="text-xs text-muted-foreground">{selectedLog.usuarioEmail || "-"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-[28px_1fr] gap-3 p-4">
                  <CalendarDays className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Fecha y hora</p>
                    <p className="mt-1 text-sm font-medium">{fmtFecha(selectedLog.fecha)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-[28px_1fr] gap-3 p-4">
                  <Layers className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Modulo y accion</p>
                    <p className="mt-1 text-sm font-medium">
                      {getAuditModuleLabel(selectedLog.modulo)} / {getAuditActionLabel(selectedLog.accion)}
                    </p>
                  </div>
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={() => setSelectedLog(null)}>
                Cerrar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Bitacora;
