import { Resend } from "resend";

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  return new Resend(apiKey);
}

const FROM = process.env.EMAIL_FROM || "TERCERO TABLADA CIVIL AND STRUCTURAL ENGINEERING INC. <noreply@ttcivilstructural.com>";
const APP_URL = process.env.APP_URL || "http://localhost:3000";

export async function sendVerificationEmail(email: string, token: string) {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;

  try {
    await getResend().emails.send({
      from: FROM,
      to: email,
      subject: "Verify your TERCERO TABLADA CIVIL AND STRUCTURAL ENGINEERING INC. email",
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
      <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a">Verify your email</h1>
      <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.5">
        Click the button below to verify your email address and complete your registration.
      </p>
      <a href="${verifyUrl}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600">
        Verify email
      </a>
      <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;line-height:1.5">
        If you didn't create a TERCERO TABLADA CIVIL AND STRUCTURAL ENGINEERING INC. account, you can safely ignore this email. This link expires in 1 hour.
      </p>
    </div>
  </div>
</body>
</html>`,
    });
  } catch (error) {
    console.error("Failed to send email:", error);
    throw new Error("Failed to send email. Please try again later.");
  }
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  try {
    await getResend().emails.send({
      from: FROM,
      to: email,
      subject: "Reset your TERCERO TABLADA CIVIL AND STRUCTURAL ENGINEERING INC. password",
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
  } catch (error) {
    console.error("Failed to send email:", error);
    throw new Error("Failed to send email. Please try again later.");
  }
}

// ───────────────────────────────────────────────────────────────
// Workspace invitation
// ───────────────────────────────────────────────────────────────

/**
 * sendInvitationEmail — fires when a workspace admin invites a new
 * person to join their firm on BuildSync. Carries the inviter's
 * name, the workspace name, the assigned role, an optional personal
 * note, and the magic accept link (which resolves to /invite/:token).
 *
 * Visual language matches the verify-email / reset-password
 * templates above: black header, gold accents, white content card.
 */
interface InvitationEmailParams {
  email: string;
  token: string;
  inviterName: string;
  workspaceName: string;
  roleLabel: string;
  personalMessage?: string | null;
  projectName?: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendInvitationEmail(params: InvitationEmailParams) {
  const {
    email,
    token,
    inviterName,
    workspaceName,
    roleLabel,
    personalMessage,
    projectName,
  } = params;
  const acceptUrl = `${APP_URL}/invite/${token}`;
  const safeInviter = escapeHtml(inviterName);
  const safeWorkspace = escapeHtml(workspaceName);
  const safeRole = escapeHtml(roleLabel);
  const safeProject = projectName ? escapeHtml(projectName) : null;
  const safeNote = personalMessage ? escapeHtml(personalMessage) : null;

  try {
    await getResend().emails.send({
      from: FROM,
      to: email,
      subject: `${inviterName} invited you to ${workspaceName} on BuildSync`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:#000;padding:24px;text-align:center">
      <img src="https://ttcivilstructural.com/ttc/img/logo-icon.svg" width="32" height="32" alt="TT" style="vertical-align:middle" />
      <span style="color:#fff;font-size:18px;font-weight:600;margin-left:8px">BuildSync</span>
    </div>
    <div style="padding:32px 28px">
      <p style="margin:0 0 6px;color:#a8893a;font-size:11px;letter-spacing:.06em;text-transform:uppercase;font-weight:600">Workspace invitation</p>
      <h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;line-height:1.3">
        ${safeInviter} invited you to join<br/>
        <span style="color:#a8893a">${safeWorkspace}</span>
      </h1>
      <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.55">
        You're being invited to join the firm's workspace on BuildSync — the
        engineering team's cockpit for projects, drawings, RFIs, schedules,
        and collaboration.
      </p>

      <table cellpadding="0" cellspacing="0" style="width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:0 0 20px">
        <tr><td style="padding:14px 16px">
          <table cellpadding="0" cellspacing="0" style="width:100%">
            <tr>
              <td style="color:#64748b;font-size:12px;padding:2px 8px 2px 0">Workspace</td>
              <td style="color:#0f172a;font-size:13px;font-weight:600;padding:2px 0;text-align:right">${safeWorkspace}</td>
            </tr>
            <tr>
              <td style="color:#64748b;font-size:12px;padding:2px 8px 2px 0">Your role</td>
              <td style="color:#0f172a;font-size:13px;font-weight:600;padding:2px 0;text-align:right">${safeRole}</td>
            </tr>
            ${
              safeProject
                ? `<tr>
              <td style="color:#64748b;font-size:12px;padding:2px 8px 2px 0">Starting project</td>
              <td style="color:#0f172a;font-size:13px;font-weight:600;padding:2px 0;text-align:right">${safeProject}</td>
            </tr>`
                : ""
            }
            <tr>
              <td style="color:#64748b;font-size:12px;padding:2px 8px 2px 0">Invited by</td>
              <td style="color:#0f172a;font-size:13px;font-weight:600;padding:2px 0;text-align:right">${safeInviter}</td>
            </tr>
          </table>
        </td></tr>
      </table>

      ${
        safeNote
          ? `<div style="margin:0 0 24px;padding:14px 16px;background:#fffbea;border-left:3px solid #c9a84c;border-radius:6px">
        <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#a8893a;font-weight:600">A note from ${safeInviter}</p>
        <p style="margin:0;color:#0f172a;font-size:14px;line-height:1.5;white-space:pre-wrap">${safeNote}</p>
      </div>`
          : ""
      }

      <a href="${acceptUrl}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600">
        Accept invitation
      </a>

      <p style="margin:20px 0 0;color:#94a3b8;font-size:12px;line-height:1.55">
        If the button doesn't work, copy and paste this link:<br/>
        <a href="${acceptUrl}" style="color:#a8893a;word-break:break-all">${acceptUrl}</a>
      </p>

      <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;line-height:1.55">
        This invitation expires in 7 days. If you didn't expect this email,
        you can safely ignore it.
      </p>
    </div>
  </div>
</body>
</html>`,
    });
  } catch (error) {
    console.error("Failed to send invitation email:", error);
    throw new Error("Failed to send invitation email.");
  }
}

