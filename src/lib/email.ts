import { Resend } from "resend";

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  return new Resend(apiKey);
}

const FROM = process.env.EMAIL_FROM || "BuildSync <onboarding@resend.dev>";
const APP_URL = process.env.APP_URL || "http://localhost:3000";

export async function sendVerificationEmail(email: string, token: string) {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: "Verify your BuildSync email",
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
      <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a">Verify your email</h1>
      <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.5">
        Click the button below to verify your email address and complete your registration.
      </p>
      <a href="${verifyUrl}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600">
        Verify email
      </a>
      <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;line-height:1.5">
        If you didn't create a BuildSync account, you can safely ignore this email. This link expires in 1 hour.
      </p>
    </div>
  </div>
</body>
</html>`,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: "Reset your BuildSync password",
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
      <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a">Reset your password</h1>
      <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.5">
        We received a request to reset your password. Click the button below to choose a new one.
      </p>
      <a href="${resetUrl}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600">
        Reset password
      </a>
      <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;line-height:1.5">
        If you didn't request a password reset, you can safely ignore this email. This link expires in 1 hour.
      </p>
    </div>
  </div>
</body>
</html>`,
  });
}
