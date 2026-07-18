import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let transporter;

function getTransporter() {
    if (!env.smtpUser || !env.smtpPass || env.smtpPass.startsWith("replace_with_")) {
        throw new Error("SMTP_USER and SMTP_PASS are required to send emails.");
    }

    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: env.smtpHost,
            port: env.smtpPort,
            secure: env.smtpSecure,
            auth: {
                user: env.smtpUser,
                pass: env.smtpPass
            }
        });
    }

    return transporter;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    }[character]));
}

function firstName(value) {
    return String(value || "Trader").trim().split(/\s+/)[0] || "Trader";
}

export async function sendWelcomeOtpEmail({ to, name, otp }) {
    const displayName = name || "Trader";
    const safeDisplayName = escapeHtml(displayName);
    const safeOtp = escapeHtml(otp);

    await getTransporter().sendMail({
        from: `"${env.mailFromName}" <${env.smtpUser}>`,
        to,
        subject: "Nexford Market OTP Verification",
        text: `Dear ${displayName},\n\nYour Nexford Market verification OTP is ${otp}. It is valid for ${env.otpExpiresInMinutes} minutes.\n\nDo not share this code with anyone.`,
        html: `
            <div style="background:#f2f2f2;font-family:Arial,Helvetica,sans-serif;color:#333;padding:30px 0">
                <div style="width:700px;max-width:95%;margin:auto;background:#fff;border:1px solid #ddd">
                    <div style="background:#121826;text-align:center;padding:25px">
                        <h1 style="color:#ffae00;font-size:40px;margin:0 0 8px">Nexford Market</h1>
                        <p style="color:#fff;font-size:14px;margin:0">Professional Nexford Market Platform</p>
                    </div>
                    <div style="padding:35px">
                        <div style="color:#ff4d4d;font-size:28px;font-weight:bold;margin-bottom:25px">OTP Verification</div>
                        <p style="font-size:15px;line-height:1.8;margin-bottom:18px">Dear <strong>${safeDisplayName}</strong>,</p>
                        <p style="font-size:15px;line-height:1.8;margin-bottom:18px">We received a request to verify your identity for your <strong>Nexford Market</strong> account.</p>
                        <p style="font-size:15px;line-height:1.8;margin-bottom:18px">Please use the One-Time Password (OTP) below to continue.</p>
                        <table style="width:100%;border-collapse:collapse;margin:25px 0">
                            <tr>
                                <th style="background:#202838;color:#fff;padding:10px;font-size:14px;text-align:center">Your Verification Code</th>
                            </tr>
                            <tr>
                                <td style="border:1px solid #e6e6e6;padding:18px;text-align:center;font-size:32px;font-weight:bold;letter-spacing:8px;color:#ff9800">${safeOtp}</td>
                            </tr>
                        </table>
                        <div style="background:#fff7ec;border-left:5px solid #ff9800;padding:15px;margin:25px 0;font-size:14px">
                            This OTP is valid for <strong>${env.otpExpiresInMinutes} minutes</strong> only. Do not share this code with anyone.
                        </div>
                        <p style="font-size:15px;line-height:1.8;margin-bottom:18px">If you did not request this verification, you can safely ignore this email.</p>
                        <div style="margin-top:20px;line-height:1.8">Best Regards,<br><strong>Nexford Market Team</strong></div>
                    </div>
                    <div style="background:#f8f8f8;text-align:center;padding:18px;font-size:12px;color:#777;border-top:1px solid #ddd">&copy; 2026 Nexford Market. All Rights Reserved.</div>
                </div>
            </div>
        `
    });
}

export async function sendAccountCreatedEmail({ to, name, portalUrl }) {
    const displayName = name || "Trader";
    const safeDisplayName = escapeHtml(displayName);
    const safeFirstName = escapeHtml(firstName(displayName));
    const safeEmail = escapeHtml(to);
    const safePortalUrl = escapeHtml(portalUrl || "https://nexfordmarket.com/login.html");

    await getTransporter().sendMail({
        from: `"${env.mailFromName}" <${env.smtpUser}>`,
        to,
        subject: "Your Nexford Market portal registration is complete",
        text: `Dear ${firstName(displayName)},\n\nYour Nexford Market portal registration is complete.\n\nPlease log in to the portal and create your trading account. You can choose a Demo account with $5,000 starting balance or a Live account with $0 starting balance.\n\nPortal: ${portalUrl || "https://nexfordmarket.com/login.html"}\n\nBest Regards,\nNexford Market Team`,
        html: `
            <div style="background:#f2f2f2;font-family:Arial,Helvetica,sans-serif;color:#333;padding:30px 0">
                <div style="width:700px;max-width:95%;margin:auto;background:#fff;border:1px solid #ddd">
                    <div style="background:#121826;text-align:center;padding:22px 20px">
                        <h1 style="color:#ffae00;font-size:40px;font-weight:bold;margin:0 0 8px">Nexford Market</h1>
                        <p style="color:#fff;font-size:14px;margin:0">Professional Nexford Market Platform</p>
                    </div>
                    <div style="padding:30px">
                        <div style="color:#ff4d4d;font-size:28px;font-weight:bold;margin-bottom:25px">Welcome, ${safeDisplayName}!</div>
                        <p style="font-size:15px;line-height:1.8;margin-bottom:18px">Dear ${safeFirstName},</p>
                        <p style="font-size:15px;line-height:1.8;margin-bottom:18px">Your Nexford Market portal registration is complete.</p>
                        <p style="font-size:15px;line-height:1.8;margin-bottom:18px">Please log in to the portal and create your trading account. You can choose a Demo account with <strong>$5,000</strong> starting balance or a Live account with <strong>$0</strong> starting balance.</p>
                        <table style="width:100%;border-collapse:collapse;margin:20px 0">
                            <tr>
                                <th style="background:#202838;color:#fff;padding:10px;font-size:14px;text-align:center;width:40%">Account Holder</th>
                                <th style="background:#202838;color:#fff;padding:10px;font-size:14px;text-align:center">Email ID</th>
                            </tr>
                            <tr>
                                <td style="padding:12px;border:1px solid #e5e5e5;font-size:14px">${safeDisplayName}</td>
                                <td style="padding:12px;border:1px solid #e5e5e5;font-size:14px"><a href="mailto:${safeEmail}" style="color:#1a73e8;text-decoration:none">${safeEmail}</a></td>
                            </tr>
                        </table>
                        <div style="background:#fff7ec;border-left:5px solid #f4a62a;padding:15px;margin:25px 0;font-size:14px">
                            <a href="${safePortalUrl}" style="color:#1a73e8;text-decoration:none;font-weight:bold">Open Nexford Market Portal</a>
                        </div>
                        <p style="font-size:15px;line-height:1.8;margin-bottom:18px">We look forward to supporting your trading journey. Should you require any assistance, our support team is always here to help.</p>
                        <div style="margin-top:20px;line-height:1.8">Best Regards,<br><strong>Nexford Market Team</strong></div>
                    </div>
                    <div style="text-align:center;background:#f8f8f8;color:#777;font-size:12px;padding:18px;border-top:1px solid #ddd">&copy; 2026 Nexford Market. All Rights Reserved.</div>
                </div>
            </div>
        `
    });
}
