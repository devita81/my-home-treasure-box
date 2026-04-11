/**
 * Safe logger that only outputs to console in development mode.
 * In production, errors are silently suppressed to avoid leaking
 * technical details (DB schema, query patterns, etc.) to the browser console.
 */
export const logger = {
  error: (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.error(...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.warn(...args);
    }
  },
};
