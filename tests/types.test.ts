import { describe, it, expect } from "vitest";
import type { ProviderRouting, ModelRankingsResponse, AppRankingsResponse } from "../src/index.js";
import { Onlist } from "../src/index.js";

describe("ProviderRouting type", () => {
  it("allows partial routing config", () => {
    const routing: ProviderRouting = { only: ["alice"], sort: "price" };
    expect(routing.only).toEqual(["alice"]);
    expect(routing.sort).toBe("price");
    expect(routing.allow_fallbacks).toBeUndefined();
  });

  it("allows full routing config", () => {
    const routing: ProviderRouting = {
      only: ["alice"],
      sort: "price",
      order: ["alice", "bob"],
      allow: ["alice"],
      ignore: ["charlie"],
      allow_fallbacks: true,
      max_price: { prompt: 0.01, completion: 0.02 },
    };
    expect(routing.max_price?.prompt).toBe(0.01);
  });
});

describe("Declaration merging", () => {
  it("allows provider field on chat.completions.create params", () => {
    // Type-level test: if this compiles, declaration merging works.
    // We don't actually call the API, just verify the type accepts `provider`.
    const _client = new Onlist({ apiKey: "sk-test" });
    const _params: Parameters<typeof _client.chat.completions.create>[0] = {
      model: "gpt-4o",
      messages: [{ role: "user", content: "hi" }],
      provider: { sort: "price", only: ["alice-shop"] },
    };
    expect(_params.provider).toBeDefined();
    expect(_params.provider?.sort).toBe("price");
  });
});

describe("Rankings types", () => {
  it("ModelRankingsResponse shape is valid", () => {
    const response: ModelRankingsResponse = {
      leaderboard: [
        { rank: 1, model_name: "gpt-4o", author: "openai", author_icon: null, total_tokens: "100", total_requests: 50, growth_pct: null },
      ],
      series: [{ bucket: "2026-06-01", value: 100, type: "gpt-4o" }],
      top_models: ["gpt-4o"],
      sort: "popular",
      window: "week",
      start_date: "2026-06-24",
      end_date: "2026-06-30",
    };
    expect(response.leaderboard).toHaveLength(1);
    expect(response.series).toHaveLength(1);
  });

  it("AppRankingsResponse shape is valid", () => {
    const response: AppRankingsResponse = {
      apps: [
        { app_id: 1, url_key: "example.com", slug: null, title: "Example", description: null, domain: "example.com", icon_url: null, categories: [], rank: 1, total_requests: 10, total_tokens: "500", growth_pct: 0.5 },
      ],
      page: 1,
      limit: 20,
      has_more: false,
      sort: "popular",
      window: "month",
      start_date: "2026-06-01",
      end_date: "2026-06-30",
    };
    expect(response.apps).toHaveLength(1);
    expect(response.apps[0].growth_pct).toBe(0.5);
  });
});
