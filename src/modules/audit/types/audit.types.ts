export interface AuditLog {
  id: string;
  usuarioEmail?: string;
  usuarioNombre?: string;
  usuarioId?: string | null;
  accion: string;
  modulo: string;
  detalle: string;
  fecha: any;
}
