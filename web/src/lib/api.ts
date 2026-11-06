// Talks to the Isoteh server. Errors come back as { error } with a plain-words message.
export class ApiError extends Error { status: number; data: any; constructor(m: string, status: number, data: any) { super(m); this.status = status; this.data = data; } }

export async function api<T = any>(path: string, data?: unknown, method?: string): Promise<T> {
  const r = await fetch(path, {
    method: method ?? (data !== undefined ? 'POST' : 'GET'), credentials: 'same-origin',
    headers: data !== undefined ? { 'content-type': 'application/json' } : {}, body: data !== undefined ? JSON.stringify(data) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(j.error ?? `Error ${r.status}`, r.status, j);
  return j as T;
}

const DIG: Record<string, number> = { JPY: 0, KRW: 0, XOF: 0, XAF: 0, RWF: 0, UGX: 0 };
export const digits = (c: string) => DIG[c] ?? 2;
export const money = (minor: number, cur: string, compact = false) => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, ...(compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}) }).format((minor ?? 0) / 10 ** digits(cur)); }
  catch { return `${(minor ?? 0) / 100} ${cur}`; }
};
export const toMinor = (major: string | number, cur: string) => Math.round(Number(String(major).replace(/[^\d.]/g, '') || 0) * 10 ** digits(cur));
export const num = (n: number) => new Intl.NumberFormat().format(n ?? 0);
export const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(2)}%` : '—');
export const day = (t: number | string) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
export const when = (t: number) => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
export const fileToB64 = (file: File) => new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = no; r.readAsDataURL(file); });

export function downloadCsv(name: string, rows: (string | number)[][]) {
  const text = rows.map((r) => r.map((c) => { const s = String(c ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

export type Person = { id: string; email: string; name: string; role: string; country?: string; totp_on: boolean };
export type Org = { id: string; name: string; website: string; kind: string; setup_hidden: boolean; slack: boolean; role: string };
export type Setup = { campaign: boolean; tracking: boolean; payment: boolean; launched: boolean };
export type Workspace = { me: Person; org: Org; orgs: { id: string; name: string; kind: string; role: string; own?: boolean }[]; setup: Setup };
export type Site = { brand: string; providers: string[]; currencies: string[]; feeBps: number; releaseDays: number; publicUrl: string; payInstructions: string };
export type Totals = { spend: number; views: number; clicks: number; serves: number; conversions: number; value: number };
