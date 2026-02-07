import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Patient, HistoryEntry, Odontogram, Quotation, ToothState } from '@/state/AppContext';

// --- FUNCIÓN: GENERAR PDF DE UNA COTIZACIÓN INDIVIDUAL ---
export const generateQuotationPDF = (patient: Patient, quotation: Quotation) => {
  const doc = new jsPDF();
  // CORRECCIÓN: Acceso directo a propiedades de pageSize
  const pageWidth = doc.internal.pageSize.width;

  // Cabecera Estilizada
  doc.setFillColor(63, 81, 181);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text('PRESUPUESTO DENTAL', 14, 25);

  doc.setFontSize(10);
  doc.text(`Fecha: ${quotation.fecha}`, pageWidth - 50, 20);
  doc.text(`Folio: ${quotation.id.substring(0, 8).toUpperCase()}`, pageWidth - 50, 26);

  // Información del Paciente
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text('PACIENTE:', 14, 50);
  doc.setFont("helvetica", "normal");
  doc.text(`${patient.nombres} ${patient.apellidos}`, 40, 50);

  // Tabla de Conceptos
  autoTable(doc, {
    startY: 60,
    head: [['Cant.', 'Descripción', 'Precio Unit.', 'Subtotal']],
    body: quotation.items.map(item => [
      item.cantidad,
      item.nombre,
      `$${item.precioUnitario.toLocaleString()}`,
      `$${(item.cantidad * item.precioUnitario).toLocaleString()}`
    ]),
    foot: [
      ['', '', 'DESCUENTO', `-$${(quotation.descuento || 0).toLocaleString()}`],
      ['', '', 'TOTAL', `$${quotation.total.toLocaleString()}`]
    ],
    // CORRECCIÓN: Se usa fillColor en lugar de fillGray
    headStyles: { fillColor: [63, 81, 181] },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 20;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('Este presupuesto tiene una validez de 30 días naturales.', 14, finalY);
  
  doc.save(`Cotizacion_${patient.nombres}_${quotation.id.substring(0, 5)}.pdf`);
};

// --- FUNCIÓN: GENERAR EXPEDIENTE COMPLETO ---
export const generatePatientPDF = (
  patient: Patient,
  history: HistoryEntry[],
  odontogram?: Odontogram,
  quotations: Quotation[] = []
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  // Encabezado del Expediente
  doc.setFillColor(63, 81, 181);
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text('EXPEDIENTE CLÍNICO DIGITAL', 14, 25);

  // Datos del Paciente
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text('Información General', 14, 50);
  
  autoTable(doc, {
    startY: 55,
    head: [['Campo', 'Valor']],
    body: [
      ['Nombre', `${patient.nombres} ${patient.apellidos}`],
      ['Teléfono', patient.telefonoPrincipal],
      ['Correo', patient.correo],
      ['F. Nacimiento', patient.fechaNacimiento],
      ['CURP', patient.curp || 'No registrado']
    ],
    // CORRECCIÓN: fillColor con gris RGB [180, 180, 180] en lugar de fillGray
    headStyles: { fillColor: [180, 180, 180] }
  });

  // Historial de Consultas
  const historyY = (doc as any).lastAutoTable.finalY + 15;
  doc.text('Historial de Consultas', 14, historyY);
  
  autoTable(doc, {
    startY: historyY + 5,
    head: [['Fecha', 'Notas / Procedimientos', 'Monto']],
    body: history.map(h => [h.fecha, h.notas, `$${h.total}`]),
    headStyles: { fillColor: [63, 81, 181] }
  });

  // Odontograma (Con Fix de Inferencia de Tipos)
  if (odontogram && odontogram.dientes) {
    doc.addPage();
    doc.setFontSize(16);
    doc.text(`Odontograma: ${odontogram.nombre || 'Estado Inicial'}`, 14, 20);
    
    // CORRECCIÓN: Casting explícito para evitar error de 'unknown'
    const toothEntries = Object.entries(odontogram.dientes) as [string, ToothState][];
    
    const odontogramData = toothEntries.map(([num, data]) => [
      `Diente ${num}`,
      data.estados.join(', '),
      data.textoLibre || 'Sin observaciones'
    ]);

    autoTable(doc, {
      startY: 25,
      head: [['Pieza', 'Estados Detectados', 'Notas']],
      body: odontogramData,
      headStyles: { fillColor: [63, 81, 181] }
    });
  }

  doc.save(`Expediente_${patient.nombres}_${patient.apellidos}.pdf`);
};
