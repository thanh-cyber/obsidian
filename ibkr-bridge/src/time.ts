export function toIsoSafe(d: Date): string {
  const t = d.getTime();
  if (!Number.isFinite(t)) return new Date(0).toISOString();
  return d.toISOString();
}

/**
 * Parse IBKR time strings.
 *
 * Common formats seen:
 * - "20260302  14:35:12" (note double space)
 * - "20260302 14:35:12"
 * - "20260302-14:35:12"
 *
 * Returned Date is in local timezone (IB sends "TWS timezone").
 */
export function parseIbkrTime(s: string): Date {
  const raw = (s ?? '').trim();
  if (!raw) return new Date(0);

  const normalized = raw.replace(/\s+/g, ' ').replace('-', ' ');
  const [datePart, timePart = '00:00:00'] = normalized.split(' ');
  if (!/^\d{8}$/.test(datePart)) return new Date(0);

  const y = Number(datePart.slice(0, 4));
  const m = Number(datePart.slice(4, 6));
  const d = Number(datePart.slice(6, 8));

  const [hh, mm, ss] = timePart.split(':').map((n) => Number(n));
  return new Date(y, m - 1, d, hh || 0, mm || 0, ss || 0, 0);
}

export function formatIbkrFilterTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  // IB expects local timezone string: "YYYYMMDD HH:MM:SS"
  return `${y}${m}${day} ${hh}:${mm}:${ss}`;
}

