import type { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { getSmtpMagicLinkTransport } from "@/lib/emailMagicLinkConfig";
import { prisma } from "@/lib/prisma";
import { sendMagicLinkViaResend } from "@/lib/resendMagicLink";

const providers: NextAuthOptions["providers"] = [
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  }),
];

const emailFrom = process.env.EMAIL_FROM?.trim();
const resendKey = process.env.RESEND_API_KEY?.trim();

if (
  resendKey &&
  emailFrom &&
  emailFrom.toLowerCase().includes("onboarding@resend.dev")
) {
  console.warn(
    "[auth] EMAIL_FROM uses onboarding@resend.dev. Resend only allows that sender for " +
      "deliveries to your Resend account email. Use a verified-domain address instead, " +
      "e.g. noreply@yourdomain.com (see https://resend.com/domains ).",
  );
}

if (resendKey && emailFrom) {
  providers.push(
    EmailProvider({
      // NextAuth merges options; custom sender bypasses Nodemailer. Placeholder
      // matches Resend so misconfiguration never points at localhost.
      server: {
        host: "smtp.resend.com",
        port: 465,
        secure: true,
        auth: { user: "resend", pass: resendKey },
      },
      from: emailFrom,
      maxAge: 15 * 60,
      sendVerificationRequest: async ({ identifier, url }) => {
        await sendMagicLinkViaResend({ to: identifier, url, from: emailFrom });
      },
    }),
  );
} else {
  const smtp = getSmtpMagicLinkTransport();
  if (smtp && emailFrom) {
    providers.push(
      EmailProvider({
        server: smtp,
        from: emailFrom,
        maxAge: 15 * 60,
      }),
    );
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers,
  session: { strategy: "database", maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
