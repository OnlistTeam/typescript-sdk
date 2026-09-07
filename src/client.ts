import OpenAI from "openai";
import type { ClientOptions } from "openai";
import {
  AccountActivity,
  AccountApiKeys,
  AccountCredits,
  AccountGenerations,
  AccountOAuth,
} from "./account.js";
import { Marketplace } from "./marketplace.js";
import { VERSION } from "./version.js";

const BASE_URL = "https://onlist.io/v1";
const MARKETPLACE_BASE_URL = "https://onlist.io";

/** Options for creating an Onlist client. */
export interface OnlistOptions extends Omit<ClientOptions, "apiKey" | "baseURL"> {
  /** API key. Falls back to ONLIST_API_KEY then OPENAI_API_KEY env vars. */
  apiKey?: string | null;
  /**
   * Management key (`mgmt_...`) for the account API. Falls back to
   * ONLIST_MANAGEMENT_KEY, then to the API key.
   */
  managementKey?: string | null;
  /** Base URL for the API. Defaults to https://onlist.io/v1. */
  baseURL?: string | null;
  /** Maximum retry attempts for marketplace and account API calls. Defaults to 2. */
  maxRetries?: number;
}

/** Onlist API client, extending the OpenAI SDK with marketplace and account features. */
export class Onlist extends OpenAI {
  /** Access to marketplace data: models, providers, and rankings. */
  readonly marketplace: Marketplace;
  /** Account balance. */
  readonly credits: AccountCredits;
  /** Cost and timing for individual calls. */
  readonly generations: AccountGenerations;
  /** Inference key management. */
  readonly apiKeys: AccountApiKeys;
  /** Daily usage rollups. */
  readonly activity: AccountActivity;
  /** Sign in with Onlist — the PKCE code exchange. */
  readonly oauth: AccountOAuth;
  /** The credential the account API is using. */
  readonly managementKey: string | undefined;

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

    // Falls back to the inference key so that a client built the OpenRouter
    // way — one key, one keyhole — still reaches the account endpoints.
    // Whether that key is allowed there is the server's call: the SDK never
    // inspects key prefixes locally, it just surfaces the 403.
    this.managementKey =
      opts?.managementKey ??
      (typeof process !== "undefined" ? process.env?.ONLIST_MANAGEMENT_KEY : undefined) ??
      this.apiKey ??
      undefined;

    const accountOpts = {
      apiKey: this.managementKey,
      baseURL: marketplaceBase,
      maxRetries: opts?.maxRetries,
    };
    this.credits = new AccountCredits(accountOpts);
    this.generations = new AccountGenerations(accountOpts);
    this.apiKeys = new AccountApiKeys(accountOpts);
    this.activity = new AccountActivity(accountOpts);
    this.oauth = new AccountOAuth(accountOpts);
  }
}
