import nodemailer from 'nodemailer';
import { config, emailConfigured } from '../config.js';

let transporter;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
  }
  return transporter;
}

export async function sendMail({ to, subject, text, html }) {
  if (!emailConfigured()) {
    if (!config.isTest) console.info(`[mail:dev] To: ${to} | ${subject}\n${text}`);
    return { delivered: false };
  }
  await getTransporter().sendMail({ from: config.smtp.from, to, subject, text, html });
  return { delivered: true };
}

const purposeCopy = {
  signup: { subject: 'Your OGEA verification code', intro: 'Use this code to finish creating your OGEA account.' },
  reset: { subject: 'Your OGEA password reset code', intro: 'Use this code to reset your OGEA password.' },
};

export async function sendOtpEmail(to, code, purpose) {
  const copy = purposeCopy[purpose];
  const minutes = config.otp.ttlMinutes;
  const text = `${copy.intro}\n\nCode: ${code}\n\nIt expires in ${minutes} minutes. If you did not request this, you can ignore this email.`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
  <h2 style="margin:0 0 12px">OGEA</h2>
  <p>${copy.intro}</p>
  <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0">${code}</p>
  <p style="color:#666">This code expires in ${minutes} minutes. If you did not request it, ignore this email.</p>
</div>`;
  // The caller only returns the code to the client when delivery failed and we
  // are not in production, so surfacing it here is safe.
  const { delivered } = await sendMail({ to, subject: copy.subject, text, html });
  return { delivered, code };
}
