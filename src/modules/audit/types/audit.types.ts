export interface AuditLog {
  id: string;
  usuarioId?: string | null;
  usuarioNombre?: string;
  usuarioEmail?: string;
  accion: string;
  modulo: string;
  detalle: string;
  fecha: any;
}
