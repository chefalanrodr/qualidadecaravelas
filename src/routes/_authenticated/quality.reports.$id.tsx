import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileDown, Lightbulb, Loader2, Printer, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RequirePerfil } from "@/components/RequirePerfil";
import { loadQualityReportData } from "@/lib/quality-report-snapshot";

export const Route = createFileRoute("/_authenticated/quality/reports/$id")({
  component: () => <RequirePerfil allow={["gestor", "auditor"]}><QualityReportDetail /></RequirePerfil>,
});

function auditedSectorName(answer: any) {
  return answer.item?.audited_sector?.name ?? null;
}

function isCrossScored(answer: any) {
  const auditedSectorId = answer.item?.audited_sector?.id ?? answer.item?.sector_id;
  return Boolean(auditedSectorId && answer.sector_id && auditedSectorId !== answer.sector_id);
}

function scoringOriginLabel(answer: any) {
  return isCrossScored(answer) ? `Auditado em ${auditedSectorName(answer) ?? "outro setor"}` : null;
}

async function loadPdfTools() {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  return { jsPDF, autoTable };
}

function savePdfDocument(doc: { output: (type: "blob") => Blob }, filename: string) {
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const revoke = () => window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isIos) {
    const opened = window.open(url, "_blank", "noopener");
    if (!opened) window.location.href = url;
    revoke();
    return;
  }

  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch {
    const opened = window.open(url, "_blank", "noopener");
    if (!opened) window.location.href = url;
  } finally {
    revoke();
  }
}

const PDF_IMAGE_FETCH_TIMEOUT_MS = 8_000;
const PDF_IMAGE_LOAD_TIMEOUT_MS = 8_000;
const PDF_IMAGE_MAX_SIDE = 1_100;
const PDF_IMAGE_QUALITY = 0.72;
const EVIDENCE_IMAGE_FETCH_TIMEOUT_MS = 6_000;
const EVIDENCE_IMAGE_MAX_SIDE = 760;
const EVIDENCE_IMAGE_QUALITY = 0.58;
const PRINT_IMAGE_FETCH_TIMEOUT_MS = 5_000;
const PRINT_IMAGE_MAX_SIDE = 520;
const PRINT_IMAGE_QUALITY = 0.48;
const PRINT_IMAGE_WORKERS = 3;

type ImageCompressionOptions = {
  maxSide?: number;
  quality?: number;
  fetchTimeoutMs?: number;
  loadTimeoutMs?: number;
};

const EVIDENCE_IMAGE_OPTIONS: ImageCompressionOptions = {
  maxSide: EVIDENCE_IMAGE_MAX_SIDE,
  quality: EVIDENCE_IMAGE_QUALITY,
  fetchTimeoutMs: EVIDENCE_IMAGE_FETCH_TIMEOUT_MS,
  loadTimeoutMs: EVIDENCE_IMAGE_FETCH_TIMEOUT_MS,
};

const PRINT_IMAGE_OPTIONS: ImageCompressionOptions = {
  maxSide: PRINT_IMAGE_MAX_SIDE,
  quality: PRINT_IMAGE_QUALITY,
  fetchTimeoutMs: PRINT_IMAGE_FETCH_TIMEOUT_MS,
  loadTimeoutMs: PRINT_IMAGE_FETCH_TIMEOUT_MS,
};

function pdfImageFormat(dataUrl: string) {
  return dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function loadImageElement(src: string, timeoutMs = PDF_IMAGE_LOAD_TIMEOUT_MS): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    const timer = window.setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      resolve(null);
    }, timeoutMs);

    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

function canvasToJpegDataUrl(canvas: HTMLCanvasElement, quality: number): Promise<string> {
  return new Promise((resolve) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          resolve(canvas.toDataURL("image/jpeg", quality));
          return;
        }
        resolve(await readBlobAsDataUrl(blob));
      },
      "image/jpeg",
      quality,
    );
  });
}

