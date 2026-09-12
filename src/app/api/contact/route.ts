import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { Resend } from "resend";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { escapeHtml } from "@/lib/comment-format";
import {
  CONTACT_MAX_BYTES,
  CONTACT_MAX_FILES,
  isContactBlobUrl,
  isContactFileAllowed,
} from "@/lib/contact-attachments";

/**
 * POST /api/contact — a proposal request from the public site.
 *
 * Stores the submission, notifies the office, and sends the visitor a
 * confirmation. Two rules keep this from being a relay:
 *   • The confirmation NEVER echoes the visitor's message — fixed copy only,
 *     so nobody can use the form to deliver arbitrary text to a third party.
 *   • Attachments are accepted only as blobs of OUR store, at the configured
 *     access level, under `contact/` (see contact-attachments.ts); anything
 *     else on the payload is rejected.
 */

const attachmentSchema = z.object({
  url: z.string().trim().url().max(1000),
  name: z.string().trim().min(1).max(255),
  size: z.number().int().nonnegative().max(CONTACT_MAX_BYTES),
  type: z.string().trim().max(120).optional().default(""),
});

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(200)
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"),
  phone: z.string().trim().max(40).nullable().optional(),
  company: z.string().trim().max(160).nullable().optional(),
  location: z.string().trim().min(1, "Location is required").max(160),
  service: z.string().trim().min(1, "Service is required").max(120),
  message: z.string().trim().min(1, "Message is required").max(5000),
  lang: z.enum(["en", "es"]).optional().default("en"),
  files: z.array(attachmentSchema).max(CONTACT_MAX_FILES).nullable().optional(),
});

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not configured");
  return new Resend(key);
}
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@ttcivilstructural.com";
const FROM =
  process.env.EMAIL_FROM ||
  "Tercero Tablada Civil & Structural Engineering Inc. <noreply@ttcivilstructural.com>";
const SITE = "https://ttcivilstructural.com";
const INBOX = `${SITE}/portal/admin/submissions`;

const COPY = {
  en: {
    subject: "We received your proposal request",
    title: "Your request is with the engineer.",
    body: (service: string, ref: string) =>
      `Thank you. Your proposal request (${escapeHtml(service)}) has been received and will be read by Juan Tercero, PE., M.Sc. You will hear back by email with questions or with a written proposal. Reference: ${ref}.`,
    files: (n: number) => `${n} file${n === 1 ? "" : "s"} attached.`,
    footer: "This is an automatic confirmation. Replying to it reaches the office.",
  },
  es: {
    subject: "Recibimos su solicitud de propuesta",
    title: "Su solicitud está con el ingeniero.",
    body: (service: string, ref: string) =>
      `Gracias. Su solicitud de propuesta (${escapeHtml(service)}) fue recibida y será leída por Juan Tercero, PE., M.Sc. Recibirá respuesta por correo con preguntas o con una propuesta escrita. Referencia: ${ref}.`,
    files: (n: number) => `${n} archivo${n === 1 ? "" : "s"} adjunto${n === 1 ? "" : "s"}.`,
    footer: "Esta es una confirmación automática. Si responde a este correo, llega a la oficina.",
  },
} as const;

