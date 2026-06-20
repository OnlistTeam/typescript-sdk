import { describe, it, expect } from "vitest";
import { Onlist } from "../src/index.js";
import OpenAI from "openai";

describe("Onlist client", () => {
  it("extends OpenAI", () => {
    const client = new Onlist({ apiKey: "sk-test" });
    expect(client).toBeInstanceOf(OpenAI);
  });

  it("defaults baseURL to onlist.io", () => {
    const client = new Onlist({ apiKey: "sk-test" });
    expect(client.baseURL).toBe("https://onlist.io/v1");
  });

  it("allows custom baseURL", () => {
    const client = new Onlist({ apiKey: "sk-test", baseURL: "https://custom.io/v1" });
    expect(client.baseURL).toBe("https://custom.io/v1");
  });

  it("has marketplace attribute", () => {
    const client = new Onlist({ apiKey: "sk-test" });
    expect(client.marketplace).toBeDefined();
    expect(client.marketplace.models).toBeDefined();
    expect(client.marketplace.providers).toBeDefined();
  });

  it("inherits chat completions", () => {
    const client = new Onlist({ apiKey: "sk-test" });
    expect(client.chat).toBeDefined();
    expect(client.chat.completions).toBeDefined();
  });

  it("inherits embeddings", () => {
    const client = new Onlist({ apiKey: "sk-test" });
    expect(client.embeddings).toBeDefined();
  });
});
