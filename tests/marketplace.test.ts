import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Marketplace } from "../src/marketplace.js";
import { AuthenticationError, NotFoundError } from "../src/errors.js";

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

const mockRankingsResponse = {
  success: true,
  data: {
    leaderboard: [
      { rank: 1, model_name: "gpt-4o", author: "openai", author_icon: null, total_tokens: "1000000", total_requests: 500, growth_pct: null },
    ],
    series: [{ bucket: "2026-06-01", value: 100000, type: "gpt-4o" }],
    top_models: ["gpt-4o"],
    sort: "popular",
    window: "week",
    start_date: "2026-06-24",
    end_date: "2026-06-30",
  },
};

const mockAppsResponse = {
  success: true,
  data: {
    apps: [
      { app_id: 1, url_key: "example.com", slug: "example", title: "Example App", description: null, domain: "example.com", icon_url: null, categories: [], rank: 1, total_requests: 100, total_tokens: "50000", growth_pct: null },
    ],
    page: 1,
    limit: 20,
    has_more: false,
    sort: "popular",
    window: "month",
    start_date: "2026-06-01",
    end_date: "2026-06-30",
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

  describe("rankings.models", () => {
    it("fetches model rankings with default params", async () => {
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockRankingsResponse), { status: 200 }));
      const result = await marketplace.rankings.models();
      expect(result.leaderboard).toHaveLength(1);
      expect(result.leaderboard[0].model_name).toBe("gpt-4o");
      expect(result.series).toHaveLength(1);
      expect(result.top_models).toContain("gpt-4o");

      const [url] = fetchSpy.mock.calls[0];
      expect(url).toContain("/api/mkt/rankings/models");
    });

    it("passes query parameters", async () => {
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockRankingsResponse), { status: 200 }));
      await marketplace.rankings.models({ sort: "trending", window: "month", limit: 10, offset: 5 });

      const [url] = fetchSpy.mock.calls[0];
      expect(url).toContain("sort=trending");
      expect(url).toContain("window=month");
      expect(url).toContain("limit=10");
      expect(url).toContain("offset=5");
    });
  });

  describe("rankings.apps", () => {
    it("fetches app rankings with default params", async () => {
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockAppsResponse), { status: 200 }));
      const result = await marketplace.rankings.apps();
      expect(result.apps).toHaveLength(1);
      expect(result.apps[0].title).toBe("Example App");
      expect(result.has_more).toBe(false);

      const [url] = fetchSpy.mock.calls[0];
      expect(url).toContain("/api/mkt/apps");
    });

    it("passes query parameters", async () => {
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockAppsResponse), { status: 200 }));
      await marketplace.rankings.apps({ sort: "trending", window: "week", category: "ai", page: 2, limit: 10 });

      const [url] = fetchSpy.mock.calls[0];
      expect(url).toContain("sort=trending");
      expect(url).toContain("window=week");
      expect(url).toContain("category=ai");
      expect(url).toContain("page=2");
      expect(url).toContain("limit=10");
    });
  });

  describe("error handling", () => {
    it("throws AuthenticationError on 401", async () => {
      const errorBody = { error: { message: "Invalid key", type: "auth_error", code: "invalid_api_key" } };
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(errorBody), { status: 401 }));
      await expect(marketplace.models.list()).rejects.toThrow(AuthenticationError);
    });

    it("throws NotFoundError on 404", async () => {
      const errorBody = { error: { message: "Model not found", type: "not_found", code: "not_found" } };
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(errorBody), { status: 404 }));
      await expect(marketplace.models.get("nonexistent/model")).rejects.toThrow(NotFoundError);
    });
  });

  describe("retry logic", () => {
    it("retries on 500 and succeeds", async () => {
      const mp = new Marketplace({ apiKey: "sk-test", baseURL: "https://onlist.io", maxRetries: 1 });

      fetchSpy
        .mockResolvedValueOnce(new Response("Internal Server Error", { status: 500 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(mockModelsResponse), { status: 200 }));

      const result = await mp.models.list();
      expect(result.data).toHaveLength(1);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("does not retry on 400", async () => {
      const mp = new Marketplace({ apiKey: "sk-test", baseURL: "https://onlist.io", maxRetries: 2 });

      const errorBody = { error: { message: "Bad request" } };
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(errorBody), { status: 400 }));

      await expect(mp.models.list()).rejects.toThrow();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("respects maxRetries: 0", async () => {
      const mp = new Marketplace({ apiKey: "sk-test", baseURL: "https://onlist.io", maxRetries: 0 });

      fetchSpy.mockResolvedValueOnce(new Response("Server Error", { status: 500 }));

      // With maxRetries: 0, should not retry -- returns the 500 response
      // which then gets parsed and raises an error
      await expect(mp.models.list()).rejects.toThrow();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});
