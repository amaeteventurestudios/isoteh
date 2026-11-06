// The publisher side: places and their ad slots, bookings, earnings and reports.
import * as React from 'react';
import { Link } from 'react-router-dom';
import { IconPlus, IconCode, IconExternalLink } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Page, PageHeader, Section, GhostRows } from '@/components/page';
import { Field, FormError, useAction } from '@/components/form';
import { TrendChart, GhostWave } from '@/components/trend-chart';
import { useApp } from '@/lib/app-context';
import { api, money, toMinor, num, pct, day, when } from '@/lib/api';
import { Code } from './events';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export const KIND: Record<string, string> = { site: 'Website or blog', newsletter: 'Newsletter', app: 'App or chat', game: 'Game', creator: 'Creator channel' };
export const FORMAT: Record<string, string> = { banner: 'Banner', native: 'Native card', email: 'Newsletter block', game: 'In-game board', creator: 'Sponsored post' };
export const BOOKING: Record<string, [string, string]> = { requested: ['Waiting for the owner', 'warn'], awaiting_payment: ['Waiting for payment', 'warn'], paid: ['Paid, starts soon', 'ok'], live: ['Running', 'ok'],
  settled: ['Done, owner paid', ''], declined: ['Declined', 'bad'], cancelled: ['Cancelled', ''], expired: ['Expired', ''], disputed: ['Disputed', 'bad'], refunded: ['Refunded', ''] };
