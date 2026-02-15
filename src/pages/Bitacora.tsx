import React, { useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import {
  History,
  Search,
  ArrowRightCircle,
  CalendarClock,
  Mail,
  Layers,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 10;

const Bitacora: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [filtro, setFiltro] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const q = query(collection(db, 'bitacora'), orderBy('fecha', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Filtrado
  const logsFiltrados = useMemo(() => {
    const term = filtro.toLowerCase();
    return logs.filter(l =>
      (l.detalle || "").toLowerCase().includes(term) ||
      (l.usuarioEmail || "").toLowerCase().includes(term) ||
      (l.modulo || "").toLowerCase().includes(term) ||
      (l.accion || "").toLowerCase().includes(term)
    );
  }, [logs, filtro]);

  // Reset de página cuando cambia el filtro (para que no quede en página vacía)
  useEffect(() => {
    setPage(1);
  }, [filtro]);

  // Paginación
  const total = logsFiltrados.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const startIndex = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE;
  const endIndexExclusive = Math.min(startIndex + PAGE_SIZE, total);
  const visibleLogs = useMemo(() => {
    return logsFiltrados.slice(startIndex, endIndexExclusive);
  }, [logsFiltrados, startIndex, endIndexExclusive]);

  const rangeText = useMemo(() => {
    if (total === 0) return "0 de 0";
    // Gmail style: 1–10 de N
    return `${startIndex + 1}–${endIndexExclusive} de ${total}`;
  }, [total, startIndex, endIndexExclusive]);

  const fmtFecha = (fecha: any) => {
    try {
      if (fecha?.toDate) {
        return fecha.toDate().toLocaleString('es-MX', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    } catch {}
    return 'Reciente';
  };

  const getAccionColor = (accion: string) => {
    switch (accion) {
      case 'CREATE': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'DELETE': return 'bg-red-100 text-red-700 border-red-200';
      case 'UPDATE': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'LOGIN':  return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'LOGOUT': return 'bg-amber-100 text-amber-700 border-amber-200';
      default:       return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const canPrev = safePage > 1;
  const canNext = safePage < totalPages;

  const goPrev = () => setPage(p => Math.max(1, p - 1));
  const goNext = () => setPage(p => Math.min(totalPages, p + 1));

  return (
    <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-500 pb-24 lg:pb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2 italic text-primary">
            <History className="h-7 w-7 md:h-8 md:w-8" /> Bitácora
          </h1>
          <p className="text-muted-foreground text-sm">Seguimiento detallado de movimientos</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar usuario, acción o módulo..."
              className="pl-9 h-11 shadow-sm"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
          </div>

          {/* ✅ Paginador estilo Gmail */}
          <div className="flex items-center justify-between sm:justify-end gap-2">
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
              {rangeText}
            </span>

            <Button
              variant="ghost"
              size="icon"
              onClick={goPrev}
              disabled={!canPrev}
              className="h-9 w-9"
              aria-label="Anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={goNext}
              disabled={!canNext}
              className="h-9 w-9"
              aria-label="Siguiente"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ✅ MÓVIL: LISTA EN CARDS (paginada) */}
      <div className="md:hidden space-y-3">
        {visibleLogs.map((log) => (
          <Card key={log.id} className="p-4 border-border shadow-sm bg-card">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarClock className="h-4 w-4" />
                  <span className="font-medium">{fmtFecha(log.fecha)}</span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate max-w-[220px] font-medium text-slate-700">
                    {log.usuarioEmail || '—'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[11px] font-semibold px-2 py-0.5 bg-slate-100 rounded text-slate-600 uppercase tracking-tight">
                    {log.modulo || '—'}
                  </span>
                </div>
              </div>

              <Badge
                variant="outline"
                className={`${getAccionColor(log.accion)} font-bold border shadow-sm text-[10px] px-2 py-1`}
              >
                {log.accion || '—'}
              </Badge>
            </div>

            <div className="mt-3 flex items-start gap-2 text-sm text-slate-800">
              <ArrowRightCircle className="h-4 w-4 text-primary opacity-60 shrink-0 mt-0.5" />
              <p className="leading-snug break-words">
                {log.detalle || '—'}
              </p>
            </div>
          </Card>
        ))}

        {visibleLogs.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No se encontraron registros.
          </Card>
        )}

        {/* Paginador abajo (opcional, pero útil en móvil) */}
        {total > 0 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground font-medium">{rangeText}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={goPrev} disabled={!canPrev}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
              <Button variant="outline" size="sm" onClick={goNext} disabled={!canNext}>
                Siguiente <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ✅ PC/TABLET: TABLA (paginada) */}
      <Card className="hidden md:block border-border shadow-md overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-bold py-4">Fecha y Hora</TableHead>
                <TableHead className="font-bold">Usuario</TableHead>
                <TableHead className="font-bold">Acción</TableHead>
                <TableHead className="font-bold">Módulo</TableHead>
                <TableHead className="font-bold min-w-[320px]">Detalle del Movimiento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleLogs.map((log) => (
                <TableRow key={log.id} className="hover:bg-muted/20 transition-colors border-b">
                  <TableCell className="text-sm font-medium text-slate-600">
                    {fmtFecha(log.fecha)}
                  </TableCell>
                  <TableCell className="text-sm">{log.usuarioEmail}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`${getAccionColor(log.accion)} font-bold border shadow-sm`}>
                      {log.accion}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-semibold px-2 py-1 bg-slate-100 rounded text-slate-600 uppercase tracking-tight">
                      {log.modulo}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-[13px] md:text-[14px] text-slate-800 font-medium">
                      <ArrowRightCircle className="h-4 w-4 text-primary opacity-50 shrink-0" />
                      <span className="break-words">{log.detalle}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {visibleLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No se encontraron registros.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer paginador (PC) */}
        {total > 0 && (
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t bg-card">
            <span className="text-xs text-muted-foreground font-medium">{rangeText}</span>
            <Button variant="ghost" size="icon" onClick={goPrev} disabled={!canPrev} className="h-9 w-9">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={goNext} disabled={!canNext} className="h-9 w-9">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Bitacora;
