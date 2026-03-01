import { put, del } from "@vercel/blob";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function uploadFile(file: File, folder: string) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File size exceeds 10MB limit");
  }

  const pathname = `${folder}/${Date.now()}-${file.name}`;

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
  }
}
