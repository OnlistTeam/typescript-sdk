import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AccountActivity,
  AccountApiKeys,
  AccountCredits,
  AccountGenerations,
  AccountOAuth,
  exchangeAuthCode,
  generatePkce,
} from "../src/account.js";
import { Onlist } from "../src/client.js";
import { APIError, BadRequestError, PermissionDeniedError } from "../src/errors.js";

const OPTS = { apiKey: "mgmt_test", baseURL: "https://onlist.io" };

const mockKey = {
  hash: "42",
  name: "prod",
  label: "sk-...cdef",
  disabled: false,
  limit: 25.0,
  limit_remaining: 12.5,
  limit_reset: "daily",
  include_byok_in_limit: false,
  usage: 12.5,
  usage_daily: 1.25,
  usage_weekly: 6.0,
  usage_monthly: 12.5,
  byok_usage: 0,
  byok_usage_daily: 0,
  byok_usage_weekly: 0,
  byok_usage_monthly: 0,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: null,
  expires_at: null,
  external_user: null,
  creator_user_id: null,
  workspace_id: "default",
};

const mockGeneration = {
  id: "req-abc",
  model: "deepseek/deepseek-chat",
  provider_name: "alice-shop",
  streamed: true,
  latency: 812,
  generation_time: 4200,
  created_at: "2026-09-06T10:00:00Z",
  tokens_prompt: 120,
  tokens_completion: 340,
  native_tokens_prompt: 120,
  native_tokens_completion: 340,
  native_tokens_cached: 64,
  native_tokens_reasoning: null,
  total_cost: 0.000412,
  usage: 0.000412,
  cache_discount: null,
  finish_reason: "stop",
  native_finish_reason: "stop",
  is_byok: false,
  upstream_id: null,
  http_referer: null,
  user_agent: null,
  origin: null,
  api_type: null,
};

const mockActivityRow = {
  date: "2026-09-05",
  model: "deepseek/deepseek-chat",
  model_permaslug: "deepseek/deepseek-chat",
  endpoint_id: "alice-shop/deepseek/deepseek-chat",
  provider_name: "alice-shop",
  usage: 1.25,
  byok_usage_inference: 0,
  requests: 40,
  prompt_tokens: 4800,
  completion_tokens: 13600,
  reasoning_tokens: 0,
};

