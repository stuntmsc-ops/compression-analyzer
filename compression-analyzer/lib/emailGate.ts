// localStorage helpers for unit tests. No email gate in the app UI.

export const EMAIL_GATE_STORAGE_KEY = "compression-tool:email-submitted";
const TRUTHY = "1";

export function readSubmitted(storage: Storage | null): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(EMAIL_GATE_STORAGE_KEY) === TRUTHY;
  } catch {
    return false;
  }
}

export function writeSubmitted(storage: Storage | null): boolean {
  if (!storage) return false;
  try {
    storage.setItem(EMAIL_GATE_STORAGE_KEY, TRUTHY);
    return true;
  } catch {
    return false;
  }
}

export function clearSubmitted(storage: Storage | null): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(EMAIL_GATE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
