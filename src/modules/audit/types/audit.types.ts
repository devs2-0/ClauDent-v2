export interface AuditLog {
  id: string;
  usuarioEmail?: string;
  accion: string;
  modulo: string;
  detalle: string;
  fecha: any;
}
