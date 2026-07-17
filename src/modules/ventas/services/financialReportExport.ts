import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "@/shared/utils/utils";

export interface FinancialReportExpenseRow {
  categoria: string;
  movimientos: number;
  total: number;
}

export interface FinancialReportProductRow {
  producto: string;
  unidades: number;
  ingreso: number;
  costo: number;
  utilidad: number;
}

export interface FinancialReportMovementRow {
  fecha: string;
  tipo: string;
  concepto: string;
  metodo: string;
  categoria: string;
  monto: number;
  usuario: string;
}

export interface FinancialReportExportData {
  fechaInicio: string;
  fechaFin: string;
  ingresos: number;
  gastosOperativos: number;
  costoMercaderia: number;
  utilidadBruta: number;
  utilidadNeta: number;
  margenNeto: number;
  ingresosPeriodoAnterior: number;
  utilidadPeriodoAnterior: number;
  variacionIngresos: number;
  variacionUtilidad: number;
  gastosPorCategoria: FinancialReportExpenseRow[];
  ventasPorProducto: FinancialReportProductRow[];
  movimientos: FinancialReportMovementRow[];
}

export interface CashCutExportData {
  titulo: string;
  fecha: string;
  estado: string;
  abiertoPor: string;
  cerradoPor: string;
  fondoInicial: number;
  totalIngresos: number;
  totalEgresos: number;
  balanceNeto: number;
  efectivoEsperado: number;
  efectivoContado: number | null;
  diferenciaEfectivo: number | null;
  desgloseMetodos: Array<{
    metodo: string;
    ingresos: number;
    egresos: number;
    neto: number;
  }>;
  movimientos: FinancialReportMovementRow[];
}

const fileDate = () => new Date().toISOString().split("T")[0];

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

export const exportFinancialReportCsv = (report: FinancialReportExportData) => {
  const rows: string[] = [
    ["Reporte financiero", `${report.fechaInicio} a ${report.fechaFin}`].map(csvCell).join(","),
    "",
    ["Metrica", "Monto"].map(csvCell).join(","),
    ["Ingresos", report.ingresos].map(csvCell).join(","),
    ["Gastos operativos", report.gastosOperativos].map(csvCell).join(","),
    ["Costo mercaderia vendida", report.costoMercaderia].map(csvCell).join(","),
    ["Utilidad bruta", report.utilidadBruta].map(csvCell).join(","),
    ["Utilidad neta", report.utilidadNeta].map(csvCell).join(","),
    ["Margen neto", `${report.margenNeto.toFixed(2)}%`].map(csvCell).join(","),
    "",
    ["Gastos por categoria"].map(csvCell).join(","),
    ["Categoria", "Movimientos", "Total"].map(csvCell).join(","),
    ...report.gastosPorCategoria.map((row) => [row.categoria, row.movimientos, row.total].map(csvCell).join(",")),
    "",
    ["Ventas por producto"].map(csvCell).join(","),
    ["Producto", "Unidades", "Ingresos", "Costo", "Utilidad"].map(csvCell).join(","),
    ...report.ventasPorProducto.map((row) => [row.producto, row.unidades, row.ingreso, row.costo, row.utilidad].map(csvCell).join(",")),
    "",
    ["Movimientos del periodo"].map(csvCell).join(","),
    ["Fecha", "Tipo", "Concepto", "Metodo", "Categoria", "Monto", "Usuario"].map(csvCell).join(","),
    ...report.movimientos.map((row) => [
      row.fecha,
      row.tipo,
      row.concepto,
      row.metodo,
      row.categoria,
      row.monto,
      row.usuario,
    ].map(csvCell).join(",")),
  ];

  downloadBlob(
    new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8;" }),
    `reporte_financiero_${fileDate()}.csv`,
  );
};

export const exportFinancialReportPdf = (report: FinancialReportExportData) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });

  doc.setFontSize(16);
  doc.text("Reporte financiero", 40, 40);
  doc.setFontSize(10);
  doc.text(`Periodo: ${report.fechaInicio} a ${report.fechaFin}`, 40, 58);
  doc.text(`Generado: ${fileDate()}`, 40, 74);

  autoTable(doc, {
    startY: 92,
    head: [["Metrica", "Valor"]],
    body: [
      ["Ingresos", formatCurrency(report.ingresos)],
      ["Gastos operativos", formatCurrency(report.gastosOperativos)],
      ["Costo mercaderia vendida", formatCurrency(report.costoMercaderia)],
      ["Utilidad bruta", formatCurrency(report.utilidadBruta)],
      ["Utilidad neta", formatCurrency(report.utilidadNeta)],
      ["Margen neto", `${report.margenNeto.toFixed(2)}%`],
      ["Ingresos periodo anterior", formatCurrency(report.ingresosPeriodoAnterior)],
      ["Utilidad periodo anterior", formatCurrency(report.utilidadPeriodoAnterior)],
      ["Variacion ingresos", `${report.variacionIngresos.toFixed(2)}%`],
      ["Variacion utilidad", `${report.variacionUtilidad.toFixed(2)}%`],
    ],
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: { fillColor: [18, 161, 236] },
    theme: "striped",
    margin: { left: 40, right: 40 },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 18,
    head: [["Categoria", "Movimientos", "Total"]],
    body: report.gastosPorCategoria.map((row) => [
      row.categoria,
      String(row.movimientos),
      formatCurrency(row.total),
    ]),
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: { fillColor: [100, 116, 139] },
    theme: "striped",
    margin: { left: 40, right: 40 },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 18,
    head: [["Producto", "Unidades", "Ingresos", "Costo", "Utilidad"]],
    body: report.ventasPorProducto.map((row) => [
      row.producto,
      String(row.unidades),
      formatCurrency(row.ingreso),
      formatCurrency(row.costo),
      formatCurrency(row.utilidad),
    ]),
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: { fillColor: [16, 185, 129] },
    theme: "striped",
    margin: { left: 40, right: 40 },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 18,
    head: [["Fecha", "Tipo", "Concepto", "Metodo", "Categoria", "Monto", "Usuario"]],
    body: report.movimientos.slice(0, 120).map((row) => [
      row.fecha,
      row.tipo,
      row.concepto,
      row.metodo,
      row.categoria,
      formatCurrency(row.monto),
      row.usuario,
    ]),
    styles: { fontSize: 7, cellPadding: 4 },
    headStyles: { fillColor: [15, 23, 42] },
    theme: "striped",
    margin: { left: 28, right: 28 },
  });

  doc.save(`reporte_financiero_${fileDate()}.pdf`);
};

