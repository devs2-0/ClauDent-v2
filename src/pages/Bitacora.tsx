import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { History, Search, ArrowRightCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const Bitacora: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [filtro, setFiltro] = useState("");

  useEffect(() => {
    const q = query(collection(db, 'bitacora'), orderBy('fecha', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const logsFiltrados = logs.filter(l => 
    l.detalle?.toLowerCase().includes(filtro.toLowerCase()) ||
    l.usuarioEmail?.toLowerCase().includes(filtro.toLowerCase()) ||
    l.modulo?.toLowerCase().includes(filtro.toLowerCase())
  );

  const getAccionColor = (accion: string) => {
    switch (accion) {
      case 'CREATE': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'DELETE': return 'bg-red-100 text-red-700 border-red-200';
      case 'UPDATE': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'LOGIN': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'LOGOUT': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 italic text-primary">
            <History className="h-8 w-8" /> Bitácora
          </h1>
          <p className="text-muted-foreground text-sm">Seguimiento detallado de movimientos</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar usuario, acción o módulo..." 
            className="pl-9 h-11 shadow-sm" 
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>
      </div>

      <Card className="border-border shadow-md overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-bold py-4">Fecha y Hora</TableHead>
                <TableHead className="font-bold">Usuario</TableHead>
                <TableHead className="font-bold">Acción</TableHead>
                <TableHead className="font-bold">Módulo</TableHead>
                <TableHead className="font-bold min-w-[300px]">Detalle del Movimiento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsFiltrados.map((log) => (
                <TableRow key={log.id} className="hover:bg-muted/20 transition-colors border-b">
                  <TableCell className="text-sm font-medium text-slate-600">
                    {log.fecha?.toDate ? log.fecha.toDate().toLocaleString('es-MX', {
                      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                    }) : 'Reciente'}
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
                      {log.detalle}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};

export default Bitacora;