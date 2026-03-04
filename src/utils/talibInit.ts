/**
 * TA-Lib (talib-web) must be initialized once before any indicator calls.
 * Call ensureTalib() before computing indicators; safe to call multiple times.
 */

let initPromise: Promise<void> | null = null;

const WASM_URL =
  "https://unpkg.com/talib-web@0.1.3/lib/talib.wasm";

export function ensureTalib(): Promise<void> {
  if (initPromise) return initPromise;
  const promise = (async () => {
    try {
      const { init } = await import("talib-web");
      await init(WASM_URL);
    } catch (e) {
      initPromise = null; // allow retry on next call (e.g. network recovered)
      throw e;
    }
  })();
  initPromise = promise;
  return promise;
}
