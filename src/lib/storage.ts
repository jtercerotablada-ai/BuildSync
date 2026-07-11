import { put, del } from "@vercel/blob";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/svg+xml",
  "image/bmp",
  "image/tiff",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
  "video/mp4",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav",
  // Common CAD MIME variants (browsers often send octet-stream for these,
  // which is handled by the extension allowlist below).
  "image/vnd.dwg",
  "image/vnd.dxf",
  "application/acad",
  "application/dxf",
];

const BLOCKED_EXTENSIONS = [
  ".exe", ".bat", ".cmd", ".sh", ".ps1", ".js", ".jsx", ".ts", ".tsx",
  ".html", ".htm", ".php", ".py", ".rb", ".msi", ".dll", ".com", ".scr",
];

// Extensions accepted even when the browser sends a generic MIME type
// (e.g. application/octet-stream) — the reliable signal for CAD/BIM and
// other engineering files a civil/structural firm actually shares. The
// BLOCKED_EXTENSIONS list above always takes precedence.
const ALLOWED_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif", ".svg",
  ".bmp", ".tif", ".tiff",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".txt", ".csv", ".rtf", ".md",
  ".zip",
  ".mp4", ".mov", ".mp3", ".wav", ".m4a",
  // Engineering / CAD / BIM
  ".dwg", ".dxf", ".dwf", ".rvt", ".rfa", ".ifc", ".skp",
  ".step", ".stp", ".iges", ".igs", ".dgn", ".kmz", ".kml",
];

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\.\.\//g, "")
    .replace(/\.\.\\/g, "")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .slice(0, 255);
}

export async function uploadFile(file: File, folder: string) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File size exceeds 10MB limit");
  }

  // Dangerous extensions are always rejected, regardless of MIME.
  const ext = "." + (file.name.split(".").pop()?.toLowerCase() || "");
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    throw new Error(`File extension '${ext}' is not allowed`);
  }

  // Accept the file if EITHER its MIME type is allowlisted OR its
  // extension is a known-safe one — CAD/BIM files frequently arrive as
  // application/octet-stream, so a MIME-only allowlist wrongly rejects
  // the engineering files this firm shares.
  const mimeOk = !!file.type && ALLOWED_MIME_TYPES.includes(file.type);
  const extOk = ALLOWED_EXTENSIONS.includes(ext);
  if (!mimeOk && !extOk) {
    throw new Error(
      `File type '${file.type || ext || "unknown"}' is not allowed`
    );
  }

  const safeName = sanitizeFilename(file.name);
  const pathname = `${folder}/${crypto.randomUUID()}-${safeName}`;

  const blob = await put(pathname, file, {
    access: "public",
  });

  return { url: blob.url, pathname: blob.pathname };
}

export async function deleteFile(url: string) {
  try {
    await del(url);
  } catch (error) {
    console.error("Error deleting file from blob storage:", error);
    throw new Error("Failed to delete file");
  }
}
