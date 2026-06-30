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
    expect(client.marketplace.rankings).toBeDefined();
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

  it("reads OPENAI_API_KEY as fallback", () => {
    const orig = process.env.OPENAI_API_KEY;
    try {
      delete process.env.ONLIST_API_KEY;
      process.env.OPENAI_API_KEY = "sk-openai-fallback";
      const client = new Onlist();
      expect(client.apiKey).toBe("sk-openai-fallback");
    } finally {
      if (orig !== undefined) {
        process.env.OPENAI_API_KEY = orig;
      } else {
        delete process.env.OPENAI_API_KEY;
      }
    }
  });

  it("prefers ONLIST_API_KEY over OPENAI_API_KEY", () => {
    const origOnlist = process.env.ONLIST_API_KEY;
    const origOpenai = process.env.OPENAI_API_KEY;
    try {
      process.env.ONLIST_API_KEY = "sk-onlist";
      process.env.OPENAI_API_KEY = "sk-openai";
      const client = new Onlist();
      expect(client.apiKey).toBe("sk-onlist");
    } finally {
      if (origOnlist !== undefined) {
        process.env.ONLIST_API_KEY = origOnlist;
      } else {
        delete process.env.ONLIST_API_KEY;
      }
      if (origOpenai !== undefined) {
        process.env.OPENAI_API_KEY = origOpenai;
      } else {
        delete process.env.OPENAI_API_KEY;
      }
    }
  });
});
