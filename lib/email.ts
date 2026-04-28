/**
 * Send email notifications via Resend.
 *
 * Setup:
 * 1. Go to https://resend.com and sign up (free: 100 emails/day)
 * 2. Get your API key
 * 3. Add to .env.local: RESEND_API_KEY=re_xxxxx
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM_EMAIL = process.env.FROM_EMAIL || "Cofounder Connections <onboarding@resend.dev>";

type EmailParams = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail({ to, subject, html }: EmailParams): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping email to", to);
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Email send failed:", err);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Email error:", err);
    return false;
  }
}

const WRAPPER = (content: string) => `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h2 style="font-size: 20px; font-weight: 700; color: #1a1a1a; margin: 0;">Cofounder Connections</h2>
  </div>
  ${content}
  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
    <p style="font-size: 12px; color: #999; margin: 0;">Cofounder Connections</p>
  </div>
</div>
`;

export function approvedEmail(name: string): EmailParams {
  return {
    to: "",
    subject: "Welcome to Cofounder Connections — You're in!",
    html: WRAPPER(`
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <div style="font-size: 40px; margin-bottom: 12px;">🎉</div>
        <h1 style="font-size: 22px; font-weight: 700; color: #166534; margin: 0 0 8px;">Welcome aboard, ${name}!</h1>
        <p style="font-size: 15px; color: #15803d; margin: 0;">Your account has been approved.</p>
      </div>
      <p style="font-size: 15px; color: #333; line-height: 1.7; margin-bottom: 16px;">
        Great news! Your application has been reviewed and approved. You now have full access to the platform.
      </p>
      <p style="font-size: 15px; color: #333; line-height: 1.7; margin-bottom: 24px;">
        Start browsing founder profiles, connect with potential cofounders, and build something great together.
      </p>
      <div style="text-align: center;">
        <a href="https://cofounderconnections.com" style="display: inline-block; background: #7c6cf0; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
          Get Started
        </a>
      </div>
    `),
  };
}

export function rejectedEmail(name: string): EmailParams {
  return {
    to: "",
    subject: "Update on your Cofounder Connections application",
    html: WRAPPER(`
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <div style="font-size: 40px; margin-bottom: 12px;">📋</div>
        <h1 style="font-size: 22px; font-weight: 700; color: #92400e; margin: 0 0 8px;">Application Update</h1>
        <p style="font-size: 15px; color: #a16207; margin: 0;">Hi ${name}, we have an update on your application.</p>
      </div>
      <p style="font-size: 15px; color: #333; line-height: 1.7; margin-bottom: 16px;">
        Thank you for your interest in joining Cofounder Connections. After reviewing your application, we were unable to approve it at this time.
      </p>
      <p style="font-size: 15px; color: #333; line-height: 1.7;">
        This could be due to incomplete information or not meeting our current criteria. You are welcome to reapply in the future with a more detailed profile.
      </p>
    `),
  };
}

export function bannedEmail(name: string): EmailParams {
  return {
    to: "",
    subject: "Your Cofounder Connections account has been suspended",
    html: WRAPPER(`
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <div style="font-size: 40px; margin-bottom: 12px;">🚫</div>
        <h1 style="font-size: 22px; font-weight: 700; color: #991b1b; margin: 0 0 8px;">Account Suspended</h1>
        <p style="font-size: 15px; color: #dc2626; margin: 0;">Your account has been permanently suspended.</p>
      </div>
      <p style="font-size: 15px; color: #333; line-height: 1.7; margin-bottom: 16px;">
        Hi ${name}, your Cofounder Connections account has been suspended due to violations of our community guidelines.
      </p>
      <p style="font-size: 15px; color: #333; line-height: 1.7; margin-bottom: 16px;">
        Our platform is built on trust and respect between founders. Behavior including harassment, inappropriate content, threats, or spam is not tolerated and results in permanent removal from the platform.
      </p>
      <p style="font-size: 15px; color: #333; line-height: 1.7;">
        This decision is final. Your profile has been flagged and you will not be able to create a new account.
      </p>
    `),
  };
}