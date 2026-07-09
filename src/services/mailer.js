import nodemailer from "nodemailer";
import * as SES from "@aws-sdk/client-ses";
import QRCode from "qrcode";
import { getUser } from "../modules/users/repository.js";
import { getHostById } from "../modules/companies/repository.js";
import { query } from "../db/pool.js";

const isEnabled = Boolean(process.env.SES_ACCESS_KEY_ID && process.env.SES_SECRET_ACCESS_KEY);

let transporter = null;
if (isEnabled) {
  const sesClient = new SES.SES({
    region: process.env.SES_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.SES_ACCESS_KEY_ID,
      secretAccessKey: process.env.SES_SECRET_ACCESS_KEY
    }
  });
  transporter = nodemailer.createTransport({
    SES: { ses: sesClient, aws: SES }
  });
} else {
  console.warn("[MAILER] AWS SES credentials are missing. Emails will be logged to console instead.");
}

async function getCompanyDetails(companyId) {
  const result = await query("SELECT name, subdomain FROM companies WHERE id = $1", [companyId]);
  return result.rows[0];
}

async function getLocationDetails(locationId) {
  const result = await query("SELECT name, address FROM locations WHERE id = $1", [locationId]);
  return result.rows[0];
}

export async function sendVisitEmails(visit) {
  try {
    const company = await getCompanyDetails(visit.company_id);
    const companyName = company?.name || "Larkvel";
    const companySubdomain = company?.subdomain || "gmv";

    const location = await getLocationDetails(visit.location_id);
    const locationName = location ? `${location.name} (${location.address || ''})` : "Main Office";

    let host = null;
    if (visit.host_id) {
      host = await getHostById(visit.host_id);
    }

    const creator = await getUser(visit.created_by_user_id);

    // 1. Construct QR scan URL
    const isProd = process.env.NODE_ENV === "production";
    const apiHost = isProd ? "https://api.larkvel.com" : "http://localhost:3000";
    const scanUrl = `${apiHost}/api/visits/${visit.id}/scan-check`;

    // 2. Generate QR buffer
    const qrBuffer = await QRCode.toBuffer(scanUrl, { width: 250, margin: 2 });

    // 3. Format Date
    const formattedDate = new Date(visit.expected_at).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    // 4. Construct recipients list
    const recipients = [];
    if (visit.visitor_email) {
      recipients.push({
        to: visit.visitor_email,
        subject: `Your Visitor Access Pass for ${companyName}`,
        greeting: `Hello ${visit.visitor_name},`
      });
    }
    if (creator && creator.email) {
      recipients.push({
        to: creator.email,
        subject: `Visitor Pass Registered: ${visit.visitor_name} - ${companyName}`,
        greeting: `Hello ${creator.full_name},`
      });
    }
    if (host && host.email) {
      recipients.push({
        to: host.email,
        subject: `Expected Visitor Alert: ${visit.visitor_name} - ${companyName}`,
        greeting: `Hello ${host.full_name},`
      });
    }

    if (recipients.length === 0) return;

    // 5. Send or log emails
    const fromEmail = process.env.SES_FROM_EMAIL || "notification@larkvel.com";

    for (const recipient of recipients) {
      const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
          .card { max-width: 540px; margin: 0 auto; background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3); }
          .header { background: linear-gradient(135deg, #6366f1, #4f46e5); padding: 28px 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.025em; }
          .header p { margin: 6px 0 0 0; font-size: 14px; color: #c7d2fe; }
          .content { padding: 32px 24px; }
          .greeting { font-size: 16px; font-weight: 600; color: #f1f5f9; margin-top: 0; margin-bottom: 16px; }
          .title { font-size: 18px; font-weight: 700; color: #ffffff; margin-top: 24px; margin-bottom: 16px; text-align: center; }
          .grid { display: table; width: 100%; margin-bottom: 24px; border-collapse: separate; border-spacing: 0 8px; }
          .grid-row { display: table-row; }
          .grid-label { display: table-cell; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; width: 35%; padding: 4px 0; }
          .grid-value { display: table-cell; font-size: 14px; color: #e2e8f0; font-weight: 500; padding: 4px 0; }
          .qr-section { text-align: center; margin: 28px 0; padding: 20px; background-color: #0f172a; border-radius: 8px; border: 1px solid #334155; }
          .qr-section img { border-radius: 8px; border: 4px solid #ffffff; }
          .qr-section p { font-size: 12px; color: #94a3b8; margin: 12px 0 0 0; line-height: 1.5; }
          .footer { background-color: #0f172a; padding: 18px; text-align: center; border-top: 1px solid #334155; font-size: 11px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1>Visitor Access Pass</h1>
            <p>${companyName}</p>
          </div>
          <div class="content">
            <div class="greeting">${recipient.greeting}</div>
            <p style="font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0 0 20px 0;">
              A visitor appointment has been successfully scheduled. Below are the details of the visit and the digital access pass.
            </p>
            <h2 class="title">Appointment Details</h2>
            <div class="grid">
              <div class="grid-row">
                <div class="grid-label">Visitor:</div>
                <div class="grid-value">${visit.visitor_name}</div>
              </div>
              <div class="grid-row">
                <div class="grid-label">Purpose:</div>
                <div class="grid-value">${visit.purpose}</div>
              </div>
              <div class="grid-row">
                <div class="grid-label">Expected At:</div>
                <div class="grid-value">${formattedDate}</div>
              </div>
              <div class="grid-row">
                <div class="grid-label">Location:</div>
                <div class="grid-value">${locationName}</div>
              </div>
              ${host ? `
              <div class="grid-row">
                <div class="grid-label">Department:</div>
                <div class="grid-value">${host.department || 'General'}</div>
              </div>
              <div class="grid-row">
                <div class="grid-label">Host:</div>
                <div class="grid-value">${host.full_name}</div>
              </div>
              ` : ''}
            </div>
            
            <div class="qr-section">
              <img src="cid:qrcode" alt="QR Access Pass" width="200" height="200" />
              <p>Present this QR code at the entry point.<br>Scan to check-in and check-out automatically.</p>
            </div>
          </div>
          <div class="footer">
            This email was automatically sent from the Larkvel Visitor Management System.
          </div>
        </div>
      </body>
      </html>
      `;

      if (isEnabled && transporter) {
        await transporter.sendMail({
          from: fromEmail,
          to: recipient.to,
          subject: recipient.subject,
          html: htmlContent,
          attachments: [
            {
              filename: "qrcode.png",
              content: qrBuffer,
              cid: "qrcode"
            }
          ]
        });
        console.log(`[EMAIL] Successfully sent visit notification to ${recipient.to}`);
      } else {
        console.log(`[MAILER MOCK]
          From: ${fromEmail}
          To: ${recipient.to}
          Subject: ${recipient.subject}
          Scan URL: ${scanUrl}
        `);
      }
    }
  } catch (error) {
    console.error("[EMAIL] Error preparing or sending emails:", error);
  }
}
