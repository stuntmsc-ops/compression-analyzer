import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CONTACT_URL } from "@/lib/siteLinks";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Compression Analyzer collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-900">
      <Header />
      <main className="flex-1">
        <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <p className="text-gray-500 text-sm mb-4">
            <Link
              href="/"
              className="text-brand-400 hover:text-brand-300 underline-offset-2 hover:underline"
            >
              ← Back to Compression Analyzer
            </Link>
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-2">
            Privacy Policy
          </h1>
          <p className="text-gray-500 text-sm mb-10">Last updated: April 20, 2026</p>

          <div className="space-y-8 text-gray-400 text-sm sm:text-base leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-white text-lg font-semibold">Who we are</h2>
              <p>
                Compression Analyzer is an audio tool that runs in your web browser.
                This policy describes how we handle information when you use the site,
                create an account, subscribe, or join our email list. Questions about
                this policy can be sent through our{" "}
                <a
                  href={CONTACT_URL}
                  className="text-brand-400 hover:text-brand-300 underline underline-offset-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  contact page
                </a>
                .
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-white text-lg font-semibold">Audio files and analysis</h2>
              <p>
                The core analysis of your uploaded clips runs locally in your browser
                using the Web Audio API. We do not upload your audio files to our
                servers for processing, storage, or training. Once you leave the page
                or clear site data, we have no copy of your file on our systems from
                that session.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-white text-lg font-semibold">Information we collect</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <span className="text-gray-300">Account and sign-in.</span> If you sign
                  in with Google or email (magic link), we store your account details in
                  our database as required by the sign-in provider (for example name,
                  email address, and profile image from Google when you allow it). Magic
                  link emails are sent through our email delivery provider using the
                  address you enter.
                </li>
                <li>
                  <span className="text-gray-300">Sessions.</span> We use secure cookies
                  and database-backed sessions so you can stay signed in and so
                  subscription status can be applied to your account.
                </li>
                <li>
                  <span className="text-gray-300">Email list (optional).</span> If you
                  enter your email to unlock free-tier results or join our list, we may
                  send that address to our email marketing provider (for example Kit /
                  ConvertKit) so we can deliver the training sequence and product
                  updates you opted into. You can unsubscribe using the link in those
                  emails.
                </li>
                <li>
                  <span className="text-gray-300">Subscriptions.</span> If you
                  subscribe to Pro through PayPal, PayPal processes payment data. We
                  receive subscription identifiers and status from PayPal so we can
                  unlock Pro features and keep access in sync when you cancel or when
                  billing changes. We do not receive your full card or bank details from
                  PayPal.
                </li>
                <li>
                  <span className="text-gray-300">Usage limits (free tier).</span> To
                  enforce daily analysis limits for signed-out or free-tier use, we may
                  store a small identifier or counter in your browser (such as
                  localStorage) and/or on our servers, depending on configuration. This is
                  used only for rate limiting, not for marketing profiles.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-white text-lg font-semibold">How we use information</h2>
              <p>We use the data above to:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Provide the analyzer, recommendations, and account features you request</li>
                <li>Authenticate you and prevent abuse</li>
                <li>Process and verify subscriptions</li>
                <li>Send transactional email (such as magic sign-in links) and, when you opt in, marketing email</li>
                <li>Comply with law and respond to valid legal requests</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-white text-lg font-semibold">Service providers</h2>
              <p>
                We rely on trusted processors who only receive what they need to perform
                their role. Depending on how the app is configured, this may include:
                hosting and database (for example Vercel and PostgreSQL), Google
                (OAuth sign-in), PayPal (payments), email delivery (for example Resend
                for magic links), and email marketing (for example Kit / ConvertKit).
                Their use of data is governed by their own policies.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-white text-lg font-semibold">Retention</h2>
              <p>
                We keep account and subscription records for as long as your account is
                active and as needed for legal, tax, and dispute resolution. Marketing
                lists follow the retention rules of the provider and your unsubscribe
                choices.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-white text-lg font-semibold">Your choices</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Access or correction: contact us using the link above.</li>
                <li>Delete your account: contact us and we will delete associated account data where applicable, subject to legal retention requirements.</li>
                <li>Marketing: use the unsubscribe link in marketing emails.</li>
                <li>Browser controls: you can clear cookies and site data; you may need to sign in again.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-white text-lg font-semibold">Children</h2>
              <p>
                The service is not directed at children under 13 (or the minimum age in
                your jurisdiction). We do not knowingly collect personal information from
                children.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-white text-lg font-semibold">International users</h2>
              <p>
                If you access the site from outside the country where our servers run,
                your information may be transferred to and processed in those regions.
                Where required, we rely on appropriate safeguards or your consent.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-white text-lg font-semibold">Changes</h2>
              <p>
                We may update this policy from time to time. We will post the new date at
                the top of this page. Continued use of the site after changes means you
                accept the updated policy.
              </p>
            </section>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
