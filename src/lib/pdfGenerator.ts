// src/lib/pdfGenerator.ts (CORREGIDO CON NUEVOS CAMPOS DE PACIENTE)
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Quotation, Patient } from "@/state/AppContext";
import { formatCurrency, formatDate } from "./utils";

// Definir el tipo para la fila de la tabla
type TableRow = (string | number)[];

export const generateQuotationPDF = (
  quotation: Quotation,
  patient: Patient | undefined // El paciente puede no ser encontrado
) => {
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.get("height");
  const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.get("width");
  let y = 20; // Posición vertical inicial

  // --- 1. Título ---
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Cotización Dental", pageWidth / 2, y, { align: "center" });
  y += 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`ID Cotización: #${quotation.id.substring(0, 8)}...`, pageWidth - 20, y, { align: "right" });
  doc.text(`Fecha: ${formatDate(quotation.fecha)}`, 20, y);
  y += 10;

  // --- 2. Datos del Paciente ---
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Paciente:", 20, y);
  y += 7;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  
  if (patient) {
    // ¡CORREGIDO! Usamos los nuevos nombres de campos
    doc.text(`Nombre: ${patient.nombres} ${patient.apellidos}`, 20, y);
    doc.text(`CURP: ${patient.curp || 'N/A'}`, pageWidth / 2, y);
    y += 6;
    doc.text(`Email: ${patient.correo}`, 20, y);
    doc.text(`Teléfono: ${patient.telefonoPrincipal}`, pageWidth / 2, y);
  } else {
    doc.text(`Paciente (ID: ${quotation.pacienteId})`, 20, y);
  }
  y += 10;

  // --- 3. Línea Separadora ---
  doc.setDrawColor(200); // Color gris claro
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // --- 4. Tabla de Items ---
  const tableHead: string[] = ["Servicio / Item", "Cantidad", "Precio Unit.", "Total Item"];
  const tableBody: TableRow[] = [];

  let subtotal = 0;
  quotation.items.forEach(item => {
    const totalItem = item.cantidad * item.precioUnitario;
    subtotal += totalItem;
    tableBody.push([
      item.nombre, 
      item.cantidad,
      formatCurrency(item.precioUnitario),
      formatCurrency(totalItem)
    ]);
  });

  autoTable(doc, {
    startY: y,
    head: [tableHead],
    body: tableBody,
    theme: "striped",
    headStyles: { fillColor: [38, 128, 235] }, // Un color azul
    didDrawPage: (data) => {
      // Actualizar 'y' para saber dónde continuar después de la tabla
      y = data.cursor ? data.cursor.y : 0;
    }
  });

  // 'y' es actualizada por autoTable, así que añadimos espacio
  y = (doc as any).lastAutoTable.finalY + 10;

  // --- 5. Totales (Subtotal, Descuento, Total) ---
  const descuentoAmount = (subtotal * quotation.descuento) / 100;
  const totalFinal = subtotal - descuentoAmount;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal:", 150, y, { align: "right" });
  doc.text(formatCurrency(subtotal), pageWidth - 20, y, { align: "right" });
  y += 7;

  if (quotation.descuento > 0) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 53, 69); // Color rojo (destructive)
    doc.text(`Descuento (${quotation.descuento}%):`, 150, y, { align: "right" });
    doc.text(`-${formatCurrency(descuentoAmount)}`, pageWidth - 20, y, { align: "right" });
    doc.setTextColor(0); // Reset color
    y += 7;
  }

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Total:", 150, y, { align: "right" });
  doc.text(formatCurrency(totalFinal), pageWidth - 20, y, { align: "right" });
  y += 15;

  // --- 6. Notas Adicionales ---
  if (quotation.notas) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Notas Adicionales:", 20, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    // 'splitTextToSize' maneja el salto de línea automático
    const notasLines = doc.splitTextToSize(quotation.notas, pageWidth - 40);
    doc.text(notasLines, 20, y);
    y += (notasLines.length * 5) + 10;
  }

  // --- 7. Pie de Página ---
  if (y > pageHeight - 30) { // Añadir nueva página si no hay espacio
    doc.addPage();
    y = 20; // Reset 'y'
  }
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.text("DentalApp - Cotización generada el " + new Date().toLocaleDateString('es-MX'), pageWidth / 2, pageHeight - 15, { align: "center" });

  // --- 8. Guardar el PDF ---
  doc.save(`cotizacion-${quotation.id.substring(0, 6)}.pdf`);
};