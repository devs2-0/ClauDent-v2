export interface Service {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  precio: number;
  categoria: string;
  categoriaId?: string | null;
  estado: "activo" | "inactivo";
}