export const exportCashCutCsv = (cut: CashCutExportData) => {
  const rows: string[] = [
    ["Corte de caja", cut.titulo].map(csvCell).join(","),
    ["Fecha", cut.fecha].map(csvCell).join(","),
    ["Estado", cut.estado].map(csvCell).join(","),
    ["Abrio", cut.abiertoPor].map(csvCell).join(","),
    ["Cerro", cut.cerradoPor].map(csvCell).join(","),
    "",
    ["Metrica", "Monto"].map(csvCell).join(","),
    ["Fondo inicial", cut.fondoInicial].map(csvCell).join(","),
    ["Ingresos", cut.totalIngresos].map(csvCell).join(","),
    ["Egresos", cut.totalEgresos].map(csvCell).join(","),
    ["Balance", cut.balanceNeto].map(csvCell).join(","),
    ["Efectivo esperado", cut.efectivoEsperado].map(csvCell).join(","),
    ["Efectivo contado", cut.efectivoContado ?? ""].map(csvCell).join(","),
    ["Diferencia efectivo", cut.diferenciaEfectivo ?? ""].map(csvCell).join(","),
    "",
    ["Desglose por metodo"].map(csvCell).join(","),
    ["Metodo", "Ingresos", "Egresos", "Neto"].map(csvCell).join(","),
    ...cut.desgloseMetodos.map((row) => [row.metodo, row.ingresos, row.egresos, row.neto].map(csvCell).join(",")),
    "",
    ["Movimientos"].map(csvCell).join(","),
    ["Fecha", "Tipo", "Concepto", "Metodo", "Categoria", "Monto", "Usuario"].map(csvCell).join(","),
    ...cut.movimientos.map((row) => [
      row.fecha,
      row.tipo,
      row.concepto,
      row.metodo,
      row.categoria,
      row.monto,
      row.usuario,
    ].map(csvCell).join(",")),
  ];

  downloadBlob(
    new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8;" }),
    `corte_caja_${cut.fecha}_${fileDate()}.csv`,
  );
};

export const exportCashCutPdf = (cut: CashCutExportData) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });

  doc.setFontSize(16);
  doc.text("Corte de caja", 40, 40);
  doc.setFontSize(10);
  doc.text(`${cut.titulo} | ${cut.fecha} | ${cut.estado}`, 40, 58);
  doc.text(`Abrio: ${cut.abiertoPor} | Cerro: ${cut.cerradoPor}`, 40, 74);

  autoTable(doc, {
    startY: 92,
    head: [["Metrica", "Valor"]],
    body: [
      ["Fondo inicial", formatCurrency(cut.fondoInicial)],
      ["Ingresos", formatCurrency(cut.totalIngresos)],
      ["Egresos", formatCurrency(cut.totalEgresos)],
      ["Balance", formatCurrency(cut.balanceNeto)],
      ["Efectivo esperado", formatCurrency(cut.efectivoEsperado)],
      ["Efectivo contado", cut.efectivoContado === null ? "Pendiente" : formatCurrency(cut.efectivoContado)],
      ["Diferencia efectivo", cut.diferenciaEfectivo === null ? "Pendiente" : formatCurrency(cut.diferenciaEfectivo)],
    ],
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: { fillColor: [18, 161, 236] },
    theme: "striped",
    margin: { left: 40, right: 40 },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 18,
    head: [["Metodo", "Ingresos", "Egresos", "Neto"]],
    body: cut.desgloseMetodos.map((row) => [
      row.metodo,
      formatCurrency(row.ingresos),
      formatCurrency(row.egresos),
      formatCurrency(row.neto),
    ]),
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: { fillColor: [100, 116, 139] },
    theme: "striped",
    margin: { left: 40, right: 40 },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 18,
    head: [["Fecha", "Tipo", "Concepto", "Metodo", "Categoria", "Monto", "Usuario"]],
    body: cut.movimientos.map((row) => [
      row.fecha,
      row.tipo,
      row.concepto,
      row.metodo,
      row.categoria,
      formatCurrency(row.monto),
      row.usuario,
    ]),
    styles: { fontSize: 7, cellPadding: 4 },
    headStyles: { fillColor: [15, 23, 42] },
    theme: "striped",
    margin: { left: 28, right: 28 },
  });

  doc.save(`corte_caja_${cut.fecha}_${fileDate()}.pdf`);
};
