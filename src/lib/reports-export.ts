import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export type ExportColumn<T> = { header: string; accessor: (row: T) => string | number };

export function toCsv<T>(rows: T[], columns: ExportColumn<T>[]): string {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map((c) => escape(c.header)).join(";");
  const body = rows.map((r) => columns.map((c) => escape(c.accessor(r))).join(";")).join("\n");
  return `${head}\n${body}`;
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function loadPdfTools() {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  return { jsPDF, autoTable };
}

export async function exportRowsAsPdf<T>(opts: {
  title: string;
  subtitle?: string;
  filename: string;
  rows: T[];
  columns: ExportColumn<T>[];
}) {
  const { jsPDF, autoTable } = await loadPdfTools();
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text(opts.title, 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `${opts.subtitle ?? ""}${opts.subtitle ? " · " : ""}Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
    14,
    22,
  );
  autoTable(doc, {
    startY: 28,
    head: [opts.columns.map((c) => c.header)],
    body: opts.rows.map((r) => opts.columns.map((c) => String(c.accessor(r) ?? ""))),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });
  doc.save(opts.filename);
}
