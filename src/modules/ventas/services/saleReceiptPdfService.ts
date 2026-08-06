import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { DirectSaleProductItem, DirectSaleServiceItem, PaymentMethod } from "../types/cash.types";

export interface SaleReceiptData {
  paymentId: string;
  fecha: string;
  hora: string;
  pacienteNombre: string;
  metodo: PaymentMethod;
  servicios: DirectSaleServiceItem[];
  productos: DirectSaleProductItem[];
  subtotalServicios: number;
  subtotalProductos: number;
  descuento: number;
  total: number;
  notas?: string;
}

const paymentMethodLabel: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

const currency = (value: number) => `$${Number(value || 0).toLocaleString("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

export const generateSaleReceiptPDF = (receipt: SaleReceiptData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const folio = receipt.paymentId.slice(0, 8).toUpperCase();
  const rows = [
    ...receipt.servicios.map((item) => [
      "Tratamiento",
      item.nombre,
      item.cantidad,
      currency(item.precioUnitario),
      currency(item.cantidad * item.precioUnitario),
    ]),
    ...receipt.productos.map((item) => [
      "Producto",
      item.nombre ?? "Producto",
      item.cantidad,
      currency(item.precioUnitario),
      currency(item.cantidad * item.precioUnitario),
    ]),
  ];

  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, pageWidth, 36, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("RECIBO DE VENTA", 14, 23);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Folio: ${folio}`, pageWidth - 58, 17);
  doc.text(`Pago: ${receipt.paymentId}`, pageWidth - 58, 24);

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Datos de la transaccion", 14, 48);
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha: ${receipt.fecha}`, 14, 57);
  doc.text(`Hora: ${receipt.hora}`, 14, 65);
  doc.text(`Paciente / venta: ${receipt.pacienteNombre}`, 14, 73);
  doc.text(`Metodo de pago: ${paymentMethodLabel[receipt.metodo]}`, 14, 81);

  autoTable(doc, {
    startY: 92,
    head: [["Tipo", "Concepto", "Cant.", "Precio unit.", "Subtotal"]],
    body: rows,
    headStyles: { fillColor: [15, 118, 110] },
    styles: { fontSize: 9 },
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
  });

  const finalY = ((doc as any).lastAutoTable?.finalY ?? 100) + 10;
  autoTable(doc, {
    startY: finalY,
    theme: "plain",
    body: [
      ["Subtotal tratamientos", currency(receipt.subtotalServicios)],
      ["Subtotal productos", currency(receipt.subtotalProductos)],
      ["Descuento", `-${currency(receipt.descuento)}`],
      ["Total pagado", currency(receipt.total)],
    ],
    styles: { fontSize: 10 },
    columnStyles: {
      0: { fontStyle: "bold", halign: "right", cellWidth: 130 },
      1: { halign: "right", cellWidth: 45 },
    },
    margin: { left: pageWidth - 190 },
  });

  const notesY = ((doc as any).lastAutoTable?.finalY ?? finalY) + 14;
  if (receipt.notas?.trim()) {
    doc.setFont("helvetica", "bold");
    doc.text("Notas", 14, notesY);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(receipt.notas.trim(), pageWidth - 28), 14, notesY + 8);
  }

  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.text("Comprobante generado digitalmente desde ClauDent.", 14, doc.internal.pageSize.height - 14);
  doc.save(`recibo_venta_${folio}.pdf`);
};
