import OpenAI from "openai";
import type { ClientOptions } from "openai";
import { Marketplace } from "./marketplace.js";
import { VERSION } from "./version.js";

const BASE_URL = "https://onlist.io/v1";
const MARKETPLACE_BASE_URL = "https://onlist.io";

/** Options for creating an Onlist client. */
export interface OnlistOptions extends Omit<ClientOptions, "apiKey" | "baseURL"> {
  /** API key. Falls back to ONLIST_API_KEY then OPENAI_API_KEY env vars. */
  apiKey?: string | null;
  /** Base URL for the API. Defaults to https://onlist.io/v1. */
  baseURL?: string | null;
  /** Maximum retry attempts for marketplace API calls. Defaults to 2. */
  maxRetries?: number;
}

/** Onlist API client, extending the OpenAI SDK with marketplace features. */
export class Onlist extends OpenAI {
  /** Access to marketplace data: models, providers, and rankings. */
  readonly marketplace: Marketplace;

  constructor(opts?: OnlistOptions) {
    const apiKey =
      opts?.apiKey ??
      (typeof process !== "undefined"
        ? process.env?.ONLIST_API_KEY ?? process.env?.OPENAI_API_KEY
        : undefined) ??
      undefined;

    const baseURL = opts?.baseURL ?? BASE_URL;

    super({
      ...opts,
      apiKey: apiKey ?? undefined,
      baseURL,
      defaultHeaders: {
        "User-Agent": `onlist-js/${VERSION}`,
        "HTTP-Referer": "https://onlist.io",
        ...opts?.defaultHeaders,
      },
    });

    const marketplaceBase = String(baseURL).split("/v1")[0] || MARKETPLACE_BASE_URL;

    this.marketplace = new Marketplace({
      apiKey: this.apiKey,
      baseURL: marketplaceBase,
      maxRetries: opts?.maxRetries,
    });
  }
}