function shell(inner: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f4ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0b0c0d">
<div style="max-width:560px;margin:32px auto;background:#fff;border:1px solid #e8e4dc">
  <div style="background:#0b0c0d;padding:22px 24px;border-bottom:2px solid #c99a38">
    <img src="${SITE}/ttc/img/logo-white.png" width="36" height="36" alt="" style="vertical-align:middle;border:0" />
    <span style="color:#f6f4ef;font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin-left:12px;vertical-align:middle">Tercero Tablada Civil &amp; Structural Engineering Inc.</span>
  </div>
  <div style="padding:28px 24px;font-size:15px;line-height:1.6">${inner}</div>
</div></body></html>`;
}

export async function POST(request: Request) {
  try {
    const ip = clientIp(request.headers);
    const limited = rateLimit(`contact:${ip}`, 5, 15 * 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Too many messages. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
      );
    }

    const body = await request.json();
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid submission" },
        { status: 400 }
      );
    }
    const { name, email, phone, company, location, service, message, lang } =
      parsed.data;

    // Attachments: only what our own token route could have produced.
    const files = (parsed.data.files ?? []).map((f) => ({
      url: f.url,
      name: f.name,
      size: f.size,
      type: f.type,
    }));
    for (const f of files) {
      if (!isContactBlobUrl(f.url) || !isContactFileAllowed(f.name, f.type)) {
        return NextResponse.json(
          { error: "An attachment was not accepted" },
          { status: 400 }
        );
      }
    }

    // The schema has no column for company/location/language; they ride in
    // the message body under a divider so the inbox shows everything.
    const extras = [
      `Project location: ${location}`,
      company ? `Company / association: ${company}` : null,
      `Language: ${lang}`,
    ].filter(Boolean);
    const stored = `${message}\n\n---\n${extras.join("\n")}`;

    const submission = await prisma.contactSubmission.create({
      data: {
        name,
        email,
        phone: phone || null,
        service,
        message: stored,
        files: files.length ? (files as Prisma.InputJsonValue) : Prisma.DbNull,
      },
    });
    const ref = submission.id.slice(-8).toUpperCase();

    // Office notification. Attachment links point at the inbox, which streams
    // the private blobs after the firm-workspace check — never at the blob.
    try {
      const fileRows = files.length
        ? `<p style="margin:16px 0 4px;color:#62655f;font-size:12px;font-weight:600">Attachments (${files.length})</p><ul style="margin:0;padding-left:18px">${files
            .map(
              (f, i) =>
                `<li><a href="${INBOX}#${submission.id}">${escapeHtml(f.name)}</a> <span style="color:#62655f">(${Math.round(f.size / 1024)} KB)</span> — <a href="${SITE}/api/files/contact/${submission.id}?i=${i}">open</a></li>`
            )
            .join("")}</ul>`
        : "";
      await getResend().emails.send({
        from: FROM,
        to: ADMIN_EMAIL,
        replyTo: email,
        subject: `Proposal request: ${service} — ${name} (${location})`,
        html: shell(`
          <h1 style="margin:0 0 16px;font-size:20px">New proposal request</h1>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:6px 0;color:#62655f;font-weight:600;width:130px">Name</td><td style="padding:6px 0">${escapeHtml(name)}</td></tr>
            <tr><td style="padding:6px 0;color:#62655f;font-weight:600">Email</td><td style="padding:6px 0"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
            ${phone ? `<tr><td style="padding:6px 0;color:#62655f;font-weight:600">Phone</td><td style="padding:6px 0">${escapeHtml(phone)}</td></tr>` : ""}
            ${company ? `<tr><td style="padding:6px 0;color:#62655f;font-weight:600">Company</td><td style="padding:6px 0">${escapeHtml(company)}</td></tr>` : ""}
            <tr><td style="padding:6px 0;color:#62655f;font-weight:600">Service</td><td style="padding:6px 0">${escapeHtml(service)}</td></tr>
            <tr><td style="padding:6px 0;color:#62655f;font-weight:600">Location</td><td style="padding:6px 0">${escapeHtml(location)}</td></tr>
            <tr><td style="padding:6px 0;color:#62655f;font-weight:600">Language</td><td style="padding:6px 0">${lang}</td></tr>
            <tr><td style="padding:6px 0;color:#62655f;font-weight:600">Reference</td><td style="padding:6px 0">${ref}</td></tr>
          </table>
          <div style="margin-top:16px;padding:16px;background:#f6f4ef">
            <p style="margin:0 0 4px;color:#62655f;font-size:12px;font-weight:600">Project description</p>
            <p style="margin:0;font-size:14px;white-space:pre-wrap">${escapeHtml(message)}</p>
          </div>
          ${fileRows}
          <p style="margin:20px 0 0;font-size:13px"><a href="${INBOX}">Open the inbox</a></p>
        `),
      });
    } catch (emailError) {
      console.error("Failed to send contact notification email:", emailError);
    }

    // Visitor confirmation — fixed copy, never the message.
    let confirmed = false;
    try {
      const t = COPY[lang];
      await getResend().emails.send({
        from: FROM,
        to: email,
        replyTo: ADMIN_EMAIL,
        subject: t.subject,
        html: shell(`
          <h1 style="margin:0 0 12px;font-size:20px">${t.title}</h1>
          <p style="margin:0 0 12px">${t.body(service, ref)}</p>
          ${files.length ? `<p style="margin:0 0 12px;color:#62655f">${t.files(files.length)}</p>` : ""}
          <p style="margin:20px 0 0;font-size:12px;color:#62655f">${t.footer}</p>
        `),
      });
      confirmed = true;
    } catch (emailError) {
      console.error("Failed to send contact confirmation email:", emailError);
    }

    return NextResponse.json(
      { success: true, id: submission.id, ref, confirmed },
      { status: 201 }
    );
  } catch (error) {
    console.error("Contact submission error:", error);
    return NextResponse.json(
      { error: "Failed to process contact submission" },
      { status: 500 }
    );
  }
}
