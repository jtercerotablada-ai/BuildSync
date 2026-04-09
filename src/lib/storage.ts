import { put, del } from "@vercel/blob";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
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
];

const BLOCKED_EXTENSIONS = [
  ".exe", ".bat", ".cmd", ".sh", ".ps1", ".js", ".jsx", ".ts", ".tsx",
  ".html", ".htm", ".php", ".py", ".rb", ".msi", ".dll", ".com", ".scr",
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

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error(`File type '${file.type}' is not allowed`);
  }

  // Check extension
  const ext = "." + (file.name.split(".").pop()?.toLowerCase() || "");
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    throw new Error(`File extension '${ext}' is not allowed`);
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
