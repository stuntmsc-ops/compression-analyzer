/**
 * Read-only Kit (ConvertKit) API check using .env.local.
 * Usage: node scripts/kit-ping.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env.local");

function loadEnvLocal(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) {
    console.error("Missing .env.local at", filePath);
    process.exit(1);
  }
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
  return env;
}

const env = loadEnvLocal(envPath);
const key = env.CONVERTKIT_API_KEY ?? "";
const formId = env.CONVERTKIT_FORM_ID ?? "";

if (!key) {
  console.error(
    "CONVERTKIT_API_KEY is empty — paste your Kit v4 API key in .env.local",
  );
  process.exit(1);
}

const res = await fetch("https://api.kit.com/v4/account", {
  headers: { "X-Kit-Api-Key": key, Accept: "application/json" },
});

const text = await res.text();
let body = null;
try {
  body = JSON.parse(text);
} catch {
  body = text;
}

if (!res.ok) {
  console.error("Kit API: FAILED — HTTP", res.status);
  console.error(
    typeof body === "object" && body !== null
      ? JSON.stringify(body, null, 2)
      : String(text).slice(0, 800),
  );
  process.exit(1);
}

const acc = body.account;
const user = body.user;
console.log("Kit API: OK (GET /v4/account)");
console.log("  Account:", acc?.name ?? "?", "| plan:", acc?.plan_type ?? "?");
console.log(
  "  Primary email:",
  acc?.primary_email_address ?? user?.email ?? "?",
);
if (formId) {
  console.log("  CONVERTKIT_FORM_ID:", formId, "(set)");
} else {
  console.log("  CONVERTKIT_FORM_ID: (empty — /api/subscribe needs this)");
}
