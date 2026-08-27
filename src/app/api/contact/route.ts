import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { Resend } from "resend";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { escapeHtml } from "@/lib/comment-format";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(200)
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"),
  phone: z.string().trim().max(40).nullable().optional(),
  service: z.string().trim().min(1, "Service is required").max(120),
  message: z.string().trim().min(1, "Message is required").max(5000),
  files: z.array(z.record(z.string(), z.unknown())).max(10).nullable().optional(),
});

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not configured");
  return new Resend(key);
}
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@ttcivilstructural.com";
const FROM = process.env.EMAIL_FROM || "TERCERO TABLADA CIVIL AND STRUCTURAL ENGINEERING INC. <noreply@ttcivilstructural.com>";

export async function POST(request: Request) {
  try {
    // Unauthenticated and it sends email through the firm's Resend domain, so
    // it is a spam relay without a bound — both into Juan's inbox and against
    // the sending domain's reputation. Same limiter the auth routes use.
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
    const { name, email, phone, service, message, files } = parsed.data;

    // Save contact submission to database
    const submission = await prisma.contactSubmission.create({
      data: {
        name,
        email,
        phone: phone || null,
        service,
        message,
        // Nullable Json column: no attachments means SQL NULL, not JSON null.
        files: (files ?? Prisma.DbNull) as Prisma.InputJsonValue,
      },
    });

    // Send notification email to admin via Resend
    try {
      await getResend().emails.send({
        from: FROM,
        to: ADMIN_EMAIL,
        subject: `New Contact Submission: ${service}`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:#000;padding:24px;text-align:center">
      <img src="https://ttcivilstructural.com/ttc/img/logo-icon.svg" width="32" height="32" alt="TT" style="vertical-align:middle" />
      <span style="color:#fff;font-size:20px;font-weight:600;margin-left:8px">TERCERO TABLADA CIVIL AND STRUCTURAL ENGINEERING INC.</span>
    </div>
    <div style="padding:32px 24px">
      <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a">New Contact Submission</h1>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:8px 0;color:#64748b;font-weight:600">Name:</td><td style="padding:8px 0;color:#0f172a">${escapeHtml(name)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;font-weight:600">Email:</td><td style="padding:8px 0;color:#0f172a">${escapeHtml(email)}</td></tr>
        ${phone ? `<tr><td style="padding:8px 0;color:#64748b;font-weight:600">Phone:</td><td style="padding:8px 0;color:#0f172a">${escapeHtml(phone)}</td></tr>` : ""}
        <tr><td style="padding:8px 0;color:#64748b;font-weight:600">Service:</td><td style="padding:8px 0;color:#0f172a">${escapeHtml(service)}</td></tr>
      </table>
      <div style="margin-top:16px;padding:16px;background:#f8fafc;border-radius:8px">
        <p style="margin:0 0 4px;color:#64748b;font-size:12px;font-weight:600">Message:</p>
        <p style="margin:0;color:#0f172a;font-size:14px;line-height:1.5;white-space:pre-wrap">${escapeHtml(message)}</p>
      </div>
    </div>
  </div>
</body>
</html>`,
      });
    } catch (emailError) {
      // Log email error but don't fail the request - submission is already saved
      console.error("Failed to send contact notification email:", emailError);
    }

    return NextResponse.json(
      { success: true, id: submission.id },
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
