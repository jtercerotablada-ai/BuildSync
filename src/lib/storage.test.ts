import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const headMock = vi.fn();
vi.mock("@vercel/blob", () => ({
  put: vi.fn(),
  del: vi.fn(),
  get: vi.fn(),
  head: (...args: unknown[]) => headMock(...args),
}));

import {
  BlobRejectedError,
  SAAS_BLOB_ACCESS,
  isDirectUploadPath,
  isPrivateBlobUrl,
  isVercelBlobUrl,
  uploadAccessFor,
  uploadFolderFor,
  verifyUploadedBlob,
} from "./storage";

const TOKEN = "vercel_blob_rw_Uj9oY5mnJtYhxOIu_secretpart";
const OURS = "https://uj9oy5mnjtyhxoiu.public.blob.vercel-storage.com";
const UUID = "123e4567-e89b-42d3-a456-426614174000";

describe("blob url ownership", () => {
  const saved = process.env.BLOB_READ_WRITE_TOKEN;
  beforeEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = TOKEN;
  });
  afterEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = saved;
  });

  it("accepts our store at either access level", () => {
    expect(isVercelBlobUrl(`${OURS}/tasks/t1/a.pdf`)).toBe(true);
    expect(
      isVercelBlobUrl("https://uj9oy5mnjtyhxoiu.private.blob.vercel-storage.com/x")
    ).toBe(true);
  });

  it("refuses another tenant's store even on the blob host suffix", () => {
    expect(
      isVercelBlobUrl("https://attackerstore.public.blob.vercel-storage.com/tasks/t1/a.pdf")
    ).toBe(false);
  });

  it("refuses deeper hosts, http, credentials and garbage", () => {
    expect(isVercelBlobUrl(`https://x.${OURS.slice(8)}/a`)).toBe(false);
    expect(isVercelBlobUrl(OURS.replace("https", "http") + "/a")).toBe(false);
    expect(isVercelBlobUrl(`https://u:p@${OURS.slice(8)}/a`)).toBe(false);
    expect(isVercelBlobUrl("not a url")).toBe(false);
  });

  it("fails closed without a token", () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    expect(isVercelBlobUrl(`${OURS}/a`)).toBe(false);
  });

  it("reads the access label only for our store", () => {
    expect(
      isPrivateBlobUrl("https://uj9oy5mnjtyhxoiu.private.blob.vercel-storage.com/x")
    ).toBe(true);
    expect(isPrivateBlobUrl(`${OURS}/x`)).toBe(false);
    expect(
      isPrivateBlobUrl("https://other.private.blob.vercel-storage.com/x")
    ).toBe(false);
  });
});

describe("direct upload targets", () => {
  it("maps each target to its folder", () => {
    expect(uploadFolderFor({ kind: "task-attachment", taskId: "t1" })).toBe("tasks/t1/");
    expect(uploadFolderFor({ kind: "project-resource", projectId: "p1" })).toBe(
      "projects/p1/resources/"
    );
    expect(uploadFolderFor({ kind: "message-attachment", messageId: "m1" })).toBe(
      "messages/m1/"
    );
    expect(
      uploadFolderFor({ kind: "team-message-attachment", teamId: "x", messageId: "m1" })
    ).toBe("messages/m1/");
    expect(uploadFolderFor({ kind: "form-attachment", formId: "f1" })).toBe("forms/f1/");
    expect(
      uploadFolderFor({ kind: "tracking-reply", formId: "f1", submissionId: "s1", token: "t" })
    ).toBe("tracking/s1/");
  });

  it("keeps anonymous surfaces public whatever the SaaS access is", () => {
    expect(uploadAccessFor({ kind: "form-attachment", formId: "f" })).toBe("public");
    expect(uploadAccessFor({ kind: "task-attachment", taskId: "t" })).toBe(SAAS_BLOB_ACCESS);
  });

  it("only accepts <folder><uuid>/<name>", () => {
    expect(isDirectUploadPath(`tasks/t1/${UUID}/plan.pdf`, "tasks/t1/")).toBe(true);
    expect(isDirectUploadPath(`/tasks/t1/${UUID}/plan.pdf`, "tasks/t1/")).toBe(true);
    // No uuid segment: a guessable address.
    expect(isDirectUploadPath("tasks/t1/plan.pdf", "tasks/t1/")).toBe(false);
    // Another task's folder.
    expect(isDirectUploadPath(`tasks/t2/${UUID}/plan.pdf`, "tasks/t1/")).toBe(false);
    // Traversal and extra depth.
    expect(isDirectUploadPath(`tasks/t1/${UUID}/../x.pdf`, "tasks/t1/")).toBe(false);
    expect(isDirectUploadPath(`tasks/t1/${UUID}/a/b.pdf`, "tasks/t1/")).toBe(false);
  });
});

describe("verifyUploadedBlob", () => {
  const saved = process.env.BLOB_READ_WRITE_TOKEN;
  beforeEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = TOKEN;
    headMock.mockReset();
  });
  afterEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = saved;
  });

  const url = `${OURS}/tasks/t1/${UUID}/plan-abc.pdf`;

  it("returns the store's size and type, not the caller's", async () => {
    headMock.mockResolvedValue({
      pathname: `tasks/t1/${UUID}/plan-abc.pdf`,
      size: 1234,
      contentType: "application/pdf",
    });
    await expect(
      verifyUploadedBlob(url, "plan.pdf", "tasks/t1/", "public", 10_000)
    ).resolves.toEqual({
      url,
      name: "plan.pdf",
      size: 1234,
      mimeType: "application/pdf",
    });
  });

  it("refuses a foreign store before asking it anything", async () => {
    await expect(
      verifyUploadedBlob(
        "https://evil.public.blob.vercel-storage.com/tasks/t1/x.pdf",
        "x.pdf",
        "tasks/t1/",
        "public",
        10_000
      )
    ).rejects.toBeInstanceOf(BlobRejectedError);
    expect(headMock).not.toHaveBeenCalled();
  });

  it("refuses the wrong access level", async () => {
    await expect(
      verifyUploadedBlob(url, "plan.pdf", "tasks/t1/", "private", 10_000)
    ).rejects.toBeInstanceOf(BlobRejectedError);
  });

  it("refuses a blob from another record's folder", async () => {
    headMock.mockResolvedValue({
      pathname: `tasks/t2/${UUID}/plan.pdf`,
      size: 1,
      contentType: "application/pdf",
    });
    await expect(
      verifyUploadedBlob(url, "plan.pdf", "tasks/t1/", "public", 10_000)
    ).rejects.toThrow("not uploaded here");
  });

  it("refuses oversize and blocked types", async () => {
    headMock.mockResolvedValue({
      pathname: `tasks/t1/${UUID}/plan.pdf`,
      size: 20_000,
      contentType: "application/pdf",
    });
    await expect(
      verifyUploadedBlob(url, "plan.pdf", "tasks/t1/", "public", 10_000)
    ).rejects.toThrow("limit");

    headMock.mockResolvedValue({
      pathname: `tasks/t1/${UUID}/run.exe`,
      size: 10,
      contentType: "application/octet-stream",
    });
    await expect(
      verifyUploadedBlob(url, "run.exe", "tasks/t1/", "public", 10_000)
    ).rejects.toBeInstanceOf(BlobRejectedError);
  });

  it("treats a missing blob as not ours", async () => {
    headMock.mockRejectedValue(new Error("not found"));
    await expect(
      verifyUploadedBlob(url, "plan.pdf", "tasks/t1/", "public", 10_000)
    ).rejects.toThrow("not in this app's storage");
  });
});
