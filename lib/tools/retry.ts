export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: { retries?: number; baseMs?: number }
): Promise<T> {
  const retries = opts?.retries ?? 2;
  const baseMs = opts?.baseMs ?? 250;

  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt === retries) break;
      const wait = baseMs * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}