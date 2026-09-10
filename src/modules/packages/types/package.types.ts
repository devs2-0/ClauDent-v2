export interface Paquete {
  id: string;
  codigo?: string;
  nombre: string;
  precioTotal: number;
  fechaInicio: string;
  fechaFin: string;
  serviciosIncluidos: {
    servicioId: string;
    nombre: string;
    precioOriginal: number;
    cantidad: number;
  }[];
  estado: "activo" | "inactivo";
}
