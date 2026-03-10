import nodemailer from 'nodemailer';
import { getBusinessEmail } from './business.js';

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('SMTP credentials are missing.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

export async function sendReportEmails({ ownerEmail, customerEmail, subject, textBody, htmlBody }) {
  const resolvedOwner = ownerEmail || getBusinessEmail();
  const from = process.env.EMAIL_FROM || resolvedOwner;
  const transport = getTransport();

  const message = { from, subject, text: textBody, html: htmlBody };

  await transport.sendMail({ ...message, to: customerEmail });
  await transport.sendMail({ ...message, to: resolvedOwner, subject: `[Owner Copy] ${subject}` });
}

export async function sendLeadNotificationEmail({ ownerEmail, lead }) {
  const resolvedOwner = ownerEmail || getBusinessEmail();
  const from = process.env.EMAIL_FROM || resolvedOwner;
  const transport = getTransport();

  const subject = `[Lead] ${lead.company} (${lead.monthlyCases} cases/mo)`;
  const lines = [
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    `Company: ${lead.company}`,
    `Monthly Cases: ${lead.monthlyCases}`,
    `Budget: ${lead.budget || 'not provided'}`,
    `Message: ${lead.message || 'none'}`
  ];

  await transport.sendMail({ from, to: resolvedOwner, subject, text: lines.join('\n') });
}

export async function sendOpsAlertEmail({ ownerEmail, subject, lines = [] }) {
  const resolvedOwner = ownerEmail || getBusinessEmail();
  const from = process.env.EMAIL_FROM || resolvedOwner;
  const transport = getTransport();

  await transport.sendMail({
    from,
    to: resolvedOwner,
    subject: `[Ops Alert] ${subject}`,
    text: lines.join('\n')
  });
}
