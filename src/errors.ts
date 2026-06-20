export class OnlistError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OnlistError";
  }
}

export class APIError extends OnlistError {
  readonly status: number;
  readonly type: string | null;
  readonly code: string | null;
  readonly param: string | null;
  readonly body: unknown;

  constructor(
    message: string,
    opts: {
      status: number;
      type?: string | null;
      code?: string | null;
      param?: string | null;
      body?: unknown;
    },
  ) {
    super(message);
    this.name = "APIError";
    this.status = opts.status;
    this.type = opts.type ?? null;
    this.code = opts.code ?? null;
    this.param = opts.param ?? null;
    this.body = opts.body ?? null;
  }
}

export class AuthenticationError extends APIError {
  constructor(message = "Invalid API key", opts?: Partial<ConstructorParameters<typeof APIError>[1]>) {
    super(message, { status: 401, ...opts });
    this.name = "AuthenticationError";
  }
}

export class InsufficientBalanceError extends APIError {
  constructor(message = "Insufficient balance", opts?: Partial<ConstructorParameters<typeof APIError>[1]>) {
    super(message, { status: 402, ...opts });
    this.name = "InsufficientBalanceError";
  }
}

export class RateLimitError extends APIError {
  constructor(message = "Rate limited", opts?: Partial<ConstructorParameters<typeof APIError>[1]>) {
    super(message, { status: 429, ...opts });
    this.name = "RateLimitError";
  }
}

export class ProviderError extends APIError {
  constructor(message: string, opts: ConstructorParameters<typeof APIError>[1]) {
    super(message, opts);
    this.name = "ProviderError";
  }
}

export function raiseForStatus(status: number, body: unknown): never {
  let error: Record<string, unknown> = {};
  if (body && typeof body === "object" && "error" in body) {
    const e = (body as Record<string, unknown>).error;
    error = typeof e === "object" && e !== null ? (e as Record<string, unknown>) : {};
  } else if (body && typeof body === "object") {
    error = body as Record<string, unknown>;
  }

  const message = (typeof error.message === "string" ? error.message : String(body)) || "Unknown error";
  const type = typeof error.type === "string" ? error.type : null;
  const code = typeof error.code === "string" ? error.code : null;
  const param = typeof error.param === "string" ? error.param : null;
  const opts = { status, type, code, param, body };

  if (status === 401) throw new AuthenticationError(message, opts);
  if (status === 402) throw new InsufficientBalanceError(message, opts);
  if (status === 429) throw new RateLimitError(message, opts);
  if (code && code.startsWith("no_provider")) throw new ProviderError(message, opts);

  throw new APIError(message, opts);
}