async function compressImageForPdf(blob: Blob, options: ImageCompressionOptions = {}): Promise<{ data: string; w: number; h: number } | null> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await loadImageElement(objectUrl, options.loadTimeoutMs ?? PDF_IMAGE_LOAD_TIMEOUT_MS);
    if (!img || !img.naturalWidth || !img.naturalHeight) {
      return null;
    }

    const maxSide = options.maxSide ?? PDF_IMAGE_MAX_SIDE;
    const quality = options.quality ?? PDF_IMAGE_QUALITY;
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return { data: await canvasToJpegDataUrl(canvas, quality), w, h };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function fetchAsDataUrl(url: string, options: ImageCompressionOptions = {}): Promise<{ data: string; w: number; h: number } | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), options.fetchTimeoutMs ?? PDF_IMAGE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await compressImageForPdf(blob, options);
  } catch (error) {
    console.warn("Nao consegui carregar imagem para o PDF", error);
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

function printPhotoPlaceholder(label: string) {
  const safeLabel = label.replace(/[<>&"]/g, "");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
      <rect width="640" height="420" fill="#f8fafc"/>
      <rect x="24" y="24" width="592" height="372" rx="18" fill="none" stroke="#cbd5e1" stroke-width="6" stroke-dasharray="18 14"/>
      <text x="320" y="198" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#64748b">Foto indisponivel</text>
      <text x="320" y="238" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="#94a3b8">${safeLabel}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function preparePrintablePhotos(
  photosByAnswer: Map<string, string[]>,
  onProgress: (ready: number, total: number) => void,
) {
  const jobs = [...photosByAnswer.entries()].flatMap(([answerId, urls]) =>
    urls.map((url, index) => ({ answerId, url, index })),
  );
  const result = new Map<string, string[]>();
  const total = jobs.length;
  let cursor = 0;
  let ready = 0;
  onProgress(0, total);

  async function worker() {
    while (cursor < total) {
      const job = jobs[cursor++];
      const converted = await fetchAsDataUrl(job.url, PRINT_IMAGE_OPTIONS);
      const arr = result.get(job.answerId) ?? [];
      arr[job.index] = converted?.data ?? printPhotoPlaceholder(`Evidencia ${job.index + 1}`);
      result.set(job.answerId, arr);
      ready++;
      onProgress(ready, total);
    }
  }

  await Promise.all(Array.from({ length: Math.min(PRINT_IMAGE_WORKERS, total) }, () => worker()));
  return result;
}

function mergePreparedPhotos(original: Map<string, string[]>, prepared: Map<string, string[]>) {
  const merged = new Map<string, string[]>();
  original.forEach((urls, answerId) => {
    const converted = prepared.get(answerId) ?? [];
    merged.set(answerId, urls.map((url, index) => converted[index] ?? url));
  });
  return merged;
}

function waitForNextFrame() {
  return new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

const EMPTY_PHOTOS_BY_ANSWER = new Map<string, string[]>();

function countReportPhotos(photosByAnswer: Map<string, string[]>) {
  return [...photosByAnswer.values()].reduce((sum, urls) => sum + urls.length, 0);
}

type ReportPhotoAnswerRef = {
  id: string | null;
  item_id?: string | null;
};

type ReportPhotoRow = {
  quality_answer_id: string | null;
  storage_path: string | null;
  thumbnail_path?: string | null;
};

function chunkList<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function isMissingAttachmentColumn(error: unknown, column: string) {
  return String((error as { message?: string } | null)?.message ?? "").toLowerCase().includes(column);
}

function answerIdFromStoragePath(
  storagePath: string | null,
  auditId: string,
  answerIdSet: Set<string>,
  answerIdByItemId: Map<string, string>,
) {
  if (!storagePath) return null;
  const parts = storagePath.split("/");
  if (parts[0] !== "quality" || parts[1] !== auditId) return null;
  const itemId = parts[2];
  const answerIdInPath = parts[3];
  if (answerIdInPath && answerIdSet.has(answerIdInPath)) return answerIdInPath;
  return itemId ? answerIdByItemId.get(itemId) ?? null : null;
}

async function loadReportPhotos(auditId: string, answers: ReportPhotoAnswerRef[]) {
  const photosByAnswer = new Map<string, string[]>();
  const answerIds = answers.map((answer) => answer.id).filter(Boolean) as string[];
  if (!answerIds.length) return photosByAnswer;
  const answerIdSet = new Set(answerIds);
  const answerIdByItemId = new Map(
    answers
      .filter((answer) => answer.id && answer.item_id)
      .map((answer) => [String(answer.item_id), String(answer.id)]),
  );

  async function fetchRows(includeThumbnail: boolean) {
    const columns = includeThumbnail ? "quality_answer_id, storage_path, thumbnail_path" : "quality_answer_id, storage_path";
    const rows: ReportPhotoRow[] = [];

    for (const chunk of chunkList(answerIds, 75)) {
      const { data, error } = await (supabase as any)
        .from("attachments")
        .select(columns)
        .in("quality_answer_id", chunk);
      if (error) throw error;
      rows.push(...((data ?? []) as ReportPhotoRow[]));
    }

    const { data: pathData, error: pathError } = await (supabase as any)
      .from("attachments")
      .select(columns)
      .like("storage_path", `quality/${auditId}/%`);
    if (pathError) {
      if (includeThumbnail && isMissingAttachmentColumn(pathError, "thumbnail_path")) throw pathError;
      console.warn("Nao consegui buscar fotos antigas do relatorio pelo caminho", pathError);
    } else {
      rows.push(...((pathData ?? []) as ReportPhotoRow[]));
    }

    return rows;
  }

  let atts: ReportPhotoRow[];
  try {
    atts = await fetchRows(true);
  } catch (error) {
    if (!isMissingAttachmentColumn(error, "thumbnail_path")) throw error;
    atts = await fetchRows(false);
  }

  const rowsByPath = new Map<string, ReportPhotoRow>();
  atts.forEach((row) => {
    if (!row.storage_path) return;
    rowsByPath.set(row.storage_path, row);
  });

  const signedRows = await Promise.all(
    [...rowsByPath.values()].map(async (row) => {
      if (!row.storage_path) return null;
      const answerId = row.quality_answer_id && answerIdSet.has(row.quality_answer_id)
        ? row.quality_answer_id
        : answerIdFromStoragePath(row.storage_path, auditId, answerIdSet, answerIdByItemId);
      if (!answerId) return null;
      const { data } = await supabase.storage.from("attachments").createSignedUrl(row.storage_path, 60 * 60 * 4);
      if (!data?.signedUrl) return null;
      return { answerId, url: data.signedUrl };
    }),
  );

  signedRows.forEach((row) => {
    if (!row) return;
    const arr = photosByAnswer.get(row.answerId) ?? [];
    arr.push(row.url);
    photosByAnswer.set(row.answerId, arr);
  });

  return photosByAnswer;
}

async function exportAuditPdf(params: {
  audit: any;
  byArea: Array<{ name: string; target: number; sectors: any[] }>;
  answersBySector: Map<string, any[]>;
  ncCritCount: number;
  conformCount: number;
  ncCount: number;
  restaurant: { name: string; logo_url: string | null } | null;
  photosByAnswer: Map<string, string[]>;
}) {
  const { jsPDF, autoTable } = await loadPdfTools();
  const { audit, byArea, answersBySector, ncCritCount, conformCount, ncCount, restaurant, photosByAnswer } = params;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 80, "F");

  // Logo
  if (restaurant?.logo_url) {
    const logo = await fetchAsDataUrl(restaurant.logo_url);
    if (logo) {
      const h = 48;
      const w = (logo.w / logo.h) * h;
      try { doc.addImage(logo.data, pdfImageFormat(logo.data), margin, 16, Math.min(w, 120), h); } catch { /* noop */ }
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  const titleX = restaurant?.logo_url ? margin + 140 : margin;
  doc.text(restaurant?.name ?? "Relatório de Auditoria", titleX, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Relatório Semanal de Auditoria de Qualidade", titleX, 46);
  doc.setFontSize(9);
  doc.text(
    `Semana ${audit.iso_week}/${audit.iso_year} — ${audit.week_of_month}ª semana do mês ${audit.month}/${audit.year}`,
    titleX, 60,
  );
  doc.text(
    `Concluída em ${audit.finished_at ? format(new Date(audit.finished_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "—"}`,
    titleX, 72,
  );

  // Summary
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Resumo Geral", margin, 110);
  autoTable(doc, {
    startY: 120,
    theme: "grid",
    head: [["Nota geral", "Conformes", "Não conformes", "NCs críticas"]],
    body: [[`${Number(audit.score).toFixed(1)}%`, String(conformCount), String(ncCount), String(ncCritCount)]],
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    styles: { halign: "center", fontSize: 10 },
  });

  // Per area / sector
  for (const a of byArea) {
    const startY = (doc as any).lastAutoTable.finalY + 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`${a.name}  ·  meta ${a.target}%`, margin, startY);

    const rows: any[] = [];
    a.sectors.forEach((s) => {
      const score = Number(s.score).toFixed(1);
      rows.push([
        { content: `${s.sector?.name ?? "—"}`, styles: { fontStyle: "bold" } },
        { content: `${score}%`, styles: { fontStyle: "bold", halign: "right", textColor: Number(s.score) >= a.target ? [22, 163, 74] : [220, 38, 38] } },
        { content: `${s.conform}C · ${s.non_conform}NC · ${s.na}NA`, styles: { halign: "right", fontSize: 9, textColor: [100, 116, 139] } },
      ]);
      const ncs = (answersBySector.get(s.sector?.id ?? "") ?? []).filter((x) => x.answer === "nao_conforme");
      ncs.forEach((x) => {
        const origin = scoringOriginLabel(x);
        rows.push([
          { content: `   • ${x.item?.title ?? ""}${origin ? ` (${origin})` : ""}${x.observation ? ` — ${x.observation}` : ""}`, colSpan: 3, styles: { textColor: [190, 24, 24], fontSize: 9 } },
        ]);
      });
    });

    autoTable(doc, {
      startY: startY + 6,
      theme: "plain",
      body: rows,
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: { 0: { cellWidth: "auto" }, 1: { cellWidth: 60 }, 2: { cellWidth: 110 } },
    });
  }

  // Photos section — one page per NC with photos
  const ncEntries: Array<{ title: string; observation: string | null; urls: string[] }> = [];
  answersBySector.forEach((arr) => {
    arr.forEach((x) => {
      if (x.answer !== "nao_conforme") return;
      const urls = photosByAnswer.get(x.id) ?? [];
      if (urls.length) {
        const origin = scoringOriginLabel(x);
        ncEntries.push({ title: `${x.item?.title ?? "—"}${origin ? ` (${origin})` : ""}`, observation: x.observation, urls });
      }
    });
  });

  if (ncEntries.length) {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text("Evidências das Não Conformidades", margin, 50);
    let y = 70;
    for (const nc of ncEntries) {
      if (y > pageHeight - 200) { doc.addPage(); y = 50; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(190, 24, 24);
      doc.text(`• ${nc.title}`, margin, y);
      y += 12;
      if (nc.observation) {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(55, 65, 81);
        doc.setFontSize(9);
        const lines = doc.splitTextToSize(nc.observation, pageWidth - margin * 2);
        doc.text(lines, margin, y);
        y += lines.length * 11 + 4;
      }
      // Load and draw photos in a row of up to 3 per line
      const perRow = 3;
      const gap = 8;
      const cellW = (pageWidth - margin * 2 - gap * (perRow - 1)) / perRow;
      const cellH = 110;
      for (let i = 0; i < nc.urls.length; i++) {
        const col = i % perRow;
        if (col === 0 && i > 0) y += cellH + gap;
        if (y + cellH > pageHeight - 40) { doc.addPage(); y = 50; }
        const img = await fetchAsDataUrl(nc.urls[i], EVIDENCE_IMAGE_OPTIONS);
        if (img) {
          try { doc.addImage(img.data, pdfImageFormat(img.data), margin + col * (cellW + gap), y, cellW, cellH); } catch { /* noop */ }
        }
      }
      y += cellH + 16;
    }
  }

  // Signature
  if (audit.auditor_signature) {
    let y = (doc as any).lastAutoTable?.finalY ?? 720;
    y += 30;
    if (y > pageHeight - 120) { doc.addPage(); y = 60; }
    try {
      doc.addImage(audit.auditor_signature, "PNG", pageWidth / 2 - 80, y, 160, 60);
    } catch { /* ignore */ }
    doc.setDrawColor(15, 23, 42);
    doc.line(pageWidth / 2 - 90, y + 66, pageWidth / 2 + 90, y + 66);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("Auditor", pageWidth / 2, y + 80, { align: "center" });
  }

  savePdfDocument(doc, `auditoria-semana-${audit.iso_week}-${audit.iso_year}.pdf`);
}

async function exportQualityFoodStylePdf(params: {
  audit: any;
  byArea: Array<{ name: string; target: number; sectors: any[] }>;
  answersBySector: Map<string, any[]>;
  restaurant: { name: string; logo_url: string | null } | null;
  photosByAnswer: Map<string, string[]>;
}) {
  const { jsPDF, autoTable } = await loadPdfTools();
  const { audit, byArea, answersBySector, restaurant, photosByAnswer } = params;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 30;
  const green: [number, number, number] = [0, 176, 80];
  const red: [number, number, number] = [248, 58, 49];
  const dark: [number, number, number] = [48, 48, 52];
  const muted: [number, number, number] = [108, 108, 112];
  const light: [number, number, number] = [246, 246, 246];
  const border: [number, number, number] = [220, 220, 220];
  const bottom = pageHeight - 36;

  const sections = byArea.flatMap((area) =>
    area.sectors.map((sector) => {
      const answers = (answersBySector.get(sector.sector?.id ?? "") ?? [])
        .slice()
        .sort((x, y) => (auditedSectorName(x) ?? "").localeCompare(auditedSectorName(y) ?? "") || Number(x.item?.position ?? 0) - Number(y.item?.position ?? 0));
      return { area, sector, answers, summary: summarizeReportAnswers(answers) };
    }),
  );
  const allAnswers = sections.flatMap((section) => section.answers);
  const total = summarizeReportAnswers(allAnswers);
  const overallScore = total.possibleWeight ? total.score : Number(audit.score ?? 0);
  const finishedAt = audit.finished_at ? format(new Date(audit.finished_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-";
  const startedAt = audit.started_at ? format(new Date(audit.started_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-";
  const auditorName = audit.auditor?.full_name ?? "Auditor";
  const unitName = restaurant?.name ?? "Raiz cozinha brasileira";
  const photoCount = [...photosByAnswer.values()].reduce((sum, urls) => sum + urls.length, 0);
  const commentCount = allAnswers.filter((answer) => answer.observation || answer.justification).length;
  const insights = buildQualityInsights({ reportAudit: audit, reportAnswers: allAnswers, byArea, answersBySector, photosByAnswer });

  function ensurePage(y: number, needed: number) {
    if (y + needed <= bottom) return y;
    doc.addPage();
    return margin;
  }

  function drawSectionTitle(title: string, y: number) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(18);
    doc.setTextColor(...green);
    doc.text(title, margin, y);
    doc.setDrawColor(...green);
    doc.setLineWidth(0.8);
    doc.line(margin, y + 10, pageWidth - margin, y + 10);
  }

  function drawMeta(label: string, value: string, x: number, y: number) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(label, x, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...dark);
    doc.text(doc.splitTextToSize(value, 220), x, y + 18);
  }

  function drawFaceBox(x: number, y: number, status: string) {
    const isOk = status === "conforme";
    const isBad = status === "nao_conforme";
    const fill: [number, number, number] = isOk ? green : isBad ? red : [160, 160, 160];
    doc.setFillColor(...fill);
    doc.roundedRect(x, y, 50, 32, 4, 4, "F");
    doc.setDrawColor(255, 255, 255);
    doc.setFillColor(255, 255, 255);
    doc.setLineWidth(1.4);
    const cx = x + 25;
    const cy = y + 16;
    doc.circle(cx, cy, 9, "S");
    doc.circle(cx - 4, cy - 3, 1, "F");
    doc.circle(cx + 4, cy - 3, 1, "F");
    if (isBad) {
      doc.line(cx - 5, cy + 6, cx - 2, cy + 3);
      doc.line(cx - 2, cy + 3, cx + 2, cy + 3);
      doc.line(cx + 2, cy + 3, cx + 5, cy + 6);
    } else {
      doc.line(cx - 5, cy + 3, cx - 2, cy + 6);
      doc.line(cx - 2, cy + 6, cx + 2, cy + 6);
      doc.line(cx + 2, cy + 6, cx + 5, cy + 3);
    }
  }

  function drawTinyFace(x: number, y: number, status: string) {
    const isOk = status === "conforme";
    const color = isOk ? green : red;
    doc.setDrawColor(...color);
    doc.setFillColor(...color);
    doc.circle(x + 6, y, 5, "S");
    doc.circle(x + 4, y - 2, 0.7, "F");
    doc.circle(x + 8, y - 2, 0.7, "F");
    if (isOk) {
      doc.line(x + 3, y + 1, x + 5, y + 3);
      doc.line(x + 5, y + 3, x + 9, y + 1);
    } else {
      doc.line(x + 3, y + 3, x + 5, y + 1);
      doc.line(x + 5, y + 1, x + 9, y + 3);
    }
    doc.setTextColor(...dark);
  }

  async function drawPhoto(url: string, x: number, y: number, w: number, h: number) {
    doc.setFillColor(226, 226, 226);
    doc.roundedRect(x, y, w, h, 3, 3, "F");
    const img = await fetchAsDataUrl(url, EVIDENCE_IMAGE_OPTIONS);
    if (!img) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...muted);
      doc.text("Foto indisponivel", x + w / 2, y + h / 2 - 4, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text("verifique o anexo original", x + w / 2, y + h / 2 + 8, { align: "center" });
      return;
    }
    const fit = Math.min((w - 6) / img.w, (h - 6) / img.h);
    const iw = img.w * fit;
    const ih = img.h * fit;
    try {
      doc.addImage(img.data, pdfImageFormat(img.data), x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    } catch {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...muted);
      doc.text("Foto indisponivel", x + w / 2, y + h / 2 - 4, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text("formato nao suportado", x + w / 2, y + h / 2 + 8, { align: "center" });
    }
  }

  async function drawItem(answer: any, startY: number) {
    let y = ensurePage(startY, 66);
    const weight = Number(answer.item?.weight ?? 1);
    const status = answer.answer;
    const title = answer.item?.title ?? "-";
    const origin = scoringOriginLabel(answer);
    const textMax = pageWidth - margin * 2 - 85;
    const titleLines = doc.splitTextToSize(title, textMax) as string[];
    const rowH = Math.max(56, titleLines.length * 11 + (origin ? 36 : 24));

    doc.setDrawColor(...border);
    doc.setLineWidth(0.6);
    doc.line(margin, y, pageWidth - margin, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...dark);
    doc.text(titleLines, margin + 6, y + 28);
    const firstLineWidth = doc.getTextWidth(titleLines[0] ?? "");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(165, 165, 165);
    doc.text(`(Peso ${weight})`, margin + 10 + Math.min(firstLineWidth, textMax - 58), y + 28);
    if (origin) {
      doc.setTextColor(...muted);
      doc.text(origin, margin + 6, y + 42 + (titleLines.length - 1) * 10);
    }

    const faceX = pageWidth - margin - 50;
    drawFaceBox(faceX, y + 10, status);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...dark);
    const itemScore = status === "conforme" ? `${weight}/${weight}` : status === "nao_conforme" ? `0/${weight}` : "N/A";
    doc.text(itemScore, faceX + 50, y + 51, { align: "right" });
    y += rowH;

    const urls = photosByAnswer.get(answer.id) ?? [];
    const photoW = 92;
    const photoH = 112;
    const photoGap = 6;
    for (let i = 0; i < urls.length; i++) {
      const col = i % 3;
      if (col === 0) y = ensurePage(y + (i === 0 ? 4 : photoGap), photoH + 10);
      await drawPhoto(urls[i], margin + 4 + col * (photoW + photoGap), y, photoW, photoH);
      if (col === 2 || i === urls.length - 1) y += photoH + 8;
    }

    const note = answer.observation || answer.justification || "";
    if (note) {
      const lines = doc.splitTextToSize(note, pageWidth - margin * 2 - 44) as string[];
      const noteH = Math.max(28, lines.length * 10 + 16);
      y = ensurePage(y, noteH + 12);
      doc.setFillColor(235, 235, 235);
      doc.roundedRect(margin + 6, y, pageWidth - margin * 2 - 12, noteH, 3, 3, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(210, 210, 210);
      doc.text('"', margin + 14, y + 19);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...dark);
      doc.text(lines, margin + 28, y + 17);
      y += noteH + 10;
    }
    return y + 6;
  }

  if (restaurant?.logo_url) {
    const logo = await fetchAsDataUrl(restaurant.logo_url);
    if (logo) {
      const h = 42;
      const w = Math.min((logo.w / logo.h) * h, 170);
      try { doc.addImage(logo.data, pdfImageFormat(logo.data), pageWidth / 2 - w / 2, 22, w, h); } catch { /* noop */ }
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...muted);
    doc.text("RAIZ COZINHA BRASILEIRA", pageWidth / 2, 50, { align: "center" });
  }
  doc.setDrawColor(...green);
  doc.line(margin, 78, pageWidth - margin, 78);

  doc.setTextColor(...dark);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text(unitName, margin, 104);
  doc.setFontSize(10);
  doc.setTextColor(...muted);
  doc.text(`#${String(audit.id).slice(0, 8)}`, margin, 118);

  doc.setFillColor(224, 224, 224);
  doc.roundedRect(pageWidth - margin - 62, 88, 62, 38, 3, 3, "F");
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(overallScore.toFixed(2), pageWidth - margin - 31, 112, { align: "center" });

  const metaY = 155;
  const metaCol2 = pageWidth / 2;
  drawMeta("Autor", auditorName, margin, metaY);
  drawMeta("Unidade", unitName, margin, metaY + 44);
  drawMeta("Sincronizado em", finishedAt, margin, metaY + 88);
  drawMeta("Cidade", "-", metaCol2, metaY);
  drawMeta("Período de aplicação", `${startedAt} a ${finishedAt}`, metaCol2, metaY + 44);
  drawMeta("Semana", `${audit.iso_week}/${audit.iso_year} - ${audit.week_of_month}ª semana do mês`, metaCol2, metaY + 88);

  doc.setDrawColor(160, 160, 160);
  doc.line(margin, 294, pageWidth - margin, 294);
  drawSectionTitle("Resumo", 330);
  doc.setTextColor(...muted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Itens respondidos", margin, 360);
  doc.text("Itens avaliativos", margin + 170, 360);
  doc.text("Complementos", margin + 305, 360);
  doc.setTextColor(...dark);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(17);
  doc.text(`${allAnswers.length} de ${allAnswers.length}`, margin, 382);
  doc.setFontSize(10);
  drawTinyFace(margin + 170, 374, "nao_conforme");
  doc.text(String(total.nc), margin + 188, 378);
  drawTinyFace(margin + 222, 374, "conforme");
  doc.text(String(total.conform), margin + 240, 378);
  doc.setTextColor(...muted);
  doc.text(`Obs. ${commentCount}`, margin + 305, 378);
  doc.text(`Fotos ${photoCount}`, margin + 365, 378);

  drawSectionTitle("Analise automatica", 420);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, 436, pageWidth - margin * 2, 68, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...dark);
  doc.text(insights.title, margin + 12, 454);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  const insightLines = doc.splitTextToSize(insights.summary, pageWidth - margin * 2 - 24) as string[];
  doc.text(insightLines.slice(0, 2), margin + 12, 468);
  const suggestion = insights.suggestions[0] ?? insights.bullets[0] ?? "";
  if (suggestion) {
    doc.setTextColor(...dark);
    doc.text(doc.splitTextToSize(`Sugestao: ${suggestion}`, pageWidth - margin * 2 - 24).slice(0, 2), margin + 12, 490);
  }

  drawSectionTitle("Resultado detalhado", 540);
  const detailRows = sections.map((section) => [
    section.sector.sector?.name ?? "-",
    section.summary.possibleWeight ? `${section.summary.conformWeight}/${section.summary.possibleWeight} (${section.summary.score.toFixed(2)}%)` : "-",
    section.summary.possibleWeight ? `${section.summary.score.toFixed(2)}%` : "0%",
  ]);
  detailRows.push(["Subtotal", `${total.conformWeight}/${total.possibleWeight} (${overallScore.toFixed(2)}%)`, `${overallScore.toFixed(2)}%`]);
  detailRows.push(["RESULTADO FINAL", overallScore.toFixed(2), `${overallScore.toFixed(2)}%`]);

  autoTable(doc, {
    startY: 554,
    margin: { left: margin, right: margin },
    theme: "plain",
    head: [["Área", "Resultado", "Variação*"]],
    body: detailRows,
    styles: { fontSize: 9, cellPadding: 6, textColor: dark },
    headStyles: { textColor: muted, fontStyle: "bold", fontSize: 10 },
    columnStyles: { 1: { halign: "right", cellWidth: 110 }, 2: { halign: "right", cellWidth: 80 } },
    alternateRowStyles: { fillColor: light },
    didParseCell: (data: any) => {
      if (data.section !== "body") return;
      if (data.row.index >= detailRows.length - 2) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [255, 255, 255];
      }
    },
  });

  let y = ((doc as any).lastAutoTable?.finalY ?? 650) + 34;
  if (y > pageHeight - 90) { doc.addPage(); y = margin; }
  drawSectionTitle("Itens", y);
  y += 32;

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
    const section = sections[sectionIndex];
    y = ensurePage(y, 48);
    doc.setDrawColor(...green);
    doc.setLineWidth(2);
    doc.line(margin + 2, y, margin + 2, y + 24);
    doc.setTextColor(...green);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Área ${sectionIndex + 1} | ${section.sector.sector?.name ?? "-"}`, margin + 8, y + 16);
    doc.setTextColor(...dark);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`${section.summary.conformWeight}/${section.summary.possibleWeight}`, pageWidth - margin, y + 16, { align: "right" });
    y += 34;

    for (const answer of section.answers) {
      y = await drawItem(answer, y);
    }
  }

  if (audit.auditor_signature) {
    y = ensurePage(y + 8, 120);
    try {
      doc.addImage(audit.auditor_signature, "PNG", pageWidth / 2 - 80, y, 160, 60);
    } catch { /* ignore */ }
    doc.setDrawColor(...dark);
    doc.line(pageWidth / 2 - 90, y + 66, pageWidth / 2 + 90, y + 66);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...dark);
    doc.text("Auditor", pageWidth / 2, y + 80, { align: "center" });
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text(`${i} / ${pages}`, margin, pageHeight - 20);
  }

  savePdfDocument(doc, `auditoria-semana-${audit.iso_week}-${audit.iso_year}.pdf`);
}

function summarizeReportAnswers(answers: any[]) {
  let possibleWeight = 0;
  let conformWeight = 0;
  let conform = 0;
  let nc = 0;
  let na = 0;
  answers.forEach((answer) => {
    const weight = Number(answer.item?.weight ?? 1);
    if (answer.answer === "nao_aplicavel") {
      na++;
      return;
    }
    possibleWeight += weight;
    if (answer.answer === "conforme") {
      conform++;
      conformWeight += weight;
    } else if (answer.answer === "nao_conforme") {
      nc++;
    }
  });
  return {
    possibleWeight,
    conformWeight,
    conform,
    nc,
    na,
    score: possibleWeight ? (conformWeight / possibleWeight) * 100 : 0,
  };
}

function reportAnswerLabel(answer: string) {
  if (answer === "conforme") return "Positivo";
  if (answer === "nao_conforme") return "Negativo";
  return "Nao aplicavel";
}

function reportAnswerClass(answer: string) {
  if (answer === "conforme") return "bg-emerald-100 text-emerald-800 border-emerald-300";
  if (answer === "nao_conforme") return "bg-red-100 text-red-800 border-red-300";
  return "bg-slate-100 text-slate-700 border-slate-300";
}

type SectorInsight = {
  id: string;
  name: string;
  area: string;
  score: number;
  target: number;
  nc: number;
  critical: number;
};

type QualityInsights = {
  tone: "success" | "warning" | "critical";
  title: string;
  summary: string;
  worstSectors: SectorInsight[];
  bullets: string[];
  suggestions: string[];
};

function uniqueList(list: string[]) {
  return [...new Set(list.filter(Boolean))];
}

function buildQualityInsights({
  reportAudit,
  reportAnswers,
  byArea,
  answersBySector,
  photosByAnswer,
}: {
  reportAudit: any;
  reportAnswers: any[];
  byArea: Array<{ name: string; target: number; sectors: any[] }>;
  answersBySector: Map<string, any[]>;
  photosByAnswer?: Map<string, string[]> | null;
}): QualityInsights {
  const score = Number(reportAudit.score ?? 0);
  const ncs = reportAnswers.filter((answer) => answer.answer === "nao_conforme");
  const criticalNcs = ncs.filter((answer) => answer.item?.is_critical);
  const crossScoredNcs = ncs.filter(isCrossScored);
  const maintenanceNcs = crossScoredNcs.filter((answer) =>
    String(answer.scoring_sector?.name ?? "").toLowerCase().includes("manuten"),
  );
  const photoGaps = photosByAnswer
    ? ncs.filter((answer) => (photosByAnswer.get(answer.id) ?? []).length === 0).length
    : 0;

  const sectorInsights: SectorInsight[] = [];
  byArea.forEach((area) => {
    area.sectors.forEach((sectorRow) => {
      const sectorId = sectorRow.sector?.id ?? sectorRow.sector?.name ?? "";
      const sectorAnswers = answersBySector.get(sectorId) ?? [];
      const summary = summarizeReportAnswers(sectorAnswers);
      const sectorScore = sectorAnswers.length ? summary.score : Number(sectorRow.score ?? 0);
      const nc = sectorAnswers.length ? summary.nc : Number(sectorRow.non_conform ?? 0);
      if (!sectorId) return;
      sectorInsights.push({
        id: String(sectorId),
        name: sectorRow.sector?.name ?? "Setor sem cadastro",
        area: area.name,
        score: Number.isFinite(sectorScore) ? +sectorScore.toFixed(1) : 0,
        target: area.target,
        nc,
        critical: sectorAnswers.filter((answer) => answer.answer === "nao_conforme" && answer.item?.is_critical).length,
      });
    });
  });

  const worstSectors = sectorInsights
    .filter((sector) => sector.nc > 0 || sector.score < sector.target)
    .sort((a, b) => a.score - b.score || b.critical - a.critical || b.nc - a.nc)
    .slice(0, 3);

  const ncText = ncs.map((answer) => `${answer.item?.title ?? ""} ${answer.observation ?? ""}`).join(" ").toLowerCase();
  const categorySuggestions = uniqueList([
    /temperatura|refriger|camara|câmara|freezer|geladeira/.test(ncText)
      ? "Reforçar controle de temperatura, registros de monitoramento e conferência preventiva dos equipamentos frios."
      : "",
    /validade|etiqueta|identifica|identificação|pvps|fifo/.test(ncText)
      ? "Revisar rotina de identificação, validade e giro de produtos no início e no fechamento do turno."
      : "",
    /limpeza|higiene|suj|resid|gordura|lixeira/.test(ncText)
      ? "Criar conferência visual curta de limpeza por responsável antes da liberação da área."
      : "",
    /piso|parede|teto|lumin|porta|quebrad|infiltra|ralo|manuten/.test(ncText)
      ? "Abrir plano de manutenção com prazo e evidência de conclusão para itens estruturais."
      : "",
    /organiza|armazen|desorgan|estoque|almox/.test(ncText)
      ? "Padronizar organização física, endereçamento e conferência rápida dos pontos de armazenamento."
      : "",
  ]);

  const bullets = uniqueList([
    worstSectors.length
      ? `Ponto de maior atenção: ${worstSectors[0].name}, com ${worstSectors[0].score.toFixed(1)}% e ${worstSectors[0].nc} não conformidade(s).`
      : "Nenhum setor ficou abaixo da meta neste relatório.",
    criticalNcs.length
      ? `${criticalNcs.length} não conformidade(s) crítica(s) exigem prioridade de tratativa.`
      : "Não foram identificadas não conformidades críticas.",
    maintenanceNcs.length
      ? `${maintenanceNcs.length} item(ns) foram direcionados para Manutenção, sem prejudicar a nota do setor auditado.`
      : crossScoredNcs.length
        ? `${crossScoredNcs.length} item(ns) foram pontuados em setor diferente do local auditado.`
        : "",
    photoGaps
      ? `${photoGaps} não conformidade(s) ficaram sem fotografia anexada no relatório.`
      : "",
  ]);

  const suggestions = uniqueList([
    criticalNcs.length ? "Tratar primeiro itens críticos e registrar evidência de correção antes da próxima auditoria." : "",
    worstSectors.length ? `Fazer uma revisão rápida com o responsável por ${worstSectors[0].name} e definir até 3 ações de curto prazo.` : "",
    ...categorySuggestions,
    maintenanceNcs.length ? "Manter Manutenção como setor de pontuação separado para preservar a leitura justa dos setores operacionais." : "",
    !ncs.length ? "Manter a rotina atual e usar a próxima auditoria para confirmar estabilidade do padrão." : "",
  ]).slice(0, 5);

  const tone: QualityInsights["tone"] = score < 70 || criticalNcs.length >= 3 ? "critical" : score < 85 || ncs.length > 0 ? "warning" : "success";
  const title = tone === "success" ? "Operação dentro do padrão" : tone === "critical" ? "Atenção prioritária necessária" : "Melhorias pontuais recomendadas";
  const summary = tone === "success"
    ? `A auditoria fechou com ${score.toFixed(1)}%, sem sinal de risco relevante nos setores avaliados.`
    : `A auditoria fechou com ${score.toFixed(1)}%. As principais oportunidades estão concentradas em ${worstSectors.map((sector) => sector.name).join(", ") || "itens não conformes identificados"}.`;

  return { tone, title, summary, worstSectors, bullets, suggestions };
}

function QualityInsightPanel({ insights }: { insights: QualityInsights }) {
  const toneClass = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-950",
    critical: "border-red-200 bg-red-50 text-red-950",
  }[insights.tone];
  const iconClass = {
    success: "text-emerald-600 bg-emerald-100",
    warning: "text-amber-600 bg-amber-100",
    critical: "text-red-600 bg-red-100",
  }[insights.tone];

  return (
    <section className={`card-elevated p-4 space-y-4 border ${toneClass}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 h-10 w-10 rounded-lg grid place-items-center shrink-0 ${iconClass}`}>
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider opacity-70">Análise automática</div>
          <h2 className="text-lg font-bold">{insights.title}</h2>
          <p className="mt-1 text-sm opacity-85">{insights.summary}</p>
        </div>
      </div>

      {insights.worstSectors.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-3">
          {insights.worstSectors.map((sector) => (
            <div key={sector.id} className="rounded-lg bg-white/70 border border-white/70 p-3">
              <div className="text-xs opacity-70 truncate">{sector.area}</div>
              <div className="font-semibold text-sm truncate">{sector.name}</div>
              <div className="mt-1 flex items-end justify-between gap-2">
                <span className="text-2xl font-bold">{sector.score.toFixed(1)}%</span>
                <span className="text-xs opacity-75">{sector.nc} NC</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg bg-white/70 border border-white/70 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold">
            <AlertTriangle className="h-4 w-4" />
            Principais leituras
          </div>
          <ul className="space-y-1.5 text-sm">
            {insights.bullets.map((item) => (
              <li key={item} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-current shrink-0" />{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg bg-white/70 border border-white/70 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold">
            <Lightbulb className="h-4 w-4" />
            Sugestões de melhoria
          </div>
          <ul className="space-y-1.5 text-sm">
            {insights.suggestions.map((item) => (
              <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

async function waitForPrintImages() {
  const root = document.getElementById("quality-print-report");
  if (!root) return;
  const images = Array.from(root.querySelectorAll("img"));
  const pending = images.filter((img) => !img.complete);
  if (!pending.length) return;

  await Promise.race([
    Promise.all(
      pending.map((img) =>
        new Promise<void>((resolve) => {
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        }),
      ),
    ),
    new Promise<void>((resolve) => window.setTimeout(resolve, 5_000)),
  ]);
}

function QualityPrintReport({
  audit,
  reportAudit,
  byArea,
  reportAnswers,
  answersBySector,
  restaurant,
  photosByAnswer,
  ncCrit,
}: {
  audit: any;
  reportAudit: any;
  byArea: Array<{ name: string; target: number; sectors: any[] }>;
  reportAnswers: any[];
  answersBySector: Map<string, any[]>;
  restaurant: { name: string; logo_url: string | null } | null;
  photosByAnswer: Map<string, string[]>;
  ncCrit: any[];
}) {
  const unitName = restaurant?.name ?? "Raiz cozinha brasileira";
  const auditorName = audit.auditor?.full_name ?? "Auditor";
  const startedAt = audit.started_at ? format(new Date(audit.started_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-";
  const finishedAt = audit.finished_at ? format(new Date(audit.finished_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-";
  const summary = summarizeReportAnswers(reportAnswers);
  const photoCount = [...photosByAnswer.values()].reduce((total, urls) => total + urls.length, 0);
  const commentCount = reportAnswers.filter((answer) => answer.observation || answer.justification).length;
  const insights = buildQualityInsights({ reportAudit, reportAnswers, byArea, answersBySector, photosByAnswer });

  return (
    <article id="quality-print-report" className="quality-print-report bg-white text-slate-900">
      <style>{`
        @media screen {
          #quality-print-report {
            position: fixed;
            left: -10000px;
            top: 0;
            width: 794px;
            pointer-events: none;
          }
        }
        @media print {
          @page { size: A4; margin: 12mm; }
          html, body { background: #ffffff !important; }
          body * { visibility: hidden !important; }
          #quality-print-report, #quality-print-report * { visibility: visible !important; }
          #quality-print-report {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            font-family: Arial, sans-serif;
            color: #111827;
            background: #ffffff;
          }
          .quality-print-avoid { break-inside: avoid; page-break-inside: avoid; }
          .quality-print-page-break { break-before: page; page-break-before: always; }
          .quality-print-photo { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <header className="quality-print-avoid border-b-2 border-emerald-600 pb-4 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-emerald-700">{unitName}</div>
            <h1 className="text-2xl font-bold text-slate-950 mt-1">Relatorio Semanal de Auditoria</h1>
            <p className="text-sm text-slate-600 mt-1">Semana {audit.iso_week}/{audit.iso_year} - {audit.week_of_month}a semana do mes {audit.month}/{audit.year}</p>
          </div>
          {restaurant?.logo_url && <img src={restaurant.logo_url} alt={unitName} className="max-h-14 max-w-[160px] object-contain"/>}
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs text-slate-600 mt-5">
          <div><span className="font-semibold text-slate-900">Auditor:</span> {auditorName}</div>
          <div><span className="font-semibold text-slate-900">Concluida em:</span> {finishedAt}</div>
          <div><span className="font-semibold text-slate-900">Unidade:</span> {unitName}</div>
          <div><span className="font-semibold text-slate-900">Periodo:</span> {startedAt} a {finishedAt}</div>
        </div>
      </header>

      <section className="quality-print-avoid mb-6">
        <h2 className="text-lg font-bold text-emerald-700 border-b border-emerald-300 pb-1">Resumo</h2>
        <div className="grid grid-cols-6 gap-2 mt-3 text-center">
          <div className="rounded border border-slate-200 p-2">
            <div className="text-xl font-bold text-emerald-700">{Number(reportAudit.score).toFixed(1)}%</div>
            <div className="text-[10px] uppercase text-slate-500">Nota geral</div>
          </div>
          <div className="rounded border border-slate-200 p-2">
            <div className="text-xl font-bold">{reportAnswers.length}</div>
            <div className="text-[10px] uppercase text-slate-500">Itens</div>
          </div>
          <div className="rounded border border-slate-200 p-2">
            <div className="text-xl font-bold text-emerald-700">{summary.conform}</div>
            <div className="text-[10px] uppercase text-slate-500">Positivos</div>
          </div>
          <div className="rounded border border-slate-200 p-2">
            <div className="text-xl font-bold text-red-700">{summary.nc}</div>
            <div className="text-[10px] uppercase text-slate-500">Negativos</div>
          </div>
          <div className="rounded border border-slate-200 p-2">
            <div className="text-xl font-bold">{photoCount}</div>
            <div className="text-[10px] uppercase text-slate-500">Fotos</div>
          </div>
          <div className="rounded border border-slate-200 p-2">
            <div className="text-xl font-bold">{commentCount}</div>
            <div className="text-[10px] uppercase text-slate-500">Obs.</div>
          </div>
        </div>
        <div className="text-xs text-slate-500 mt-2">NCs criticas: {ncCrit.length} | Nao aplicaveis: {summary.na}</div>
      </section>

      <section className="quality-print-avoid mb-6 rounded border border-slate-200 bg-slate-50 p-3">
        <h2 className="text-base font-bold text-slate-950">Analise automatica</h2>
        <p className="mt-1 text-sm text-slate-700">{insights.summary}</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-bold uppercase text-slate-500">Principais leituras</div>
            <ul className="mt-1 space-y-1 text-xs text-slate-700">
              {insights.bullets.slice(0, 4).map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
          <div>
            <div className="text-xs font-bold uppercase text-slate-500">Sugestoes</div>
            <ul className="mt-1 space-y-1 text-xs text-slate-700">
              {insights.suggestions.slice(0, 4).map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
        </div>
      </section>

      {byArea.map((area, areaIndex) => (
        <section key={`${area.name}-${areaIndex}`} className="mb-7">
          <h2 className="text-lg font-bold text-emerald-700 border-b border-emerald-300 pb-1">{area.name} <span className="text-xs font-normal text-slate-500">meta {area.target}%</span></h2>
          {area.sectors.map((sectorRow) => {
            const sectorAnswers = (answersBySector.get(sectorRow.sector?.id ?? "") ?? [])
              .slice()
              .sort((a, b) => Number(a.item?.position ?? 0) - Number(b.item?.position ?? 0));
            const sectorSummary = summarizeReportAnswers(sectorAnswers);
            const sectorScore = sectorAnswers.length ? sectorSummary.score : Number(sectorRow.score ?? 0);
            return (
              <div key={sectorRow.sector?.id ?? sectorRow.sector?.name} className="mt-4">
                <div className="quality-print-avoid flex items-center justify-between rounded bg-slate-100 px-3 py-2 border border-slate-200">
                  <div className="font-bold text-sm">{sectorRow.sector?.name ?? "-"}</div>
                  <div className={`font-bold text-sm ${sectorScore >= area.target ? "text-emerald-700" : "text-red-700"}`}>{sectorScore.toFixed(1)}%</div>
                </div>
                <div className="text-xs text-slate-500 mt-1">{sectorSummary.conform} positivos | {sectorSummary.nc} negativos | {sectorSummary.na} N/A</div>
                <div className="mt-2 space-y-3">
                  {sectorAnswers.map((answer, answerIndex) => {
                    const photos = photosByAnswer.get(answer.id) ?? [];
                    const note = answer.observation || answer.justification || "";
                    const origin = scoringOriginLabel(answer);
                    return (
                      <div key={answer.id} className="quality-print-avoid rounded border border-slate-200 p-3">
                        <div className="flex items-start gap-3">
                          <div className="text-xs text-slate-500 w-6 shrink-0">{answerIndex + 1}</div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-semibold text-sm">{answer.item?.title ?? "-"}</div>
                                {origin && <div className="text-[11px] text-slate-500 mt-0.5">{origin}</div>}
                              </div>
                              <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-bold ${reportAnswerClass(answer.answer)}`}>{reportAnswerLabel(answer.answer)}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1">Peso {Number(answer.item?.weight ?? 1)}</div>
                            {note && <div className="mt-2 rounded bg-slate-50 border border-slate-200 p-2 text-xs text-slate-700"><span className="font-semibold">Observacao:</span> {note}</div>}
                            {photos.length > 0 && (
                              <div className="mt-3 grid grid-cols-3 gap-2">
                                {photos.map((url, photoIndex) => (
                                  <img key={`${answer.id}-${photoIndex}`} src={url} alt={`Evidencia ${photoIndex + 1}`} loading="eager" decoding="async" className="quality-print-photo h-28 w-full rounded border border-slate-200 object-cover"/>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      ))}

      {audit.auditor_signature && (
        <footer className="quality-print-avoid mt-10 flex justify-center">
          <div className="w-72 text-center">
            <img src={audit.auditor_signature} alt="Assinatura do auditor" className="mx-auto max-h-20 object-contain"/>
            <div className="border-t border-slate-700 pt-1 text-xs font-bold">Auditor</div>
          </div>
        </footer>
      )}
    </article>
  );
}

function QualityReportDetail() {
  const { id } = Route.useParams();
  const [exportingPdf, setExportingPdf] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [preparedPrintPhotos, setPreparedPrintPhotos] = useState<Map<string, string[]>>(new Map());
  const [printPhotosOverride, setPrintPhotosOverride] = useState<Map<string, string[]> | null>(null);
  const [printPhotoStatus, setPrintPhotoStatus] = useState({ ready: 0, total: 0, loading: false });

  const q = useQuery({
    queryKey: ["q-report", id],
    queryFn: () => loadQualityReportData(id),
    staleTime: 10 * 60_000,
  });

  const reportPhotoRefs = q.data?.answers.map((answer) => ({ id: answer.id, item_id: answer.item_id })) ?? [];
  const answerIds = reportPhotoRefs.map((answer) => answer.id).filter(Boolean) as string[];
  const photosQ = useQuery({
    queryKey: ["q-report-photos", id, answerIds.join("|")],
    queryFn: () => loadReportPhotos(id, reportPhotoRefs),
    enabled: answerIds.length > 0,
    staleTime: 0,
    refetchOnMount: "always",
  });

  useEffect(() => {
    setPreparedPrintPhotos(new Map());
    setPrintPhotosOverride(null);
    setPrintPhotoStatus({ ready: 0, total: 0, loading: false });
  }, [id]);

  if (q.isError) {
    return (
      <div className="card-elevated p-6 text-sm text-destructive">
        Erro ao carregar relatório: {(q.error as Error)?.message ?? "não encontrado"}
      </div>
    );
  }
  if (q.isLoading || !q.data) return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground"/></div>;
  const { audit, sectors, answers, restaurant } = q.data;
  const photosByAnswer = photosQ.data ?? EMPTY_PHOTOS_BY_ANSWER;
  const printablePhotoSource = printPhotosOverride ?? photosByAnswer;
  const printablePhotosByAnswer = mergePreparedPhotos(printablePhotoSource, preparedPrintPhotos);
  const reportAnswers = answers.filter((a) => a.answer);
  const reportSummary = summarizeReportAnswers(reportAnswers);
  const reportAudit = { ...audit, score: reportSummary.possibleWeight ? reportSummary.score : Number(audit.score ?? 0) };

  const answersBySector = new Map<string, typeof answers>();
  reportAnswers.forEach((a) => {
    const arr = answersBySector.get(a.sector_id) ?? [];
    arr.push(a); answersBySector.set(a.sector_id, arr);
  });

  const auditSectorById = new Map<string, any>();
  (sectors as any[]).forEach((row) => {
    const sectorId = row.sector?.id;
    if (sectorId) auditSectorById.set(sectorId, row);
  });

  const reportSectorsById = new Map<string, any>();
  answersBySector.forEach((arr, sectorId) => {
    const scoringSector = arr.find((answer) => answer.scoring_sector)?.scoring_sector;
    const fallbackRow = auditSectorById.get(sectorId);
    const summary = summarizeReportAnswers(arr);
    reportSectorsById.set(sectorId, {
      score: summary.score,
      total_items: summary.conform + summary.nc + summary.na,
      conform: summary.conform,
      non_conform: summary.nc,
      na: summary.na,
      sector: scoringSector ?? fallbackRow?.sector ?? {
        id: sectorId,
        name: "Setor sem cadastro",
        area: { id: "", name: "-", target_score: 80 },
      },
    });
  });
  auditSectorById.forEach((row, sectorId) => {
    if (!reportSectorsById.has(sectorId)) reportSectorsById.set(sectorId, row);
  });
  const reportSectors = [...reportSectorsById.values()];

  // Group by area
  const byArea = new Map<string, { name: string; target: number; sectors: any[] }>();
  reportSectors.forEach((s) => {
    const key = s.sector?.area?.id ?? "";
    if (!byArea.has(key)) byArea.set(key, { name: s.sector?.area?.name ?? "—", target: Number(s.sector?.area?.target_score ?? 80), sectors: [] });
    byArea.get(key)!.sectors.push(s);
  });

  const ncCrit = reportAnswers.filter((a) => a.answer === "nao_conforme" && a.item?.is_critical);
  const areaReports = [...byArea.values()];
  const photosLoading = photosQ.isFetching;
  const photoCount = countReportPhotos(photosByAnswer);
  const smartInsights = buildQualityInsights({
    reportAudit,
    reportAnswers,
    byArea: areaReports,
    answersBySector,
    photosByAnswer: photosQ.data ? photosByAnswer : null,
  });

  async function refreshPhotosForOutput() {
    if (!answerIds.length) return EMPTY_PHOTOS_BY_ANSWER;
    const result = await photosQ.refetch();
    if (result.error) throw result.error;
    return result.data ?? photosByAnswer;
  }

  async function handleExportPdf() {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      const freshPhotos = await refreshPhotosForOutput();
      await exportQualityFoodStylePdf({ audit: reportAudit, byArea: [...byArea.values()], answersBySector, restaurant, photosByAnswer: freshPhotos });
      toast.success("PDF gerado com sucesso");
    } catch (error) {
      console.error("Erro ao gerar PDF da auditoria", error);
      toast.error(`Nao consegui gerar o PDF: ${(error as Error)?.message ?? "erro desconhecido"}`);
    } finally {
      setExportingPdf(false);
    }
  }

  async function handlePrintReport() {
    if (printing) return;
    setPrinting(true);
    try {
      const freshPhotos = await refreshPhotosForOutput();
      const freshPhotoCount = countReportPhotos(freshPhotos);
      setPrintPhotosOverride(freshPhotos);
      if (freshPhotoCount > 0) {
        toast.message("Preparando fotos para impressao...");
        setPrintPhotoStatus({ ready: 0, total: freshPhotoCount, loading: true });
        const prepared = await preparePrintablePhotos(freshPhotos, (ready, total) => {
          setPrintPhotoStatus({ ready, total, loading: ready < total });
        });
        setPreparedPrintPhotos(prepared);
        setPrintPhotoStatus({ ready: freshPhotoCount, total: freshPhotoCount, loading: false });
        await waitForNextFrame();
        await waitForNextFrame();
      }
      await waitForPrintImages();
      window.print();
    } finally {
      setPrinting(false);
    }
  }

  return (
    <>
    <div className="space-y-4 pb-28 print:hidden">
      <div className="flex items-center justify-between">
        <Link to="/quality/reports" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"><ArrowLeft className="w-4 h-4"/> Voltar</Link>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Pré-visualização</span>
      </div>


      <div className="card-elevated p-5">
        <h1 className="text-xl font-bold">Relatório Semanal de Auditoria</h1>
        <div className="text-sm text-muted-foreground">Semana {audit.iso_week}/{audit.iso_year} — {audit.week_of_month}ª semana do mês {audit.month}/{audit.year}</div>
        <div className="text-xs text-muted-foreground">Concluída em {audit.finished_at ? format(new Date(audit.finished_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "—"}</div>
        <div className="mt-3 flex items-center gap-4">
          <div><div className="text-3xl font-bold text-primary">{Number(reportAudit.score).toFixed(1)}%</div><div className="text-xs text-muted-foreground">Nota geral</div></div>
          <div><div className="text-lg font-bold">{reportAnswers.filter((a) => a.answer === "conforme").length}</div><div className="text-xs text-muted-foreground">Conformes</div></div>
          <div><div className="text-lg font-bold text-destructive">{reportAnswers.filter((a) => a.answer === "nao_conforme").length}</div><div className="text-xs text-muted-foreground">NCs</div></div>
          <div><div className="text-lg font-bold text-critical">{ncCrit.length}</div><div className="text-xs text-muted-foreground">Críticas</div></div>
        </div>
      </div>

      <QualityInsightPanel insights={smartInsights} />

      {areaReports.map((a) => (
        <section key={a.name} className="card-elevated p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">{a.name}</h2>
            <span className="text-xs text-muted-foreground">meta {a.target}%</span>
          </div>
          {a.sectors.map((s) => {
            const sectorAnswers = answersBySector.get(s.sector?.id ?? "") ?? [];
            const sectorSummary = summarizeReportAnswers(sectorAnswers);
            const sectorScore = sectorAnswers.length ? sectorSummary.score : Number(s.score ?? 0);
            const conform = sectorAnswers.length ? sectorSummary.conform : s.conform;
            const nc = sectorAnswers.length ? sectorSummary.nc : s.non_conform;
            const na = sectorAnswers.length ? sectorSummary.na : s.na;
            return (
              <div key={s.sector?.id} className="border-l-2 border-primary/30 pl-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm">{s.sector?.name}</div>
                  <div className={`text-sm font-bold ${sectorScore >= a.target ? "text-success" : "text-destructive"}`}>{sectorScore.toFixed(1)}%</div>
                </div>
                <div className="text-xs text-muted-foreground">{conform} conformes · {nc} NCs · {na} N/A</div>
                <ul className="mt-1 text-xs space-y-0.5">
                  {sectorAnswers.filter((x) => x.answer === "nao_conforme").map((x) => (
                    <li key={x.id} className="text-destructive">• {x.item?.title}{scoringOriginLabel(x) ? ` (${scoringOriginLabel(x)})` : ""}{x.observation ? ` — ${x.observation}` : ""}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      ))}

      {audit.auditor_signature && (
        <section className="card-elevated p-5 flex justify-center">
          <div className="text-center max-w-xs w-full">
            <div className="h-24 grid place-items-center border-b border-foreground/40">
              <img src={audit.auditor_signature} alt="Assinatura do auditor" className="max-h-24 object-contain"/>
            </div>
            <div className="text-xs mt-1 font-semibold">Auditor</div>
          </div>
        </section>
      )}

      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <div className="text-xs text-muted-foreground flex-1 min-w-0 truncate">
            {photosLoading
              ? "Carregando fotos do relatório..."
              : photosQ.isError
                ? "Algumas fotos não puderam ser carregadas."
                : printPhotoStatus.total > 0
                  ? `${printPhotoStatus.ready}/${printPhotoStatus.total} foto(s) prontas para impressao`
                  : photoCount > 0
                    ? `${photoCount} foto(s) encontradas`
                    : "Revisou o relatório? Exporte quando quiser."}
          </div>
          {photosQ.isError && (
            <button
              onClick={() => photosQ.refetch()}
              className="rounded-lg border border-border px-3 py-2 text-sm font-semibold shrink-0"
            >
              Recarregar fotos
            </button>
          )}
          <button onClick={handlePrintReport} disabled={printing} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold flex items-center gap-2 shrink-0 disabled:opacity-60">
            {printing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Printer className="w-4 h-4"/>}
            {printing ? "Preparando..." : "Imprimir"}
          </button>
          <button
            onClick={handleExportPdf}
            disabled={exportingPdf}
            className="rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold flex items-center gap-2 shrink-0 disabled:opacity-60"
          >
            {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileDown className="w-4 h-4"/>}
            {exportingPdf ? "Gerando..." : "Exportar PDF"}
          </button>
        </div>
      </div>
    </div>
    <QualityPrintReport
      audit={audit}
      reportAudit={reportAudit}
      byArea={areaReports}
      reportAnswers={reportAnswers}
      answersBySector={answersBySector}
      restaurant={restaurant}
      photosByAnswer={printablePhotosByAnswer}
      ncCrit={ncCrit}
    />
    </>

  );
}