// The account face uses OpenRouter's envelope, where `code` is the HTTP
// status as a *number* rather than a string slug.
const forbiddenBody = {
  error: { code: 403, message: "Only management keys can perform this operation" },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function requestBody(spy: ReturnType<typeof vi.fn>, call = 0): Record<string, unknown> {
  return JSON.parse((spy.mock.calls[call][1] as RequestInit).body as string);
}

describe("Account API", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("credits", () => {
    it("gets the balance and sends the management key", async () => {
      fetchSpy.mockResolvedValueOnce(json({ data: { total_credits: 50, total_usage: 12.25 } }));
      const result = await new AccountCredits(OPTS).get();

      expect(result.total_credits).toBe(50);
      expect(result.total_usage).toBe(12.25);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://onlist.io/api/v1/credits");
      expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer mgmt_test");
    });
  });

  describe("generations", () => {
    it("looks up a call by request id", async () => {
      fetchSpy.mockResolvedValueOnce(json({ data: mockGeneration }));
      const result = await new AccountGenerations(OPTS).get("req-abc");

      expect(result.provider_name).toBe("alice-shop");
      expect(result.total_cost).toBe(0.000412);
      expect(result.native_tokens_reasoning).toBeNull();
      expect(fetchSpy.mock.calls[0][0]).toContain("id=req-abc");
    });
  });

  describe("apiKeys", () => {
    it("current() parses the inference-key projection", async () => {
      fetchSpy.mockResolvedValueOnce(
        json({
          data: {
            ...mockKey,
            is_free_tier: false,
            is_management_key: false,
            is_provisioning_key: false,
            rate_limit: { requests: -1, interval: "", note: "deprecated" },
          },
        }),
      );
      const result = await new AccountApiKeys(OPTS).current();

      expect(result.is_management_key).toBe(false);
      expect(result.rate_limit?.requests).toBe(-1);
    });

    it("current() parses the 10-field management projection", async () => {
      fetchSpy.mockResolvedValueOnce(
        json({
          data: {
            label: "mgmt_...cdef",
            name: "ci",
            limit: null,
            limit_remaining: null,
            limit_reset: null,
            usage: 0,
            is_free_tier: false,
            is_management_key: true,
            is_provisioning_key: false,
            rate_limit: { requests: -1, interval: "", note: "deprecated" },
          },
        }),
      );
      const result = await new AccountApiKeys(OPTS).current();

      expect(result.is_management_key).toBe(true);
      expect(result.hash).toBeUndefined();
    });

    it("lists keys with paging params", async () => {
      fetchSpy.mockResolvedValueOnce(json({ data: [mockKey] }));
      const result = await new AccountApiKeys(OPTS).list({ offset: 100, include_disabled: true });

      expect(result).toHaveLength(1);
      expect(result[0].hash).toBe("42");
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("offset=100");
      expect(url).toContain("include_disabled=true");
    });

    it("returns an empty list rather than undefined", async () => {
      fetchSpy.mockResolvedValueOnce(json({ data: [] }));
      expect(await new AccountApiKeys(OPTS).list()).toEqual([]);
    });

    it("create() surfaces both the plaintext key and the key object", async () => {
      fetchSpy.mockResolvedValueOnce(json({ data: mockKey, key: "sk-plaintext-once" }, 201));
      const result = await new AccountApiKeys(OPTS).create("prod", {
        limit: 25,
        limit_reset: "daily",
      });

      // The sibling `key` must survive envelope handling — it is returned once.
      expect(result.key).toBe("sk-plaintext-once");
      expect(result.data.hash).toBe("42");
      expect(requestBody(fetchSpy)).toEqual({ name: "prod", limit: 25, limit_reset: "daily" });
    });

    it("create() omits unset optionals", async () => {
      fetchSpy.mockResolvedValueOnce(json({ data: mockKey, key: "sk-x" }, 201));
      await new AccountApiKeys(OPTS).create("minimal");

      expect(requestBody(fetchSpy)).toEqual({ name: "minimal" });
    });

    it("gets one key by hash", async () => {
      fetchSpy.mockResolvedValueOnce(json({ data: mockKey }));
      const result = await new AccountApiKeys(OPTS).get("42");

      expect(result.name).toBe("prod");
      expect(fetchSpy.mock.calls[0][0]).toBe("https://onlist.io/api/v1/keys/42");
    });

    it("update() omits fields that were not passed", async () => {
      fetchSpy.mockResolvedValueOnce(json({ data: mockKey }));
      await new AccountApiKeys(OPTS).update("42", { name: "renamed" });

      // An absent key means "leave it alone"; a present null means "clear it".
      expect(requestBody(fetchSpy)).toEqual({ name: "renamed" });
    });

    it("update() sends explicit null to clear a limit", async () => {
      fetchSpy.mockResolvedValueOnce(json({ data: mockKey }));
      await new AccountApiKeys(OPTS).update("42", { limit: null });

      const body = requestBody(fetchSpy);
      expect("limit" in body).toBe(true);
      expect(body.limit).toBeNull();
    });

    it("update() treats explicit undefined as absent", async () => {
      fetchSpy.mockResolvedValueOnce(json({ data: mockKey }));
      await new AccountApiKeys(OPTS).update("42", { limit: undefined, disabled: true });

      expect(requestBody(fetchSpy)).toEqual({ disabled: true });
    });

    it("update() sends disabled:false as a real instruction", async () => {
      fetchSpy.mockResolvedValueOnce(json({ data: mockKey }));
      await new AccountApiKeys(OPTS).update("42", { disabled: false });

      expect(requestBody(fetchSpy)).toEqual({ disabled: false });
    });

    it("deletes a key", async () => {
      fetchSpy.mockResolvedValueOnce(json({ data: { deleted: true } }));
      expect(await new AccountApiKeys(OPTS).delete("42")).toBe(true);
      expect((fetchSpy.mock.calls[0][1] as RequestInit).method).toBe("DELETE");
    });
  });

  describe("activity", () => {
    it("lists usage with filters", async () => {
      fetchSpy.mockResolvedValueOnce(json({ data: [mockActivityRow] }));
      const rows = await new AccountActivity(OPTS).list({
        date: "2026-09-05",
        api_key_hash: "42",
      });

      expect(rows[0].requests).toBe(40);
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("date=2026-09-05");
      expect(url).toContain("api_key_hash=42");
    });

    it("omits the query string entirely when unfiltered", async () => {
      fetchSpy.mockResolvedValueOnce(json({ data: [] }));
      expect(await new AccountActivity(OPTS).list()).toEqual([]);
      expect(fetchSpy.mock.calls[0][0]).toBe("https://onlist.io/api/v1/activity");
    });
  });

  describe("oauth", () => {
    it("exchanges a code for a key", async () => {
      // The exchange response is bare — no `data` envelope at all.
      fetchSpy.mockResolvedValueOnce(json({ key: "sk-from-oauth", user_id: null }));
      const result = await new AccountOAuth(OPTS).exchange("code-123", "v".repeat(43));

      expect(result.key).toBe("sk-from-oauth");
      expect(result.user_id).toBeNull();
      expect(requestBody(fetchSpy)).toEqual({ code: "code-123", code_verifier: "v".repeat(43) });
    });
  });

  describe("exchangeAuthCode", () => {
    // An app running the sign-in flow has no API key yet — that is the point
    // of the flow — so the exchange must not require a constructed client.
    it("throws when constructing Onlist without a credential", () => {
      const saved = { onlist: process.env.ONLIST_API_KEY, openai: process.env.OPENAI_API_KEY };
      delete process.env.ONLIST_API_KEY;
      delete process.env.OPENAI_API_KEY;
      try {
        expect(() => new Onlist()).toThrow();
      } finally {
        if (saved.onlist !== undefined) process.env.ONLIST_API_KEY = saved.onlist;
        if (saved.openai !== undefined) process.env.OPENAI_API_KEY = saved.openai;
      }
    });

    it("exchanges without a client and without an Authorization header", async () => {
      fetchSpy.mockResolvedValueOnce(json({ key: "sk-from-oauth", user_id: null }));
      const result = await exchangeAuthCode("code-123", {
        codeVerifier: "v".repeat(43),
        baseURL: "https://example.test",
      });

      expect(result.key).toBe("sk-from-oauth");
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://example.test/api/v1/auth/keys");
      expect((init.headers as Record<string, string>)["Authorization"]).toBeUndefined();
    });

    it("defaults to production", async () => {
      fetchSpy.mockResolvedValueOnce(json({ key: "sk-prod", user_id: null }));
      await exchangeAuthCode("code-123");
      expect(fetchSpy.mock.calls[0][0]).toBe("https://onlist.io/api/v1/auth/keys");
    });
  });

  describe("generatePkce", () => {
    it("produces a 43-character unpadded verifier and challenge", async () => {
      const { verifier, challenge } = await generatePkce();

      // RFC 7636 requires 43-128 characters; the server enforces the same.
      expect(verifier).toHaveLength(43);
      expect(challenge).toHaveLength(43);
      expect(verifier).not.toContain("=");
      expect(challenge).not.toContain("=");
    });

    it("derives the challenge as base64url(sha256(verifier))", async () => {
      const { verifier, challenge } = await generatePkce();
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
      const expected = Buffer.from(digest).toString("base64url");

      expect(challenge).toBe(expected);
    });

    it("is unique per call", async () => {
      const [a, b] = await Promise.all([generatePkce(), generatePkce()]);
      expect(a.verifier).not.toBe(b.verifier);
    });
  });

  describe("errors", () => {
    it("maps 403 to PermissionDeniedError and keeps the server message", async () => {
      fetchSpy.mockResolvedValueOnce(json(forbiddenBody, 403));

      await expect(new AccountCredits(OPTS).get()).rejects.toThrow(PermissionDeniedError);
      fetchSpy.mockResolvedValueOnce(json(forbiddenBody, 403));
      // The server's wording is already precise; the SDK must not rewrite it.
      await expect(new AccountCredits(OPTS).get()).rejects.toThrow(
        "Only management keys can perform this operation",
      );
    });

    it("handles a numeric error code without crashing", async () => {
      fetchSpy.mockResolvedValueOnce(json({ error: { code: 400, message: "invalid key hash" } }, 400));

      await expect(new AccountApiKeys(OPTS).list()).rejects.toThrow(BadRequestError);
    });
  });

  describe("retry policy", () => {
    it("retries GET on 503", async () => {
      fetchSpy
        .mockResolvedValueOnce(json({ error: { code: 503, message: "down" } }, 503))
        .mockResolvedValueOnce(json({ data: { total_credits: 1, total_usage: 0 } }));

      const result = await new AccountCredits({ ...OPTS, maxRetries: 1 }).get();
      expect(result.total_credits).toBe(1);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("never retries POST /keys — a replay would mint a second key", async () => {
      fetchSpy.mockResolvedValue(json({ error: { code: 503, message: "down" } }, 503));

      await expect(new AccountApiKeys({ ...OPTS, maxRetries: 3 }).create("prod")).rejects.toThrow(
        APIError,
      );
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("never retries the OAuth exchange — a replay would burn the code", async () => {
      fetchSpy.mockResolvedValue(json({ error: { code: 500, message: "boom" } }, 500));

      await expect(new AccountOAuth({ ...OPTS, maxRetries: 3 }).exchange("code")).rejects.toThrow(
        APIError,
      );
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("never retries PATCH or DELETE", async () => {
      fetchSpy.mockResolvedValue(json({ error: { code: 503, message: "down" } }, 503));
      const keys = new AccountApiKeys({ ...OPTS, maxRetries: 3 });

      await expect(keys.update("42", { disabled: true })).rejects.toThrow(APIError);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      fetchSpy.mockClear();
      await expect(keys.delete("42")).rejects.toThrow(APIError);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});

describe("management key resolution", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  const saved = { onlist: process.env.ONLIST_MANAGEMENT_KEY };

  beforeEach(() => {
    delete process.env.ONLIST_MANAGEMENT_KEY;
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (saved.onlist !== undefined) process.env.ONLIST_MANAGEMENT_KEY = saved.onlist;
    else delete process.env.ONLIST_MANAGEMENT_KEY;
  });

  it("prefers the explicit managementKey", () => {
    const client = new Onlist({ apiKey: "sk-a", managementKey: "mgmt_b" });
    expect(client.managementKey).toBe("mgmt_b");
  });

  it("reads ONLIST_MANAGEMENT_KEY", () => {
    process.env.ONLIST_MANAGEMENT_KEY = "mgmt_from_env";
    const client = new Onlist({ apiKey: "sk-a" });
    expect(client.managementKey).toBe("mgmt_from_env");
  });

  it("falls back to the API key", () => {
    const client = new Onlist({ apiKey: "sk-a" });
    expect(client.managementKey).toBe("sk-a");
  });

  it("sends the fallback key — no local prefix check, the server decides", async () => {
    const client = new Onlist({ apiKey: "sk-only" });
    fetchSpy.mockResolvedValueOnce(json(forbiddenBody, 403));

    await expect(client.credits.get()).rejects.toThrow(PermissionDeniedError);
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer sk-only");
  });
});