// ───────────────────────────────────────────────────────────────
// Task assignment email
// ───────────────────────────────────────────────────────────────

/**
 * sendTaskAssignedEmail — fires when a user gets a new task
 * assigned to them. Carries the assigner's name, the task name,
 * optional project context + due date, and a direct link.
 *
 * Visual language matches verify-email / reset-password / invite:
 * black header with BuildSync mark, gold accents, structured
 * detail card, dark CTA button.
 */
interface TaskAssignedEmailParams {
  toEmail: string;
  toName: string | null;
  assignerName: string;
  taskName: string;
  projectName: string | null;
  projectId: string | null;
  taskId: string;
  dueDate: Date | null;
}

export async function sendTaskAssignedEmail(
  params: TaskAssignedEmailParams
) {
  const {
    toEmail,
    toName,
    assignerName,
    taskName,
    projectName,
    projectId,
    taskId,
    dueDate,
  } = params;

  // Deep link: if there's a project, drop the user on the project
  // page with the task pre-selected. Otherwise send them to /my-tasks
  // where the assignment lives.
  const url = projectId
    ? `${APP_URL}/projects/${projectId}?task=${taskId}`
    : `${APP_URL}/my-tasks?task=${taskId}`;

  const safeTask = escapeHtml(taskName);
  const safeAssigner = escapeHtml(assignerName);
  const safeProject = projectName ? escapeHtml(projectName) : null;
  const safeRecipient = toName ? escapeHtml(toName) : null;
  const dueLine = dueDate
    ? dueDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  try {
    await getResend().emails.send({
      from: FROM,
      to: toEmail,
      subject: `${assignerName} assigned you: ${taskName}`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:#000;padding:24px;text-align:center">
      <img src="https://ttcivilstructural.com/ttc/img/logo-icon.svg" width="32" height="32" alt="TT" style="vertical-align:middle" />
      <span style="color:#fff;font-size:18px;font-weight:600;margin-left:8px">BuildSync</span>
    </div>
    <div style="padding:32px 28px">
      <p style="margin:0 0 6px;color:#a8893a;font-size:11px;letter-spacing:.06em;text-transform:uppercase;font-weight:600">New task assigned</p>
      <h1 style="margin:0 0 12px;font-size:20px;color:#0f172a;line-height:1.35">
        ${safeRecipient ? `Hi ${safeRecipient}, ` : ""}<br/>
        <span style="color:#a8893a">${safeAssigner}</span> assigned you a task.
      </h1>

      <div style="margin:18px 0 20px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">
        <p style="margin:0 0 6px;color:#0f172a;font-size:15px;font-weight:600;line-height:1.35">${safeTask}</p>
        ${
          safeProject
            ? `<p style="margin:0;color:#64748b;font-size:12px">Project · <span style="color:#0f172a;font-weight:500">${safeProject}</span></p>`
            : ""
        }
        ${
          dueLine
            ? `<p style="margin:4px 0 0;color:#64748b;font-size:12px">Due · <span style="color:#0f172a;font-weight:500">${dueLine}</span></p>`
            : ""
        }
      </div>

      <a href="${url}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600">
        Open task
      </a>

      <p style="margin:20px 0 0;color:#94a3b8;font-size:12px;line-height:1.55">
        Or copy &amp; paste this link:<br/>
        <a href="${url}" style="color:#a8893a;word-break:break-all">${url}</a>
      </p>

      <p style="margin:24px 0 0;color:#94a3b8;font-size:11px;line-height:1.55">
        You're receiving this because you were assigned a task on
        BuildSync. Manage notifications in your account settings.
      </p>
    </div>
  </div>
</body>
</html>`,
    });
  } catch (error) {
    console.error("Failed to send task-assigned email:", error);
    throw new Error("Failed to send task assignment email.");
  }
}
