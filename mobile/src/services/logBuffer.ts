// In-memory ring buffer of recent console.log lines, for the in-app dev log
// viewer (DevTools). Dev-only; no-op in production.

const MAX = 100;
const buffer: string[] = [];
let installed = false;

export const LOG_TAGS = ['MOCK', 'CACHE', 'SYNC', 'API'];

/** Patch console.log to also capture into the ring buffer (newest first). */
export function installLogCapture(): void {
  if (installed || !__DEV__) return;
  installed = true;
  const original = console.log.bind(console);
  console.log = (...args: unknown[]) => {
    try {
      const line = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
      buffer.unshift(`${new Date().toLocaleTimeString()}  ${line}`);
      if (buffer.length > MAX) buffer.pop();
    } catch {
      /* ignore formatting errors */
    }
    original(...args);
  };
}

/** Most recent log lines, optionally filtered by a tag substring. */
export function getLogs(filter?: string | null): string[] {
  const slice = buffer.slice(0, 20);
  return filter ? buffer.filter((l) => l.includes(`[${filter}]`)).slice(0, 20) : slice;
}
