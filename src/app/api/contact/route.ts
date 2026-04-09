import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Resend } from "resend";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not configured");
  return new Resend(key);
}
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@buildsync.com";
const FROM = process.env.EMAIL_FROM || "BuildSync <onboarding@resend.dev>";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, phone, service, message, files } = body;

    // Validate required fields
    if (!name || !email || !service || !message) {
      return NextResponse.json(
        { error: "Name, email, service, and message are required" },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    // Save contact submission to database
    const submission = await prisma.contactSubmission.create({
      data: {
        name,
        email,
        phone: phone || null,
        service,
        message,
        files: files || null,
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
      <span style="color:#fff;font-size:20px;font-weight:700">B<span style="font-size:16px">s</span><span style="font-size:10px;margin-left:1px">.</span></span>
      <span style="color:#fff;font-size:20px;font-weight:600;margin-left:8px">BuildSync</span>
    </div>
    <div style="padding:32px 24px">
      <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a">New Contact Submission</h1>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:8px 0;color:#64748b;font-weight:600">Name:</td><td style="padding:8px 0;color:#0f172a">${name}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;font-weight:600">Email:</td><td style="padding:8px 0;color:#0f172a">${email}</td></tr>
        ${phone ? `<tr><td style="padding:8px 0;color:#64748b;font-weight:600">Phone:</td><td style="padding:8px 0;color:#0f172a">${phone}</td></tr>` : ""}
        <tr><td style="padding:8px 0;color:#64748b;font-weight:600">Service:</td><td style="padding:8px 0;color:#0f172a">${service}</td></tr>
      </table>
      <div style="margin-top:16px;padding:16px;background:#f8fafc;border-radius:8px">
        <p style="margin:0 0 4px;color:#64748b;font-size:12px;font-weight:600">Message:</p>
        <p style="margin:0;color:#0f172a;font-size:14px;line-height:1.5;white-space:pre-wrap">${message}</p>
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
