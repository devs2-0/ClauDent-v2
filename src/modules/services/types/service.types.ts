export interface Service {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  precio: number;
  categoria: string;
  estado: "activo" | "inactivo";
}
