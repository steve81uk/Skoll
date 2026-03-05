export interface FetchPolicyOptions<T> {
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
  validator?: (value: unknown) => value is T;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_BACKOFF_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(input: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJSONWithPolicy<T>(url: string, options: FetchPolicyOptions<T> = {}): Promise<T | null> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = options.retries ?? DEFAULT_RETRIES;
  const backoffMs = options.backoffMs ?? DEFAULT_BACKOFF_MS;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, timeoutMs);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as unknown;
      if (options.validator && !options.validator(payload)) {
        throw new Error('Schema validation failed');
      }

      return payload as T;
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        return null;
      }
      await sleep(backoffMs * (attempt + 1));
    }
  }

  void lastError;
  return null;
}
