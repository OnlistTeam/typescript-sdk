import OpenAI from "openai";
import type { ClientOptions } from "openai";
import { Marketplace } from "./marketplace.js";
import { VERSION } from "./version.js";

const BASE_URL = "https://onlist.io/v1";
const MARKETPLACE_BASE_URL = "https://onlist.io";
const ENV_API_KEY = "ONLIST_API_KEY";

export interface OnlistOptions extends Omit<ClientOptions, "apiKey" | "baseURL"> {
  apiKey?: string | null;
  baseURL?: string | null;
}

export class Onlist extends OpenAI {
  readonly marketplace: Marketplace;

  constructor(opts?: OnlistOptions) {
    const apiKey =
      opts?.apiKey ??
      (typeof process !== "undefined" ? process.env?.[ENV_API_KEY] : undefined) ??
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
    });
  }
}
