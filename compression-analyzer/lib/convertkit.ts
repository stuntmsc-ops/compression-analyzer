// ConvertKit / Kit API v4 client (https://api.kit.com).
//
// Double opt-in is configured on the Kit form, not in this code. The
// flow here upserts the subscriber, adds them to that form (which
// triggers Kit's confirmation email when DOI is enabled), and
// optionally applies a tag for segmentation.
//
// All functions take a `Deps` bag so tests can inject `fetch` — same
// pattern as the rest of `lib/`.

export const KIT_API_BASE = "https://api.kit.com";

export type KitSubscriber = {
  id: number;
  email_address: string;
};

export type KitDeps = {
  apiKey: string;
  fetch: typeof fetch;
};

export type KitError =
  | { kind: "validation"; message: string }
  | { kind: "upstream"; status: number; message: string }
  | { kind: "network"; message: string };

export class KitClientError extends Error {
  readonly detail: KitError;
  constructor(detail: KitError) {
    super(describeError(detail));
    this.name = "KitClientError";
    this.detail = detail;
  }
}

function describeError(d: KitError): string {
  switch (d.kind) {
    case "validation":
      return `Kit validation: ${d.message}`;
    case "upstream":
      return `Kit upstream ${d.status}: ${d.message}`;
    case "network":
      return `Kit network: ${d.message}`;
  }
}

/**
 * POST /v4/subscribers — upsert by `email_address`.
 *
 * Returns subscriber id. `wasCreated` is true when the response was
 * 201 (new row); 200 means an existing subscriber was updated.
 */
export async function upsertSubscriber(
  email: string,
  deps: KitDeps,
): Promise<{ id: number; wasCreated: boolean }> {
  const res = await fetchJson(
    "POST",
    `${KIT_API_BASE}/v4/subscribers`,
    { email_address: email },
    deps,
  );

  if (res.status === 201 || res.status === 200 || res.status === 202) {
    const body = res.body as { subscriber?: { id?: number } };
    const id = body.subscriber?.id;
    if (typeof id !== "number") {
      throw new KitClientError({
        kind: "upstream",
        status: res.status,
        message: "Missing subscriber id in response",
      });
    }
    return { id, wasCreated: res.status === 201 };
  }

  if (res.status === 422) {
    throw new KitClientError({
      kind: "validation",
      message: extractKitErrors(res.body),
    });
  }

  throw new KitClientError({
    kind: "upstream",
    status: res.status,
    message: extractKitErrors(res.body),
  });
}

/**
 * POST /v4/forms/{form_id}/subscribers — attach by email.
 *
 * The subscriber must already exist (we always call `upsertSubscriber`
 * first). For a double-opt-in form, Kit sends the incentive /
 * confirmation email on first add.
 */
export async function addSubscriberToForm(
  formId: number,
  email: string,
  deps: KitDeps,
  referrer?: string,
): Promise<void> {
  const payload: Record<string, string> = { email_address: email };
  if (referrer !== undefined && referrer.length > 0) {
    payload.referrer = referrer;
  }

  const res = await fetchJson(
    "POST",
    `${KIT_API_BASE}/v4/forms/${formId}/subscribers`,
    payload,
    deps,
  );

  if (res.status === 201 || res.status === 200) return;

  if (res.status === 422) {
    throw new KitClientError({
      kind: "validation",
      message: extractKitErrors(res.body),
    });
  }

  throw new KitClientError({
    kind: "upstream",
    status: res.status,
    message: extractKitErrors(res.body),
  });
}

/**
 * POST /v4/tags/{tag_id}/subscribers — tag by email.
 *
 * Idempotent when the subscriber already carries the tag (Kit returns
 * 200).
 */
export async function tagSubscriberByEmail(
  tagId: number,
  email: string,
  deps: KitDeps,
): Promise<void> {
  const res = await fetchJson(
    "POST",
    `${KIT_API_BASE}/v4/tags/${tagId}/subscribers`,
    { email_address: email },
    deps,
  );

  if (res.status === 201 || res.status === 200) return;

  if (res.status === 422) {
    throw new KitClientError({
      kind: "validation",
      message: extractKitErrors(res.body),
    });
  }

  throw new KitClientError({
    kind: "upstream",
    status: res.status,
    message: extractKitErrors(res.body),
  });
}

/**
 * Full subscribe flow: upsert → form (DOI) →
 * optional tag.
 */
export async function subscribeEmail(
  email: string,
  formId: number,
  tagId: number | null,
  deps: KitDeps,
  referrer?: string,
): Promise<{ subscriberId: number; wasCreated: boolean }> {
  const { id, wasCreated } = await upsertSubscriber(email, deps);
  await addSubscriberToForm(formId, email, deps, referrer);
  if (tagId !== null && Number.isFinite(tagId)) {
    await tagSubscriberByEmail(tagId, email, deps);
  }
  return { subscriberId: id, wasCreated };
}

// ─── Transport helpers ─────────────────────────────────────────────

type FetchJsonResult = { status: number; body: unknown };

async function fetchJson(
  method: "POST",
  url: string,
  body: Record<string, string>,
  deps: KitDeps,
): Promise<FetchJsonResult> {
  const headers: Record<string, string> = {
    "X-Kit-Api-Key": deps.apiKey,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  let res: Response;
  try {
    res = await deps.fetch(url, {
      method,
      headers,
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new KitClientError({
      kind: "network",
      message: err instanceof Error ? err.message : "fetch failed",
    });
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: res.status, body: parsed };
}

function extractKitErrors(body: unknown): string {
  if (typeof body === "string" && body.length > 0) return body;
  if (body && typeof body === "object" && "errors" in body) {
    const errors = (body as { errors?: unknown }).errors;
    if (Array.isArray(errors) && errors.every((e) => typeof e === "string")) {
      return errors.join("; ");
    }
  }
  return "Unknown upstream error";
}
