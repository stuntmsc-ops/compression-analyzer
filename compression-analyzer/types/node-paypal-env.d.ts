declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL?: string;
    NEXTAUTH_SECRET?: string;
    NEXTAUTH_URL?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    /** Magic link “from” address (must match your mail provider domain) */
    EMAIL_FROM?: string;
    /** Resend API key — uses smtp.resend.com when set (with EMAIL_FROM) */
    RESEND_API_KEY?: string;
    /** Nodemailer SMTP: connection URL or JSON object string (with EMAIL_FROM) */
    EMAIL_SERVER?: string;
    /** PayPal REST webhook listener id (WH-…) for signature verification */
    PAYPAL_WEBHOOK_ID?: string;
    PAYPAL_CLIENT_ID?: string;
    PAYPAL_CLIENT_SECRET?: string;
    /** `live` or `sandbox` — must match credential type (defaults to sandbox if unset) */
    PAYPAL_MODE?: string;
    NEXT_PUBLIC_PAYPAL_CLIENT_ID?: string;
    /** Shown in "Report a Problem" mailto when set; otherwise contact page URL is used. */
    NEXT_PUBLIC_SUPPORT_EMAIL?: string;
    /** Monthly billing plan id from PayPal (Subscriptions), e.g. P-xxxxxxxx */
    PAYPAL_PLAN_ID?: string;
  }
}
