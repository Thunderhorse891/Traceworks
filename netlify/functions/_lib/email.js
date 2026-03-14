import { getBusinessEmail } from './business.js';

let cachedNodemailer;

async function loadNodemailer() {
  if (cachedNodemailer) return cachedNodemailer;
  try {
    const mod = await import('nodemailer');
    cachedNodemailer = mod.default || mod;
    return cachedNodemailer;
  } catch (error) {
    throw new Error(`Nodemailer dependency is unavailable. Install dependencies before sending email. (${String(error?.message || error)})`);
  }
}

async function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('SMTP credentials are missing.');
  }

  const nodemailer = await loadNodemailer();
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
  const transport = await getTransport();

  const message = {
    from,
    subject,
    text: textBody,
    html: htmlBody
  };

  await transport.sendMail({ ...message, to: customerEmail });
  await transport.sendMail({ ...message, to: resolvedOwner, subject: `[Owner Copy] ${subject}` });
}

export async function sendOrderConfirmationEmail({
  ownerEmail,
  customerEmail,
  caseRef,
  packageName,
  subjectName,
  county,
  state,
  deliveryHours,
  statusUrl,
  intakeSummary,
}) {
  const resolvedOwner = ownerEmail || getBusinessEmail();
  const from = process.env.EMAIL_FROM || resolvedOwner;
  const transport = await getTransport();
  const eta = deliveryHours ? `Estimated delivery window: within ${deliveryHours} hours of confirmed payment.` : 'Estimated delivery window depends on source availability and package scope.';
  const location = [county, state].filter(Boolean).join(', ') || 'target county not provided';
  const safeStatusUrl = statusUrl || '';

  const subject = `[${caseRef}] Payment confirmed — ${packageName}`;
  const textBody = [
    'TraceWorks payment confirmation',
    '',
    `Case reference: ${caseRef}`,
    `Package: ${packageName}`,
    `Primary subject: ${subjectName || 'not provided'}`,
    `Jurisdiction: ${location}`,
    eta,
    intakeSummary ? `Intake summary: ${intakeSummary}` : '',
    safeStatusUrl ? `Track your order: ${safeStatusUrl}` : '',
    '',
    'Research begins immediately after payment confirmation.',
    'You will receive a second email when the report artifacts are ready.'
  ]
    .filter(Boolean)
    .join('\n');

  const htmlBody = `
    <html>
      <body style="margin:0;padding:24px;background:#070c14;color:#e7eefc;font-family:Inter,Arial,sans-serif;">
        <div style="max-width:720px;margin:0 auto;border:1px solid rgba(120,160,220,0.18);border-radius:18px;background:#0f1c2e;overflow:hidden;">
          <div style="padding:24px 24px 12px;background:linear-gradient(135deg,rgba(212,168,39,0.12),rgba(59,130,246,0.06));border-bottom:1px solid rgba(120,160,220,0.14);">
            <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#d8b34d;font-weight:700;">Payment Confirmed</div>
            <h1 style="margin:10px 0 6px;font-size:28px;line-height:1.15;font-family:Georgia,serif;color:#f4d67b;">${packageName}</h1>
            <p style="margin:0;color:#b8c6e0;font-size:14px;line-height:1.6;">Case reference <strong>${caseRef}</strong>. Research has been queued and the workflow will begin immediately.</p>
          </div>
          <div style="padding:24px;">
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:18px;">
              <div style="padding:14px;border-radius:14px;background:#0b1420;border:1px solid rgba(120,160,220,0.14);">
                <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#7a8fad;">Primary Subject</div>
                <div style="margin-top:6px;font-size:15px;color:#edf2fc;">${subjectName || 'Not provided'}</div>
              </div>
              <div style="padding:14px;border-radius:14px;background:#0b1420;border:1px solid rgba(120,160,220,0.14);">
                <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#7a8fad;">Jurisdiction</div>
                <div style="margin-top:6px;font-size:15px;color:#edf2fc;">${location}</div>
              </div>
              <div style="padding:14px;border-radius:14px;background:#0b1420;border:1px solid rgba(120,160,220,0.14);">
                <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#7a8fad;">Expected Window</div>
                <div style="margin-top:6px;font-size:15px;color:#edf2fc;">${deliveryHours ? `Within ${deliveryHours}h` : 'Depends on scope'}</div>
              </div>
            </div>
            ${intakeSummary ? `<p style="margin:0 0 16px;color:#b8c6e0;font-size:14px;line-height:1.7;">${intakeSummary}</p>` : ''}
            <p style="margin:0 0 18px;color:#b8c6e0;font-size:14px;line-height:1.7;">${eta}</p>
            ${safeStatusUrl ? `<p style="margin:0;"><a href="${safeStatusUrl}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#d4a827;color:#120d00;text-decoration:none;font-weight:700;">Track this order</a></p>` : ''}
          </div>
        </div>
      </body>
    </html>
  `;

  await transport.sendMail({ from, to: customerEmail, subject, text: textBody, html: htmlBody });
  await transport.sendMail({ from, to: resolvedOwner, subject: `[Owner Copy] ${subject}`, text: textBody, html: htmlBody });
}

export async function sendLeadNotificationEmail({ ownerEmail, lead }) {
  const resolvedOwner = ownerEmail || getBusinessEmail();
  const from = process.env.EMAIL_FROM || resolvedOwner;
  const transport = await getTransport();

  const subject = `[Lead] ${lead.company} (${lead.monthlyCases} cases/mo)`;
  const lines = [
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    `Company: ${lead.company}`,
    `Monthly Cases: ${lead.monthlyCases}`,
    `Budget: ${lead.budget || 'not provided'}`,
    `Message: ${lead.message || 'none'}`
  ];

  await transport.sendMail({
    from,
    to: resolvedOwner,
    subject,
    text: lines.join('\n')
  });
}

export async function sendOpsAlertEmail({ ownerEmail, subject, lines = [] }) {
  const resolvedOwner = ownerEmail || getBusinessEmail();
  const from = process.env.EMAIL_FROM || resolvedOwner;
  const transport = await getTransport();
  await transport.sendMail({
    from,
    to: resolvedOwner,
    subject: `[Ops Alert] ${subject}`,
    text: lines.join('\n')
  });
}
