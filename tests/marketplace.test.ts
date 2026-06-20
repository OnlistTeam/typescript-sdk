import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Marketplace } from "../src/marketplace.js";
import { AuthenticationError } from "../src/errors.js";

const mockModelsResponse = {
  success: true,
  data: {
    data: [
      { id: "openai/gpt-4o", name: "GPT-4o", pricing: { prompt: "0.0025", completion: "0.01" } },
    ],
    total: 1,
    offset: 0,
    limit: 20,
  },
};

const mockProvidersResponse = {
  success: true,
  data: {
    items: [
      { slug: "alice-shop", name: "Alice Shop", listing_count: 5, weighted_score: 4.5 },
    ],
    sort: "score",
  },
};

describe("Marketplace", () => {
  let marketplace: Marketplace;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    marketplace = new Marketplace({
      apiKey: "sk-test",
      baseURL: "https://onlist.io",
    });
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("models.list", () => {
    it("fetches models with default params", async () => {
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockModelsResponse), { status: 200 }));
      const result = await marketplace.models.list();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("openai/gpt-4o");

      const [url] = fetchSpy.mock.calls[0];
      expect(url).toContain("/api/mkt/models");
      expect(url).toContain("limit=20");
      expect(url).toContain("offset=0");
    });

    it("passes query parameters", async () => {
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockModelsResponse), { status: 200 }));
      await marketplace.models.list({ limit: 5, offset: 10, q: "claude" });

      const [url] = fetchSpy.mock.calls[0];
      expect(url).toContain("limit=5");
      expect(url).toContain("offset=10");
      expect(url).toContain("q=claude");
    });
  });

  describe("models.get", () => {
    it("fetches a specific model", async () => {
      const detail = { success: true, data: { data: { id: "openai/gpt-4o", name: "GPT-4o", providers: [] } } };
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(detail), { status: 200 }));
      const result = await marketplace.models.get("openai/gpt-4o");
      expect(result.id).toBe("openai/gpt-4o");

      const [url] = fetchSpy.mock.calls[0];
      expect(url).toContain("/api/mkt/models/openai/gpt-4o");
    });
  });

  describe("providers.list", () => {
    it("fetches providers", async () => {
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockProvidersResponse), { status: 200 }));
      const result = await marketplace.providers.list();
      expect(result.items).toHaveLength(1);
      expect(result.items[0].slug).toBe("alice-shop");
    });
  });

  describe("providers.get", () => {
    it("fetches a specific provider", async () => {
      const detail = { success: true, data: { data: { slug: "alice-shop", name: "Alice", listings: [] } } };
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(detail), { status: 200 }));
      const result = await marketplace.providers.get("alice-shop");
      expect(result.slug).toBe("alice-shop");
    });
  });

  describe("error handling", () => {
    it("throws AuthenticationError on 401", async () => {
      const errorBody = { error: { message: "Invalid key", type: "auth_error", code: "invalid_api_key" } };
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(errorBody), { status: 401 }));
      await expect(marketplace.models.list()).rejects.toThrow(AuthenticationError);
    });
  });
});
