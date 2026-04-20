import { describe, it, expect, vi } from "vitest";
import {
  upsertSubscriber,
  addSubscriberToForm,
  tagSubscriberByEmail,
  subscribeEmail,
  KitClientError,
  KIT_API_BASE,
  type KitDeps,
} from "./convertkit";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockDeps(responses: Array<Response | Error>): {
  deps: KitDeps;
  fetchSpy: ReturnType<typeof vi.fn>;
} {
  const fetchSpy = vi.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error("mock fetch called more times than expected");
    if (next instanceof Error) throw next;
    return next;
  });
  return {
    deps: { apiKey: "test-kit-key", fetch: fetchSpy as unknown as typeof fetch },
    fetchSpy,
  };
}

describe("upsertSubscriber", () => {
  it("returns id and wasCreated on 201", async () => {
    const { deps, fetchSpy } = mockDeps([
      jsonResponse(201, {
        subscriber: { id: 10, email_address: "a@b.com", state: "active" },
      }),
    ]);
    const r = await upsertSubscriber("a@b.com", deps);
    expect(r).toEqual({ id: 10, wasCreated: true });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${KIT_API_BASE}/v4/subscribers`);
    expect((init as RequestInit).method).toBe("POST");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-Kit-Api-Key"]).toBe("test-kit-key");
    expect((init as RequestInit).body).toBe(
      JSON.stringify({ email_address: "a@b.com" }),
    );
  });

  it("returns wasCreated false on 200 update", async () => {
    const { deps } = mockDeps([
      jsonResponse(200, {
        subscriber: { id: 55, email_address: "a@b.com", state: "active" },
      }),
    ]);
    expect(await upsertSubscriber("a@b.com", deps)).toEqual({
      id: 55,
      wasCreated: false,
    });
  });

  it("accepts 202 async custom-field response", async () => {
    const { deps } = mockDeps([
      jsonResponse(202, {
        subscriber: { id: 66, email_address: "a@b.com", state: "active" },
      }),
    ]);
    expect(await upsertSubscriber("a@b.com", deps)).toEqual({
      id: 66,
      wasCreated: false,
    });
  });

  it("throws validation on 422", async () => {
    const { deps } = mockDeps([
      jsonResponse(422, { errors: ["Email address is invalid"] }),
    ]);
    await expect(upsertSubscriber("bad", deps)).rejects.toMatchObject({
      detail: { kind: "validation", message: "Email address is invalid" },
    });
  });

  it("throws upstream when subscriber id missing", async () => {
    const { deps } = mockDeps([jsonResponse(201, { subscriber: {} })]);
    await expect(upsertSubscriber("a@b.com", deps)).rejects.toMatchObject({
      detail: { kind: "upstream", message: "Missing subscriber id in response" },
    });
  });

  it("throws network when fetch rejects", async () => {
    const { deps } = mockDeps([new Error("ECONNRESET")]);
    await expect(upsertSubscriber("a@b.com", deps)).rejects.toMatchObject({
      detail: { kind: "network", message: "ECONNRESET" },
    });
  });
});

describe("addSubscriberToForm", () => {
  it("resolves on 201 and sends email + optional referrer", async () => {
    const { deps, fetchSpy } = mockDeps([
      jsonResponse(201, {
        subscriber: {
          id: 1,
          email_address: "a@b.com",
          state: "active",
          created_at: "",
          added_at: "",
          fields: {},
          referrer: "https://x.com",
          referrer_utm_parameters: {
            source: "",
            medium: "",
            campaign: "",
            term: "",
            content: "",
          },
        },
      }),
    ]);
    await addSubscriberToForm(214, "a@b.com", deps, "https://example.com/tool");
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${KIT_API_BASE}/v4/forms/214/subscribers`);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      email_address: "a@b.com",
      referrer: "https://example.com/tool",
    });
  });

  it("omits referrer when not provided", async () => {
    const { deps, fetchSpy } = mockDeps([
      jsonResponse(200, {
        subscriber: {
          id: 1,
          first_name: null,
          email_address: "a@b.com",
          state: "active",
          created_at: "",
          added_at: "",
          fields: {},
          referrer: "",
          referrer_utm_parameters: {
            source: "",
            medium: "",
            campaign: "",
            term: "",
            content: "",
          },
        },
      }),
    ]);
    await addSubscriberToForm(214, "a@b.com", deps);
    const [, init] = fetchSpy.mock.calls[0];
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      email_address: "a@b.com",
    });
  });

  it("throws upstream on unexpected status", async () => {
    const { deps } = mockDeps([jsonResponse(500, { errors: ["boom"] })]);
    await expect(addSubscriberToForm(1, "a@b.com", deps)).rejects.toBeInstanceOf(
      KitClientError,
    );
  });
});

describe("tagSubscriberByEmail", () => {
  it("resolves on 200 (already tagged)", async () => {
    const { deps, fetchSpy } = mockDeps([
      jsonResponse(200, {
        subscriber: {
          id: 9,
          first_name: null,
          email_address: "a@b.com",
          state: "active",
          created_at: "",
          tagged_at: "",
          fields: {},
        },
      }),
    ]);
    await tagSubscriberByEmail(198, "a@b.com", deps);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${KIT_API_BASE}/v4/tags/198/subscribers`);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      email_address: "a@b.com",
    });
  });

  it("resolves on 201", async () => {
    const { deps } = mockDeps([
      jsonResponse(201, {
        subscriber: {
          id: 9,
          first_name: null,
          email_address: "a@b.com",
          state: "active",
          created_at: "",
          tagged_at: "",
          fields: {},
        },
      }),
    ]);
    await expect(tagSubscriberByEmail(198, "a@b.com", deps)).resolves.toBeUndefined();
  });
});

describe("subscribeEmail", () => {
  it("runs upsert → form → tag when tagId is set", async () => {
    const { deps, fetchSpy } = mockDeps([
      jsonResponse(201, { subscriber: { id: 7, email_address: "a@b.com" } }),
      jsonResponse(201, {
        subscriber: {
          id: 7,
          email_address: "a@b.com",
          state: "active",
          created_at: "",
          added_at: "",
          fields: {},
          referrer: "",
          referrer_utm_parameters: {
            source: "",
            medium: "",
            campaign: "",
            term: "",
            content: "",
          },
        },
      }),
      jsonResponse(201, {
        subscriber: {
          id: 7,
          email_address: "a@b.com",
          state: "active",
          created_at: "",
          tagged_at: "",
          fields: {},
        },
      }),
    ]);

    const r = await subscribeEmail("a@b.com", 214, 198, deps);
    expect(r).toEqual({ subscriberId: 7, wasCreated: true });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("skips tag when tagId is null", async () => {
    const { deps, fetchSpy } = mockDeps([
      jsonResponse(201, { subscriber: { id: 7, email_address: "a@b.com" } }),
      jsonResponse(201, {
        subscriber: {
          id: 7,
          email_address: "a@b.com",
          state: "active",
          created_at: "",
          added_at: "",
          fields: {},
          referrer: "",
          referrer_utm_parameters: {
            source: "",
            medium: "",
            campaign: "",
            term: "",
            content: "",
          },
        },
      }),
    ]);

    const r = await subscribeEmail("a@b.com", 214, null, deps);
    expect(r).toEqual({ subscriberId: 7, wasCreated: true });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("propagates upsert failures without calling form", async () => {
    const { deps, fetchSpy } = mockDeps([jsonResponse(401, { errors: ["bad key"] })]);
    await expect(subscribeEmail("a@b.com", 214, null, deps)).rejects.toBeInstanceOf(
      KitClientError,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
