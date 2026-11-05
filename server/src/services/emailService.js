'use strict';

/**
 * Brevo transactional email wrapper.
 *
 * Security notes:
 * - the API key comes from env and is never logged;
 * - message bodies are never logged (they can contain invitation links);
 * - one retry on 408, 429 and 5xx, with a 10 second timeout.
 *
 * In development and test, Brevo's sandbox header drops the message. That means
 * the code path is exercised but nothing is delivered. The invitation token is
 * still returned to the calling admin so a password can be handed over in person.
 */

const axios = require('axios');
const env = require('../config/env');
const logger = require('../config/logger');

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const RETRYABLE_STATUS = new Set([408, 429]);

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout({ title, intro, actionLabel, actionUrl, footer }) {
  return `<!doctype html>
<html><body style="margin:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#0f6b3f;color:#ffffff;padding:20px 24px;border-radius:12px 12px 0 0">
      <strong style="font-size:18px">PLACA Platform</strong>
    </div>
    <div style="background:#ffffff;padding:24px;border-radius:0 0 12px 12px">
      <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1>
      <p style="line-height:1.6;margin:0 0 16px">${escapeHtml(intro)}</p>
      ${
        actionUrl
          ? `<p style="margin:24px 0"><a href="${escapeHtml(actionUrl)}" style="background:#0f6b3f;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block">${escapeHtml(actionLabel)}</a></p>
             <p style="font-size:12px;color:#4b5563;word-break:break-all">If the button does not work, copy this address into your browser:<br>${escapeHtml(actionUrl)}</p>`
          : ''
      }
      <p style="font-size:13px;color:#4b5563;line-height:1.5;margin-top:24px">${escapeHtml(footer)}</p>
    </div>
  </div>
</body></html>`;
}

async function postToBrevo(payload) {
  const headers = {
    'api-key': env.BREVO_API_KEY,
    'content-type': 'application/json',
    accept: 'application/json',
  };

  // Sandbox drop keeps development inboxes clean while still testing the call.
  if (!env.isProduction) {
    headers['X-Sib-Sandbox'] = 'drop';
  }

  return axios.post(BREVO_ENDPOINT, payload, { headers, timeout: 10000 });
}

/**
 * @param {{to:string, toName?:string, subject:string, html:string, text:string, type:string}} message
 */
async function sendEmail(message) {
  if (!message.to) {
    return { skipped: true, reason: 'no_recipient' };
  }

  if (!env.BREVO_API_KEY) {
    logger.info(`Email not sent (BREVO_API_KEY not configured): type=${message.type}`);
    return { skipped: true, reason: 'not_configured' };
  }

  const payload = {
    sender: { email: env.EMAIL_FROM, name: env.EMAIL_FROM_NAME },
    to: [{ email: message.to, name: message.toName || undefined }],
    subject: message.subject,
    htmlContent: message.html,
    textContent: message.text,
  };

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await postToBrevo(payload);
      logger.info(`Email sent: type=${message.type} status=${response.status}`);
      return { sent: true, sandboxed: !env.isProduction };
    } catch (error) {
      const status = error.response?.status;
      const retryable = RETRYABLE_STATUS.has(status) || (status && status >= 500);
      if (attempt === 1 && retryable) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      // Log only the type and HTTP status, never the address or body.
      logger.error(`Email failed: type=${message.type} status=${status || 'network_error'}`);
      return { sent: false, reason: 'send_failed', status };
    }
  }

  return { sent: false, reason: 'send_failed' };
}

function textWithLink(intro, url, footer) {
  return `${intro}\n\n${url}\n\n${footer}`;
}

async function sendInvitation({ to, name, organizationName, inviteUrl, temporaryPassword }) {
  const footer = 'This invitation expires in 24 hours. If you were not expecting it, ignore this email.';
  const passwordLine = temporaryPassword
    ? ` Temporary password: ${temporaryPassword}. You will be asked to choose a new password when you sign in.`
    : ' Use the link below to choose your password.';
  const intro = `Hello ${name || 'there'}. PLACA has created an account for you${
    organizationName ? ` at ${organizationName}` : ''
  }.${passwordLine}`;

  return sendEmail({
    to,
    toName: name,
    type: 'invitation',
    subject: 'Your PLACA platform account',
    html: layout({
      title: 'Your PLACA account is ready',
      intro,
      actionLabel: 'Set my password',
      actionUrl: inviteUrl,
      footer,
    }),
    text: textWithLink(intro, inviteUrl, footer),
  });
}

async function sendVerification({ to, name, verifyUrl }) {
  const footer = 'This link expires in 24 hours.';
  const intro = `Hello ${name || 'there'}. Please confirm your email address so PLACA can contact you about your reports.`;
  return sendEmail({
    to,
    toName: name,
    type: 'verification',
    subject: 'Confirm your email address',
    html: layout({
      title: 'Confirm your email',
      intro,
      actionLabel: 'Confirm email',
      actionUrl: verifyUrl,
      footer,
    }),
    text: textWithLink(intro, verifyUrl, footer),
  });
}

async function sendPasswordReset({ to, name, resetUrl }) {
  const footer = 'This link expires in 1 hour. If you did not ask to reset your password, ignore this email.';
  const intro = `Hello ${name || 'there'}. Use the link below to choose a new PLACA password.`;
  return sendEmail({
    to,
    toName: name,
    type: 'password_reset',
    subject: 'Reset your PLACA password',
    html: layout({
      title: 'Reset your password',
      intro,
      actionLabel: 'Choose a new password',
      actionUrl: resetUrl,
      footer,
    }),
    text: textWithLink(intro, resetUrl, footer),
  });
}

async function sendReportSubmitted({ to, name, organizationName, periodLabel, reportUrl }) {
  const footer = 'This is an automatic message from the PLACA reporting platform.';
  const intro = `${organizationName} sent its report for ${periodLabel}. Please review it when you have a moment.`;
  return sendEmail({
    to,
    toName: name,
    type: 'report_submitted',
    subject: `Report submitted: ${organizationName}, ${periodLabel}`,
    html: layout({
      title: 'A partner report is ready for review',
      intro,
      actionLabel: 'Open the report',
      actionUrl: reportUrl,
      footer,
    }),
    text: textWithLink(intro, reportUrl, footer),
  });
}

async function sendAlert({ to, name, title, message, link }) {
  const footer = 'You can change which alerts you receive in your account settings.';
  return sendEmail({
    to,
    toName: name,
    type: 'alert',
    subject: title,
    html: layout({ title, intro: message, actionLabel: 'Open the platform', actionUrl: link, footer }),
    text: textWithLink(message, link, footer),
  });
}

module.exports = {
  sendEmail,
  sendInvitation,
  sendVerification,
  sendPasswordReset,
  sendReportSubmitted,
  sendAlert,
};
