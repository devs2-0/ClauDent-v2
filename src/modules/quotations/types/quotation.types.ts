export interface QuotationItem {
  servicioId: string | null;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
}

export interface Quotation {
  id: string;
  pacienteId: string;
  fecha: string;
  items: QuotationItem[];
  descuento: number;
  total: number;
  estado: "borrador" | "activo" | "inactivo";
  notas: string;
}
