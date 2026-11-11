import { supabase } from "@/integrations/supabase/client";

const DB_NAME = "confereai_local_evidence_v1";
const STORE = "photos";

export type LocalEvidencePhoto = {
  id: string;
  scope: string;
  name: string;
  type: string;
  dataUrl: string;
  thumbnailDataUrl?: string | null;
  sizeBytes?: number | null;
  thumbnailSizeBytes?: number | null;
  createdAt: number;
};

type EvidenceTarget = "checklist" | "quality";
const EVIDENCE_MAX_SIDE = 1600;
const EVIDENCE_QUALITY = 0.76;
const THUMBNAIL_MAX_SIDE = 420;
const THUMBNAIL_QUALITY = 0.62;
const UPLOAD_TIMEOUT_MS = 35_000;

function canUseIndexedDb() {
  return typeof indexedDB !== "undefined";
}

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!canUseIndexedDb()) return reject(new Error("Armazenamento local indisponivel."));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("scope", "scope", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Falha ao abrir evidencias locais."));
  });
}

function requestResult<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Falha no armazenamento local."));
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Nao consegui ler a foto."));
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Nao consegui ler a foto."));
    reader.readAsDataURL(blob);
  });
}

function loadImage(blob: Blob): Promise<HTMLImageElement | null> {
  if (typeof document === "undefined" || typeof URL === "undefined") return Promise.resolve(null);
  const objectUrl = URL.createObjectURL(blob);
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    img.src = objectUrl;
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

async function compressImage(blob: Blob, maxSide: number, quality: number): Promise<Blob | null> {
  if (!blob.type.startsWith("image/")) return null;
  const img = await loadImage(blob);
  if (!img?.naturalWidth || !img?.naturalHeight) return null;

  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvasToJpegBlob(canvas, quality);
}

async function withTimeout<T>(promise: PromiseLike<T>, message: string): Promise<T> {
  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(message)), UPLOAD_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) window.clearTimeout(timer);
  }
}

function thumbnailFileName(name: string) {
  return safeFileName(name).replace(/\.[a-zA-Z0-9]+$/, "") + "-thumb.jpg";
}

export async function addLocalEvidencePhoto(scope: string, file: File): Promise<LocalEvidencePhoto> {
  const db = await openDb();
  const compressed = await compressImage(file, EVIDENCE_MAX_SIDE, EVIDENCE_QUALITY).catch(() => null);
  const uploadBlob = compressed ?? file;
  const thumbnail = await compressImage(uploadBlob, THUMBNAIL_MAX_SIDE, THUMBNAIL_QUALITY).catch(() => null);
  const photo: LocalEvidencePhoto = {
    id: createId(),
    scope,
    name: file.name || "foto.jpg",
    type: compressed ? "image/jpeg" : file.type || "image/jpeg",
    dataUrl: compressed ? await blobToDataUrl(compressed) : await readFileAsDataUrl(file),
    thumbnailDataUrl: thumbnail ? await blobToDataUrl(thumbnail) : null,
    sizeBytes: uploadBlob.size,
    thumbnailSizeBytes: thumbnail?.size ?? null,
    createdAt: Date.now(),
  };
  const tx = db.transaction(STORE, "readwrite");
  await requestResult(tx.objectStore(STORE).put(photo));
  db.close();
  return photo;
}

export async function listLocalEvidencePhotos(scope: string): Promise<LocalEvidencePhoto[]> {
  if (!canUseIndexedDb()) return [];
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const rows = await requestResult<LocalEvidencePhoto[]>(tx.objectStore(STORE).index("scope").getAll(scope));
  db.close();
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeLocalEvidencePhoto(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  await requestResult(tx.objectStore(STORE).delete(id));
  db.close();
}

function safeFileName(name: string) {
  const clean = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-");
  return clean || "foto.jpg";
}

async function dataUrlToBlob(dataUrl: string) {
  const res = await fetch(dataUrl);
  return res.blob();
}

export async function uploadLocalEvidencePhotos(
  scope: string,
  answerId: string,
  folder: string,
  createdBy: string | null | undefined,
  target: EvidenceTarget = "checklist",
): Promise<{ uploaded: number; failed: number; error?: string }> {
  const photos = await listLocalEvidencePhotos(scope);
  let uploaded = 0;
  for (const photo of photos) {
    const blob = await dataUrlToBlob(photo.dataUrl);
    const thumbBlob = photo.thumbnailDataUrl
      ? await dataUrlToBlob(photo.thumbnailDataUrl)
      : await compressImage(blob, THUMBNAIL_MAX_SIDE, THUMBNAIL_QUALITY).catch(() => null);
    const path = `${folder}/${answerId}/${photo.id}-${safeFileName(photo.name)}`;
    const uploadResult = await withTimeout(supabase.storage
      .from("attachments")
      .upload(path, blob, { contentType: photo.type || blob.type || "image/jpeg", upsert: true }), "Tempo limite ao enviar foto.");
    const { error: uploadError } = uploadResult;
    if (uploadError) return { uploaded, failed: photos.length - uploaded, error: uploadError.message };

    let thumbnailPath: string | null = null;
    if (thumbBlob) {
      const thumbPath = `${folder}/${answerId}/thumb-${photo.id}-${thumbnailFileName(photo.name)}`;
      const thumbResult = await withTimeout(supabase.storage
        .from("attachments")
        .upload(thumbPath, thumbBlob, { contentType: "image/jpeg", upsert: true }), "Tempo limite ao enviar miniatura.");
      if (!thumbResult.error) {
        thumbnailPath = thumbPath;
      } else {
        console.warn("Falha ao enviar miniatura da evidencia", thumbResult.error);
      }
    }

    const baseAttachment = {
      answer_id: target === "checklist" ? answerId : null,
      quality_answer_id: target === "quality" ? answerId : null,
      storage_path: path,
      kind: "photo",
      created_by: createdBy ?? null,
    };
    const attachment = {
      ...baseAttachment,
      thumbnail_path: thumbnailPath,
      mime_type: photo.type || blob.type || "image/jpeg",
      size_bytes: photo.sizeBytes ?? blob.size,
      thumbnail_size_bytes: photo.thumbnailSizeBytes ?? thumbBlob?.size ?? null,
    };
    const { error: insertError } = await (supabase as any).from("attachments").insert(attachment);
    if (insertError) {
      const missingNewColumns = ["thumbnail_path", "mime_type", "size_bytes", "thumbnail_size_bytes"].some((name) =>
        insertError.message?.toLowerCase().includes(name),
      );
      if (!missingNewColumns) return { uploaded, failed: photos.length - uploaded, error: insertError.message };
      const { error: fallbackError } = await supabase.from("attachments").insert(baseAttachment);
      if (fallbackError) return { uploaded, failed: photos.length - uploaded, error: fallbackError.message };
    }

    await removeLocalEvidencePhoto(photo.id);
    uploaded++;
  }
  return { uploaded, failed: 0 };
}
