import { describe, it, expect } from "vitest";
import type { ProviderRouting } from "../src/index.js";

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
