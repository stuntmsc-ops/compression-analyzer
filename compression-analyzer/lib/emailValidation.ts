// Email input validation + normalisation for the subscribe gate.
//
// Deliberately permissive: the canonical RFC 5322 grammar allows a lot
// of legal addresses that look broken to a user ("user+tag@sub.co" —
// fine; "foo@bar" — technically legal with a local TLD but useless for
// marketing email). We're reaching for "this looks like a real email
// the user can receive at", not cryptographic correctness, since the
// upstream (Kit / ConvertKit) will do its own stricter validation and we
// catch its 422 at the route level anyway.
//
// Normalisation rules:
//   • trim surrounding whitespace (users paste from mail clients)
//   • lowercase the whole string (case in the local part is almost
//     never meaningful in practice; Kit lowercases on ingest
//     anyway — observed on the probe).

/** Upper bound in characters. Practical mailbox length per RFC 5321 is
 *  254; we allow the same so nobody gets rejected for a legitimate
 *  long address. */
export const EMAIL_MAX_LENGTH = 254;

// Pragmatic regex: one+ non-space/@, "@", one+ non-space/@, ".", at
// least two-character TLD. Matches ~everything users actually type;
// rejects "foo", "foo@", "foo@bar", "foo @bar.com".
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type EmailValidation =
  | { ok: true; email: string }
  | { ok: false; reason: string };

/**
 * Validate + normalise an email string. Never throws — returns a
 * discriminated union so callers (UI + route handler) can render the
 * reason verbatim without string-matching error messages.
 */
export function validateEmail(input: string): EmailValidation {
  if (typeof input !== "string") {
    return { ok: false, reason: "Please enter an email address." };
  }
  const normalised = input.trim().toLowerCase();
  if (normalised.length === 0) {
    return { ok: false, reason: "Please enter an email address." };
  }
  if (normalised.length > EMAIL_MAX_LENGTH) {
    return { ok: false, reason: "That email is too long to be real." };
  }
  if (!EMAIL_PATTERN.test(normalised)) {
    return { ok: false, reason: "That doesn't look like a valid email." };
  }
  return { ok: true, email: normalised };
}