export function BookingBadge({ s }: { s: string }) {
  const [t, c] = BOOKING[s] ?? [s, ''];
  return <Badge variant="outline" className={cn('font-normal', c === 'ok' && 'border-brand/40 bg-brand-soft text-brand', c === 'bad' && 'border-destructive/40 text-destructive', c === 'warn' && 'border-amber-500/40 text-amber-700 dark:text-amber-400')}>{t}</Badge>;
}
const Sel = ({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: Record<string, string>; label: string }) => (
  <Select value={value} onValueChange={onChange}><SelectTrigger className="w-full" aria-label={label}><SelectValue /></SelectTrigger>
    <SelectContent>{Object.entries(options).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
);

// ---- dashboard ----
export function PublisherDashboard() {
  const [own, setOwn] = React.useState<any[] | null>(null);
  const [money_, setMoney] = React.useState<any>(null);
  const [bk, setBk] = React.useState<any[]>([]);
  React.useEffect(() => {
    api('/v1/reports?as=owner&days=30').then((r) => setOwn(r.rows)).catch(() => setOwn([]));
    api('/v1/money').then(setMoney).catch(() => {});
    api('/v1/bookings?as=owner').then((r) => setBk(r.bookings)).catch(() => {});
  }, []);
  const byDay = new Map<string, any>();
  for (const r of own ?? []) { const o = byDay.get(r.day) ?? { k: r.day, views: 0, clicks: 0 }; o.views += r.views; o.clicks += r.clicks; byDay.set(r.day, o); }
  const data = [...byDay.values()];
  const views = data.reduce((s, x) => s + x.views, 0), clicks = data.reduce((s, x) => s + x.clicks, 0);
  const earned = (money_?.ledger ?? []).filter((l: any) => l.kind === 'earning' && l.at > Date.now() - 30 * 86_400_000);
  const cur = earned[0]?.currency ?? money_?.balances?.[0]?.currency ?? 'USD';
  const waiting = bk.filter((b) => b.status === 'requested');
  const M = [['Earned, 30 days', money(earned.filter((l: any) => l.currency === cur).reduce((s: number, l: any) => s + l.amount, 0), cur)], ['Balance', money((money_?.balances ?? []).find((b: any) => b.currency === cur)?.amount ?? 0, cur)],
    ['Views', num(views)], ['Clicks', num(clicks)], ['Click rate', pct(clicks, views)], ['Requests waiting', num(waiting.length)]];
  return (
    <Page>
      <PageHeader title="Dashboard" actions={<Button asChild><Link to="/app/places"><IconPlus />Add a place</Link></Button>} />
      <section className="rounded-xl border bg-card shadow-xs">
        <div className="grid grid-cols-2 border-b sm:grid-cols-3 lg:grid-cols-6">
          {M.map(([l, v]) => <div key={l} className="px-5 py-4"><p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{l}</p><p className="mt-1 text-xl font-semibold tracking-tight tabular">{v}</p></div>)}
        </div>
        <div className="relative h-[290px] px-2 pt-4 pb-2">
          {data.length ? <TrendChart data={data} keys={[{ key: 'views', label: 'Views' }, { key: 'clicks', label: 'Clicks' }]} height={270} /> : (
            <div className="absolute inset-x-4 top-6 bottom-2"><GhostWave /><div className="absolute inset-0 flex flex-col items-center justify-center text-center"><p className="font-medium">No views yet</p><p className="mt-1 max-w-sm text-sm text-muted-foreground">Add a place and paste its code. Views and clicks show up here.</p></div></div>
          )}
        </div>
      </section>
      <section className="mt-6 overflow-hidden rounded-xl border bg-card shadow-xs">
        <div className="flex items-center border-b px-5 py-3.5"><h2 className="flex-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Latest bookings</h2><Link to="/app/bookings" className="text-sm underline-offset-4 hover:underline">All bookings</Link></div>
        {bk.length ? <ul className="divide-y">{bk.slice(0, 6).map((b) => (
          <li key={b.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm"><span className="flex-1 font-medium">{b.sponsor}<span className="font-normal text-muted-foreground"> on {b.property}, {b.slot}</span></span><BookingBadge s={b.status} /><span className="tabular">{money(b.amount - b.fee, b.currency)}</span></li>))}</ul>
          : <p className="px-5 py-10 text-center text-sm text-muted-foreground">Bookings show up here. Share your booking page to get the first one.</p>}
      </section>
    </Page>
  );
}

// ---- places ----
export function Places() {
  const { site } = useApp();
  const [props, setProps] = React.useState<any[] | null>(null);
  const [add, setAdd] = React.useState(false);
  const [slotFor, setSlotFor] = React.useState<any>(null);
  const [code, setCode] = React.useState<any[] | null>(null);
  const load = React.useCallback(() => api('/v1/properties').then((r) => setProps(r.properties)).catch(() => setProps([])), []);
  React.useEffect(() => { load(); }, [load]);
  return (
    <Page>
      <PageHeader title="Places" actions={<Button onClick={() => setAdd(true)}><IconPlus />Add a place</Button>}>
        <p className="mt-1 text-sm text-muted-foreground">Where ads appear: your website, newsletter, app, game or channel. You set the price, approve every ad, and keep {100 - (site.feeBps ?? 1500) / 100}%.</p>
      </PageHeader>
      {!props ? <GhostRows /> : !props.length ? (
        <div className="relative"><GhostRows rows={4} /><div className="absolute inset-0 flex flex-col items-center justify-center text-center"><p className="font-medium">Add your first place</p><p className="mt-1 max-w-md text-sm text-muted-foreground">Then add an ad slot, set a price and paste one line of code.</p><Button variant="ink" className="mt-4" onClick={() => setAdd(true)}><IconPlus />Add a place</Button></div></div>
      ) : <div className="grid gap-5">{props.map((p) => (
        <Section key={p.id} title={<span className="flex flex-wrap items-center gap-2">{p.name}<Badge variant="outline" className="font-normal">{KIND[p.kind]}</Badge></span>}
          description={[p.url, p.country, p.audience ? `${num(p.audience)} audience` : null, p.currency].filter(Boolean).join(' · ')}
          action={<Button variant="outline" size="sm" onClick={() => setSlotFor(p)}><IconPlus />Add ad slot</Button>}>
          {p.slots.length ? <ul className="-mx-2 divide-y">{p.slots.map((s: any) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{s.name} <span className="font-normal text-muted-foreground">· {FORMAT[s.format]}{s.width ? ` · ${s.width}×${s.height}` : ''}</span></p>
                <p className="text-xs text-muted-foreground">{[s.price_day && `${money(s.price_day, p.currency)} a day`, s.price_week && `${money(s.price_week, p.currency)} a week`, s.price_post && `${money(s.price_post, p.currency)} a post`].filter(Boolean).join(' · ') || 'No price set'}
                  {s.booking_open ? '' : ' · not taking bookings'}{s.network ? ' · network ads fill unsold time' : ''}</p>
              </div>
              <Button variant="ghost" size="sm" asChild><a href={`/book/${s.id}`} target="_blank" rel="noopener">Booking page<IconExternalLink /></a></Button>
              <Button variant="outline" size="sm" onClick={async () => { try { setCode((await api(`/v1/slots/${s.id}/snippets`)).snippets); } catch (e: any) { toast.error(e.message); } }}><IconCode />Get the code</Button>
            </li>))}</ul> : <p className="text-sm text-muted-foreground">No ad slots yet. Add one to start selling.</p>}
        </Section>))}</div>}
      <PlaceDialog open={add} onOpenChange={setAdd} onDone={() => { setAdd(false); load(); }} />
      <SlotDialog place={slotFor} onOpenChange={(o) => !o && setSlotFor(null)} onDone={() => { setSlotFor(null); load(); }} />
      <Dialog open={!!code} onOpenChange={(o) => !o && setCode(null)}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Put the ad slot on your place</DialogTitle><DialogDescription>Pick the one that fits. Space is kept free while the ad loads, so your page doesn’t jump.</DialogDescription></DialogHeader>
          <div className="grid gap-5">{code?.map((x) => <div key={x.where} className="grid gap-2"><p className="font-medium">{x.where}</p><p className="text-sm text-muted-foreground">{x.how}</p><Code code={x.code} /></div>)}</div>
        </DialogContent>
      </Dialog>
    </Page>
  );
}

function PlaceDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const { site } = useApp();
  const blank = { kind: 'site', name: '', url: '', about: '', keywords: '', audience: '', country: 'US', currency: 'USD' };
  const [f, setF] = React.useState(blank);
  const { busy, error, setError, run } = useAction();
  React.useEffect(() => { if (open) { setF(blank); setError(null); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Add a place</DialogTitle><DialogDescription>Where ads will appear.</DialogDescription></DialogHeader>
        <form className="grid gap-4" onSubmit={async (e) => { e.preventDefault(); if (await run(() => api('/v1/properties', { ...f, audience: Number(f.audience) || 0 }))) { toast.success('Place added. Now add an ad slot.'); onDone(); } }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kind"><Sel label="Kind" value={f.kind} onChange={(v) => setF({ ...f, kind: v })} options={KIND} /></Field>
            <Field label="Name" htmlFor="p-name"><Input id="p-name" value={f.name} onChange={set('name')} placeholder="Austin Eats" /></Field>
          </div>
          <Field label="Address" htmlFor="p-url" hint="Optional"><Input id="p-url" value={f.url} onChange={set('url')} placeholder="https://…" /></Field>
          <Field label="What it is about" htmlFor="p-about"><Textarea id="p-about" rows={2} value={f.about} onChange={set('about')} placeholder="Recipes and restaurant reviews from Austin" /></Field>
          <Field label="Topics" htmlFor="p-kw" hint="Helps pick ads that fit"><Input id="p-kw" value={f.keywords} onChange={set('keywords')} placeholder="food, austin, bbq" /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Audience a month" htmlFor="p-aud"><Input id="p-aud" type="number" min={0} value={f.audience} onChange={set('audience')} /></Field>
            <Field label="Country" htmlFor="p-co"><Input id="p-co" maxLength={2} value={f.country} onChange={set('country')} /></Field>
            <Field label="You charge in"><Sel label="Currency" value={f.currency} onChange={(v) => setF({ ...f, currency: v })} options={Object.fromEntries((site.currencies ?? ['USD']).map((c) => [c, c]))} /></Field>
          </div>
          <FormError error={error} />
          <Button type="submit" variant="ink" disabled={busy || !f.name}>Add place</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SlotDialog({ place, onOpenChange, onDone }: { place: any; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const p = place ?? {};
  const creator = p.kind === 'creator';
  const fmt = ({ site: 'banner', newsletter: 'email', app: 'native', game: 'game', creator: 'creator' } as Record<string, string>)[p.kind] ?? 'banner';
  const [f, setF] = React.useState<any>({});
  const { busy, error, setError, run } = useAction();
  React.useEffect(() => { if (place) { setError(null); setF({ name: '', format: fmt, width: fmt === 'email' ? '600' : '300', height: fmt === 'email' ? '200' : '250', price_day: '', price_week: '', price_post: '', booking_open: true, approve: true, network: false }); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [place]);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const sw = (k: string, l: string) => <Label className="flex items-center justify-between gap-3 rounded-lg border p-3 font-normal"><span>{l}</span><Switch checked={!!f[k]} onCheckedChange={(v) => setF({ ...f, [k]: v })} /></Label>;
  return (
    <Dialog open={!!place} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Add an ad slot to {p.name}</DialogTitle><DialogDescription>One space where an ad shows, with your price.</DialogDescription></DialogHeader>
        <form className="grid gap-4" onSubmit={async (e) => { e.preventDefault(); if (await run(() => api('/v1/slots', { ...f, property_id: p.id, width: Number(f.width) || 0, height: Number(f.height) || 0,
          price_day: toMinor(f.price_day || 0, p.currency), price_week: toMinor(f.price_week || 0, p.currency), price_post: toMinor(f.price_post || 0, p.currency) }))) { toast.success('Slot added. Get the code to put it live.'); onDone(); } }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="s-name"><Input id="s-name" value={f.name ?? ''} onChange={set('name')} placeholder={p.kind === 'newsletter' ? 'Top of every issue' : 'Sidebar'} /></Field>
            {!creator && <Field label="Format"><Sel label="Format" value={f.format ?? fmt} onChange={(v) => setF({ ...f, format: v })} options={Object.fromEntries(Object.entries(FORMAT).filter(([k]) => k !== 'creator'))} /></Field>}
          </div>
          {!creator && <div className="grid grid-cols-2 gap-4"><Field label="Width" htmlFor="s-w"><Input id="s-w" type="number" min={0} value={f.width ?? ''} onChange={set('width')} /></Field><Field label="Height" htmlFor="s-h"><Input id="s-h" type="number" min={0} value={f.height ?? ''} onChange={set('height')} /></Field></div>}
          {creator ? <Field label={`Price per post (${p.currency})`} htmlFor="s-pp"><Input id="s-pp" inputMode="decimal" value={f.price_post ?? ''} onChange={set('price_post')} /></Field> : (
            <div className="grid grid-cols-2 gap-4">
              <Field label={`Per day (${p.currency})`} htmlFor="s-pd" hint="Optional"><Input id="s-pd" inputMode="decimal" value={f.price_day ?? ''} onChange={set('price_day')} /></Field>
              <Field label={`Per week (${p.currency})`} htmlFor="s-pw" hint="Optional"><Input id="s-pw" inputMode="decimal" value={f.price_week ?? ''} onChange={set('price_week')} /></Field>
            </div>
          )}
          {sw('booking_open', 'Take bookings')}
          {sw('approve', 'I approve each booking first')}
          {!creator && sw('network', 'Fill unsold time with network ads, paid per view')}
          <FormError error={error} />
          <Button type="submit" variant="ink" disabled={busy || !f.name}>Add slot</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- bookings (both sides) ----
export function PayButtons({ b, onPaid }: { b: any; onPaid?: () => void }) {
  const { site } = useApp();
  const L: Record<string, string> = { manual: 'Bank transfer', paystack: 'Paystack', stripe: 'Pay by card' };
  return <div className="flex flex-wrap gap-2">{(site.providers ?? ['manual']).map((p) => (
    <Button key={p} size="sm" variant={p === 'manual' ? 'outline' : 'default'} onClick={async () => {
      try { const r = await api(`/v1/bookings/${b.id}/pay`, { provider: p }); onPaid?.(); location.href = r.url.startsWith(location.origin) ? r.url.replace(location.origin, '') : r.url; } catch (e: any) { toast.error(e.message); }
    }}>{L[p] ?? p}</Button>))}</div>;
}

export function Bookings() {
  const [mine, setMine] = React.useState<any[]>([]);
  const [theirs, setTheirs] = React.useState<any[]>([]);
  const load = React.useCallback(() => Promise.all([api('/v1/bookings'), api('/v1/bookings?as=owner')]).then(([a, b]) => { setMine(a.bookings); setTheirs(b.bookings); }).catch(() => {}), []);
  React.useEffect(() => { load(); }, [load]);
  const act = async (b: any, path: string, data: any = {}) => { try { await api(`/v1/bookings/${b.id}/${path}`, data); load(); } catch (e: any) { toast.error(e.message); } };
  const table = (rows: any[], owner: boolean) => rows.length ? (
    <div className="-mx-2 overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="px-2 py-2 font-medium">{owner ? 'Advertiser' : 'Where'}</th><th className="px-2 py-2 font-medium">When</th><th className="px-2 py-2 text-right font-medium">Amount</th><th className="px-2 py-2 font-medium">Status</th><th className="hidden px-2 py-2 text-right font-medium md:table-cell">Views · clicks</th><th className="px-2 py-2" /></tr></thead>
      <tbody>{rows.map((b) => (
        <tr key={b.id} className="border-b align-top last:border-0">
          <td className="px-2 py-3">{owner ? <><span className="font-medium">{b.sponsor}</span>{b.title ? ` ${b.title}` : ''}{b.review !== 'approved' && <div className="text-xs text-muted-foreground">Ad being checked</div>}</> : <><span className="font-medium">{b.property}</span> · {b.slot}</>}{b.note && <div className="max-w-xs text-xs text-muted-foreground">{b.note}</div>}</td>
          <td className="px-2 py-3 whitespace-nowrap">{b.unit === 'post' ? (b.post_url ? <a href={b.post_url} target="_blank" rel="noopener" className="underline">The post</a> : `${b.qty} post`) : `${day(b.starts)} to ${day(b.ends - 1)}`}</td>
          <td className="px-2 py-3 text-right whitespace-nowrap tabular">{money(b.amount, b.currency)}{owner && <div className="text-xs text-muted-foreground">you get {money(b.amount - b.fee, b.currency)}</div>}</td>
          <td className="px-2 py-3"><BookingBadge s={b.status} /></td>
          <td className="hidden px-2 py-3 text-right tabular md:table-cell">{num(b.views)} · {num(b.clicks)}</td>
          <td className="px-2 py-3"><div className="flex flex-wrap justify-end gap-2">
            {owner && b.status === 'requested' && <><Button size="sm" onClick={() => act(b, 'accept')}>Accept</Button><Button size="sm" variant="outline" onClick={() => act(b, 'decline')}>Decline</Button></>}
            {owner && b.unit === 'post' && ['paid', 'live'].includes(b.status) && <><code className="text-xs">{b.link}</code><Button size="sm" onClick={() => { const url = prompt('Paste the link to your post (https://…)'); if (url) act(b, 'post', { url }); }}>{b.post_url ? 'Change post link' : 'I posted it'}</Button></>}
            {!owner && b.status === 'awaiting_payment' && <PayButtons b={b} />}
            {!owner && ['requested', 'awaiting_payment'].includes(b.status) && <Button size="sm" variant="outline" onClick={() => act(b, 'cancel')}>Cancel</Button>}
            {!owner && b.status === 'live' && b.unit === 'post' && b.post_url && <Button size="sm" onClick={() => act(b, 'confirm')}>Looks good, pay them</Button>}
            {!owner && ['paid', 'live'].includes(b.status) && <Button size="sm" variant="outline" className="text-destructive" onClick={() => { const reason = prompt('What went wrong?'); if (reason) act(b, 'dispute', { reason }); }}>Report a problem</Button>}
          </div></td>
        </tr>))}</tbody></table></div>
  ) : <p className="text-sm text-muted-foreground">None yet.</p>;
  return (
    <Page>
      <PageHeader title="Bookings" />
      <div className="grid gap-5">
        <Section title="People booking your space" description="Accept or decline each request. Money is held until the ad has run, then paid to you.">{table(theirs, true)}</Section>
        <Section title="Space you booked">{table(mine, false)}</Section>
      </div>
    </Page>
  );
}

// ---- earnings ----
export function Earnings() {
  const { site } = useApp();
  const [m, setM] = React.useState<any>(null);
  const [f, setF] = React.useState({ amount: '', currency: 'USD', method: 'bank', details: '' });
  const { busy, error, run } = useAction();
  const load = React.useCallback(() => api('/v1/money').then(setM).catch(() => {}), []);
  React.useEffect(() => { load(); }, [load]);
  const KINDS: Record<string, string> = { earning: 'Earned', fee: 'Fee', topup: 'Credit added', hold: 'Held for a campaign', release: 'Returned', refund: 'Refund', payout: 'Payout', payout_returned: 'Payout returned', spend: 'Spent' };
  return (
    <Page>
      <PageHeader title="Earnings" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{(m?.balances?.length ? m.balances : [{ currency: 'USD', amount: 0 }]).map((b: any) => (
        <div key={b.currency} className="rounded-xl border bg-card p-5 shadow-xs"><p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Balance in {b.currency}</p><p className="mt-1 text-2xl font-semibold tracking-tight tabular">{money(b.amount, b.currency)}</p></div>))}</div>
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Section title="History">
          {m?.ledger?.length ? <div className="-mx-2 overflow-x-auto"><table className="w-full text-sm"><tbody>{m.ledger.map((l: any, i: number) => (
            <tr key={i} className="border-b last:border-0"><td className="px-2 py-2.5 whitespace-nowrap text-muted-foreground">{when(l.at)}</td><td className="px-2 py-2.5">{KINDS[l.kind] ?? l.kind}{l.note && <div className="text-xs text-muted-foreground">{l.note}</div>}</td><td className="px-2 py-2.5 text-right tabular">{money(l.amount, l.currency)}</td></tr>))}</tbody></table></div>
            : <p className="text-sm text-muted-foreground">Nothing yet.</p>}
          {m?.payouts?.length > 0 && <><h3 className="mt-5 mb-2 text-sm font-medium">Payouts</h3>{m.payouts.map((p: any) => <p key={p.id} className="text-sm">{day(p.created)} · {money(p.amount, p.currency)} · {p.status}</p>)}</>}
        </Section>
        <Section title="Get paid" description="We send it within two working days.">
          <form className="grid gap-4" onSubmit={async (e) => { e.preventDefault(); if (await run(() => api('/v1/payouts', { ...f, amount: toMinor(f.amount, f.currency) }))) { toast.success('Payout asked for'); setF({ ...f, amount: '', details: '' }); load(); } }}>
            <div className="grid grid-cols-[1fr_110px] gap-3">
              <Field label="Amount" htmlFor="po-amt"><Input id="po-amt" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
              <Field label="Currency"><Sel label="Currency" value={f.currency} onChange={(v) => setF({ ...f, currency: v })} options={Object.fromEntries((site.currencies ?? ['USD']).map((c) => [c, c]))} /></Field>
            </div>
            <Field label="How"><Sel label="How" value={f.method} onChange={(v) => setF({ ...f, method: v })} options={{ bank: 'Bank account (ACH)', paypal: 'PayPal', mobile_money: 'Mobile money', other: 'Other' }} /></Field>
            <Field label="Account details" htmlFor="po-d"><Textarea id="po-d" rows={3} value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} placeholder="Bank name, routing and account number, account holder; or PayPal email" /></Field>
            <FormError error={error} />
            <Button type="submit" variant="ink" disabled={busy || !Number(f.amount) || !f.details}>Ask for payout</Button>
          </form>
        </Section>
      </div>
    </Page>
  );
}

// ---- reports ----
export function Reports() {
  const [own, setOwn] = React.useState<any[]>([]);
  const [bought, setBought] = React.useState<any[]>([]);
  React.useEffect(() => { Promise.all([api('/v1/reports?as=owner&days=30'), api('/v1/reports?days=30')]).then(([a, b]) => { setOwn(a.rows); setBought(b.rows); }).catch(() => {}); }, []);
  const block = (title: string, rows: any[], nameOf: (r: any) => string) => {
    const by = new Map<string, any>(), days = new Map<string, any>();
    for (const r of rows) { const k = nameOf(r); const x = by.get(k) ?? { serves: 0, views: 0, clicks: 0 }; x.serves += r.serves; x.views += r.views; x.clicks += r.clicks; by.set(k, x); const d = days.get(r.day) ?? { k: r.day, views: 0, clicks: 0 }; d.views += r.views; d.clicks += r.clicks; days.set(r.day, d); }
    return (
      <Section title={title} description="Last 30 days. “Seen” counts an ad at least half on screen for a second. Newsletter “shown” counts opens, which mail apps inflate; clicks are exact.">
        {rows.length ? <>
          <TrendChart data={[...days.values()]} keys={[{ key: 'views', label: 'Seen' }, { key: 'clicks', label: 'Clicks' }]} height={200} />
          <div className="-mx-2 mt-4 overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="px-2 py-2 font-medium" /><th className="px-2 py-2 text-right font-medium">Shown</th><th className="px-2 py-2 text-right font-medium">Seen</th><th className="px-2 py-2 text-right font-medium">Clicks</th><th className="px-2 py-2 text-right font-medium">Click rate</th></tr></thead>
            <tbody>{[...by].map(([k, x]) => <tr key={k} className="border-b last:border-0"><td className="px-2 py-2.5">{k}</td><td className="px-2 py-2.5 text-right tabular">{num(x.serves)}</td><td className="px-2 py-2.5 text-right tabular">{num(x.views)}</td><td className="px-2 py-2.5 text-right tabular">{num(x.clicks)}</td><td className="px-2 py-2.5 text-right tabular">{pct(x.clicks, x.views)}</td></tr>)}</tbody>
          </table></div></> : <p className="text-sm text-muted-foreground">No numbers yet.</p>}
      </Section>
    );
  };
  return <Page><PageHeader title="Reports" /><div className="grid gap-5">{block('Your space', own, (r) => r.slot)}{block('Your ads', bought, (r) => `${r.sponsor}${r.title ? `: ${r.title}` : ''}`)}</div></Page>;
}

// ---- find ad space (advertisers) ----
export function FindSpace() {
  const [q, setQ] = React.useState({ q: '', kind: 'all', country: '' });
  const [slots, setSlots] = React.useState<any[] | null>(null);
  const load = React.useCallback(() => api(`/v1/market?${new URLSearchParams({ q: q.q, kind: q.kind === 'all' ? '' : q.kind, country: q.country })}`).then((r) => setSlots(r.slots)).catch(() => setSlots([])), [q]);
  React.useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  return (
    <Page>
      <PageHeader title="Find ad space"><p className="mt-1 text-sm text-muted-foreground">Book directly with the people who own it. Paid up front, held until your ad has run.</p></PageHeader>
      <form className="mb-6 grid gap-2 rounded-xl border bg-card p-3 shadow-xs sm:grid-cols-[1fr_200px_120px_auto]" onSubmit={(e) => { e.preventDefault(); load(); }}>
        <Input value={q.q} onChange={(e) => setQ({ ...q, q: e.target.value })} placeholder="Search: food, Austin, racing…" aria-label="Search" />
        <Sel label="Kind" value={q.kind} onChange={(v) => setQ({ ...q, kind: v })} options={{ all: 'Every kind', ...KIND }} />
        <Input value={q.country} onChange={(e) => setQ({ ...q, country: e.target.value.toUpperCase() })} maxLength={2} placeholder="Country" aria-label="Country" />
        <Button type="submit" variant="ink">Search</Button>
      </form>
      {!slots ? <GhostRows /> : !slots.length ? <p className="py-10 text-center text-muted-foreground">Nothing listed yet that matches.</p> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{slots.map((s) => (
          <a key={s.id} href={`/book/${s.id}`} className="group rounded-xl border bg-card p-5 shadow-xs transition-colors hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            <div className="flex flex-wrap gap-1.5"><Badge variant="outline" className="font-normal">{KIND[s.kind]}</Badge><Badge variant="outline" className="font-normal">{FORMAT[s.format]}</Badge></div>
            <p className="mt-3 font-medium group-hover:underline">{s.property}</p>
            <p className="text-sm text-muted-foreground">{s.name}{s.width ? ` · ${s.width}×${s.height}` : ''}{s.country ? ` · ${s.country}` : ''}</p>
            {s.about && <p className="mt-2 line-clamp-2 text-sm">{s.about}</p>}
            <p className="mt-3 text-sm"><span className="font-semibold">{s.price_day ? `${money(s.price_day, s.currency)} a day` : s.price_week ? `${money(s.price_week, s.currency)} a week` : `${money(s.price_post, s.currency)} a post`}</span>{s.audience ? <span className="text-muted-foreground"> · {num(s.audience)} audience</span> : null}</p>
          </a>))}</div>
      )}
    </Page>
  );
}

// ---- staff review ----
export function Review() {
  const [d, setD] = React.useState<any>(null);
  const load = React.useCallback(() => Promise.all([api('/v1/staff/review'), api('/v1/staff/overview'), api('/v1/staff/tickets')]).then(([r, o, t]) => setD({ ads: r.ads, o, tickets: t.tickets })).catch((e) => toast.error(e.message)), []);
  React.useEffect(() => { load(); }, [load]);
  const go = async (path: string, data: any = {}) => { try { await api(path, data); load(); } catch (e: any) { toast.error(e.message); } };
  if (!d) return <Page><PageHeader title="Staff review" /><GhostRows /></Page>;
  const bal = (l: any[]) => (l.length ? l.map((b) => money(b.amount, b.currency)).join(' · ') : '0');
  return (
    <Page>
      <PageHeader title="Staff review" />
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[['Today', `${num(d.o.today.views)} views`, `${num(d.o.today.clicks)} clicks · ${num(d.o.today.serves)} shown`], ['Held for running ads', bal(d.o.escrow), ''], ['Our fees', bal(d.o.fees), ''], ['People and places', num(d.o.accounts), `${num(d.o.properties)} places · ${num(d.o.slots)} slots`]].map(([l, v, s]) => (
          <div key={l} className="rounded-xl border bg-card p-5 shadow-xs"><p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{l}</p><p className="mt-1 text-xl font-semibold tabular">{v}</p>{s && <p className="text-xs text-muted-foreground">{s}</p>}</div>))}
      </div>
      <div className="grid gap-5">
        <Section title={`Ads to check (${d.ads.length})`}>{d.ads.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{d.ads.map((a: any) => (
          <div key={a.id} className="rounded-lg border p-3">
            {a.image_url && <img src={a.image_url} alt="" className="mb-2 max-h-40 w-full rounded-md border object-contain" />}
            <p className="font-medium">{a.sponsor}{a.title ? `: ${a.title}` : ''}</p>{a.body && <p className="text-sm">{a.body}</p>}
            <p className="mt-1 truncate text-xs text-muted-foreground"><a href={a.url} target="_blank" rel="noopener noreferrer" className="underline">{a.url}</a> · {a.email}</p>
            <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => go(`/v1/staff/ads/${a.id}/review`, { decision: 'approved' })}>Approve</Button>
              <Button size="sm" variant="outline" className="text-destructive" onClick={() => { const note = prompt('Why? (the advertiser sees this)'); if (note !== null) go(`/v1/staff/ads/${a.id}/review`, { decision: 'rejected', note }); }}>Reject</Button></div>
          </div>))}</div> : <p className="text-sm text-muted-foreground">All checked.</p>}</Section>
        <Section title={`Support tickets (${d.tickets.length})`}>{d.tickets.length ? <ul className="divide-y">{d.tickets.map((t: any) => (
          <li key={t.id} className="py-3"><div className="flex flex-wrap items-center gap-2"><p className="flex-1 font-medium">{t.subject}</p><Badge variant="outline" className="font-normal">{t.category}</Badge><Button size="sm" variant="outline" onClick={() => go(`/v1/staff/tickets/${t.id}/close`)}>Done</Button></div>
            <p className="text-xs text-muted-foreground">{t.person} ({t.email}) for {t.org} · {when(t.created)}</p><p className="mt-1 text-sm whitespace-pre-wrap">{t.body}</p></li>))}</ul> : <p className="text-sm text-muted-foreground">None open.</p>}</Section>
        <Section title="Transfers to confirm">{d.o.payments.length ? d.o.payments.map((p: any) => (
          <div key={p.ref} className="flex flex-wrap items-center justify-between gap-2 border-t py-2 first:border-0 text-sm"><span><code>{p.ref}</code> · {money(p.amount, p.currency)} · {p.email} · {p.kind}</span><Button size="sm" onClick={() => go(`/v1/staff/payments/${p.ref}/paid`)}>Money received</Button></div>)) : <p className="text-sm text-muted-foreground">None waiting.</p>}</Section>
        <Section title="Payouts to send">{d.o.payouts.length ? d.o.payouts.map((p: any) => (
          <div key={p.id} className="border-t py-3 first:border-0 text-sm"><p><b>{money(p.amount, p.currency)}</b> to {p.name} ({p.email}) by {p.method.replace('_', ' ')}</p><pre className="my-2 rounded bg-muted p-2 text-xs whitespace-pre-wrap">{p.details}</pre>
            <div className="flex gap-2"><Button size="sm" onClick={() => go(`/v1/staff/payouts/${p.id}/paid`)}>Sent</Button><Button size="sm" variant="outline" onClick={() => go(`/v1/staff/payouts/${p.id}/return`)}>Return to balance</Button></div></div>)) : <p className="text-sm text-muted-foreground">None waiting.</p>}</Section>
        <Section title="Disputes">{d.o.disputes.length ? d.o.disputes.map((b: any) => (
          <div key={b.id} className="border-t py-3 first:border-0 text-sm"><p><b>{b.slot}</b> · {money(b.amount, b.currency)}</p>{b.post_url && <a href={b.post_url} target="_blank" rel="noopener noreferrer" className="text-xs underline">{b.post_url}</a>}<pre className="my-2 rounded bg-muted p-2 text-xs whitespace-pre-wrap">{b.note}</pre>
            <div className="flex gap-2"><Button size="sm" onClick={() => go(`/v1/staff/bookings/${b.id}/release`)}>Pay the owner</Button><Button size="sm" variant="outline" className="text-destructive" onClick={() => go(`/v1/staff/bookings/${b.id}/refund`)}>Refund the advertiser</Button></div></div>)) : <p className="text-sm text-muted-foreground">None.</p>}</Section>
      </div>
    </Page>
  );
}

// ---- paying by transfer ----
export function PayPage() {
  const { site } = useApp();
  const ref = location.pathname.split('/').pop()!;
  const [p, setP] = React.useState<any>(null);
  React.useEffect(() => { api(`/v1/payments/${ref}`).then((r) => setP(r.payment)).catch((e) => toast.error(e.message)); }, [ref]);
  if (!p) return <Page><GhostRows rows={3} /></Page>;
  return (
    <Page className="max-w-xl">
      <PageHeader title={p.status === 'paid' ? 'Paid. Thank you.' : 'Pay by transfer'} />
      <Section>
        {p.status === 'paid' ? <p>Your payment is confirmed.</p> : <div className="grid gap-3 text-sm">
          <p>Send {money(p.amount, p.currency)} by bank transfer (ACH or wire) and put this reference in the memo:</p>
          <Code code={p.ref} />
          {site.payInstructions ? <Code code={site.payInstructions} /> : <p className="text-muted-foreground">Our team will send you the account to pay into.</p>}
          <p className="text-muted-foreground">Our team confirms it, usually the same day, and your booking or credit starts straight away.</p>
        </div>}
        <Button asChild variant="outline" className="mt-5"><Link to={p.kind === 'booking' ? '/app/bookings' : '/app/settings?tab=billing'}>Back</Link></Button>
      </Section>
    </Page>
  );
}
