# PRD: Compression Analyzer (AudioSpectra)

**Product:** Web-based compression coaching for audio engineers and producers.  
**Stack (reference):** Next.js (App Router), NextAuth, PostgreSQL (Prisma), PayPal Orders v2 (one-time), Vercel KV/Upstash for free-tier quota, deployed on Vercel.

**Last updated:** April 22, 2026

---

## 1. Problem & goals

**Problem:** Users need actionable compression settings (attack/release/ratio, parallel vs serial, bus vs track) for real stems and mixes, without a full DAW tutorial every time.

**Goals**

- Turn an uploaded file into **measurable** analysis (dynamics, loudness over time, etc.) and **opinionated** recommendations tied to user choices (instrument, genre, goal).
- Offer a **useful free tier** with clear limits, and a **simple paid path** to unlimited use.
- Keep the experience **client-side** for analysis where possible; enforce limits and entitlements on the **server**.

**Non-goals (current scope):** DAW plugin hosting, cloud rendering, multi-user org billing, or subscription-only billing (see below).

---

## 2. Target users

- **Home / project studio:** mixing their own material, needs quick, defensible settings.
- **Curious hobbyist:** learning what “too much” compression looks like for their file.

---

## 3. Core product experience

### 3.1 Analysis pipeline

- User uploads **WAV or MP3** (size limits and validation as implemented in app).
- Browser decodes to `AudioBuffer`; analysis runs in JS (loudness over time, dynamics metrics, etc.).
- Results drive **recommendation** (settings + rationale) and **technique** (e.g. parallel for drums, serial when crest + DR thresholds hit, bus rule for full mix).
- **Plugin workflow tips** surface where applicable.

### 3.2 Controls & state

- **Instrument** (e.g. kick, snare, bass, keys, full mix, …), **genre**, **goal**—bound to **URL** (hash/query per implementation) for bookmarking and **shareable links** when content is “unlocked” (see gating).
- **Copy link** and **copy settings** flows for unlocked states.

### 3.3 Free vs Pro (behavior)

| Layer | Free | Pro |
|--------|------|-----|
| **Analyses** | **3 completed analyses per UTC day** (server-enforced) | **Unlimited** (no daily cap) |
| **Content depth** | Full card content until daily cap; after cap, gating per current Hero/recommendation rules (can complete “last in session” as implemented) | Full content + share as implemented |
| **Enforcement** | `GET /api/analysis/quota` + `POST /api/analysis/record` with KV/Upstash + `ca_quota_sid` cookie | `userHasProEntitlement` bypasses free quota |

**Pro sources of truth (either grants Pro):**

- **One-time PayPal** (`ProOneTimePurchase` row, `status` = `COMPLETED`), or  
- **Legacy** active PayPal **subscription** (`PayPalSubscription` in `ACTIVE` / `APPROVED`) if still in use for existing users.

---

## 4. Monetization (current)

- **Single SKU:** one-time **USD** purchase (default **$29**; overridable via `PAYPAL_ONETIME_USD` + `NEXT_PUBLIC_PAYPAL_ONETIME_USD`).
- **Checkout:** user must be **signed in**; `custom_id` on the PayPal order = **NextAuth user id**; `POST /api/paypal/create-order` then client approval then `POST /api/paypal/capture-order` with DB `upsert`.
- **Webhooks (optional but recommended in prod):** `PAYMENT.CAPTURE.COMPLETED` → `POST /api/paypal/webhook` using `PAYPAL_WEBHOOK_ID` and same PayPal app/mode as API.
- **Config:** `PAYPAL_MODE` = `live` | `sandbox`, `PAYPAL_CLIENT_ID` (or `NEXT_PUBLIC_PAYPAL_CLIENT_ID`), `PAYPAL_CLIENT_SECRET`—**must** match the same app and environment (missing `PAYPAL_MODE=live` on Vercel with Live keys caused “Client Authentication failed”).

**Marketing/optional:** `POST /api/subscribe` (e.g. ConvertKit) may exist; not required for core gating.

---

## 5. Identity & access

- **NextAuth** with **Google** OAuth and optional **email magic link** (Resend/SMTP per `authOptions`).
- Production requires aligned **`NEXTAUTH_URL`**, `NEXTAUTH_SECRET`, and **Google** authorized origins + redirect `…/api/auth/callback/google`.
- Session required for **checkout**; quota session cookie required for free-tier counting (`/api/analysis/session` + quota APIs).

---

## 6. Technical & compliance notes

- **Data:** User, Session, Account (NextAuth); `ProOneTimePurchase`, `PayPalSubscription` (Prisma/Postgres).
- **Quota store:** Vercel KV or Upstash Redis REST—required for production free-tier enforcement.
- **Privacy & safety:** no PII in this document; follow your privacy policy and cookie policy for EU/region rules.

---

## 7. Success metrics (suggestions)

- **Activation:** upload → first successful analysis.
- **Value:** return visits with share/copied settings.
- **Revenue:** signed-in checkout starts → capture success; optional webhook success rate.
- **Health:** 5xx on PayPal routes, quota 503s when KV misconfigured.

---

## 8. Open decisions / follow-ups

- [ ] **Price in production:** restore `$29` (or final price) after $1 live smoke tests.  
- [ ] **Public PayPal client id on Vercel:** redeploy after any `NEXT_PUBLIC_*` change.  
- [ ] **Webhook URL:** use production `https://<domain>/api/paypal/webhook` (not ngrok) for Live.  
- [ ] Deprecate or document **legacy** subscription flow vs one-time only.
