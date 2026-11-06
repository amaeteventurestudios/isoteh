import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { IconInfoCircle, IconExternalLink, IconCopy, IconCheck } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Page, PageHeader } from '@/components/page';
import { TrendChart, GhostWave } from '@/components/trend-chart';
import { DateRange, type Range } from '@/components/date-range';
import { api, num, when, iso } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { cn } from '@/lib/utils';

const CARDS = [['page_view', 'Page views'], ['clicks', 'Clicks'], ['purchase', 'Purchases'], ['sign_up', 'Sign ups']] as const;

export function Code({ code }: { code: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg border bg-muted/60 p-3.5 pr-12 font-mono text-[12.5px] leading-relaxed whitespace-pre">{code}</pre>
      <Button type="button" size="icon-sm" variant="ghost" className="absolute top-2 right-2" aria-label="Copy"
        onClick={async () => { try { await navigator.clipboard.writeText(code); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* select by hand */ } }}>{done ? <IconCheck /> : <IconCopy />}</Button>
    </div>
  );
}

export function TrackingDialog({ open, onOpenChange, start }: { open: boolean; onOpenChange: (o: boolean) => void; start?: string }) {
  const { site } = useApp();
  const base = site.publicUrl || location.origin;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Set up tracking</DialogTitle>
          <DialogDescription>Count what happens after someone clicks your ad: visits, sign-ups and sales. Every click adds an <code className="font-mono text-xs">isoteh_ref</code> to your link. It says which ad and which day, and is the same for everyone who clicked that ad that day, so nothing here can point to a person. No cookies.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue={start ?? 'tag'}>
          <TabsList><TabsTrigger value="tag">Browser tag</TabsTrigger><TabsTrigger value="server">Conversions API</TabsTrigger></TabsList>
          <TabsContent value="tag" className="grid gap-3 pt-3 text-sm">
            <p>1. Put this on every page of your site, just before <code className="font-mono text-xs">&lt;/body&gt;</code>. It counts a page view when someone arrives from an ad.</p>
            <Code code={`<script src="${base}/s/isoteh-events.js" async></script>`} />
            <p>2. On your thank-you page, or when someone signs up, add one line:</p>
            <Code code={`<script>\n  window.isoteh = window.isoteh || function () { (isoteh.q = isoteh.q || []).push(arguments) };\n  isoteh('purchase', { value: 24.00, currency: 'USD' });   // or isoteh('sign_up')\n</script>`} />
            <p className="text-muted-foreground">Event names are yours: purchase, sign_up, lead, add_to_cart or any lower-case word. The tag keeps the reference only for that browser tab, and forgets it when the tab closes.</p>
          </TabsContent>
          <TabsContent value="server" className="grid gap-3 pt-3 text-sm">
            <p>Send events from your own server with your organization key (Settings, Organization). Pass on the <code className="font-mono text-xs">isoteh_ref</code> from the landing page’s address if you have it, and we count the event against that ad.</p>
            <Code code={`curl ${base}/v1/events \\\n  -H "Authorization: Bearer isk_…" \\\n  -H "content-type: application/json" \\\n  -d '{"event":"purchase","value":2400,"currency":"USD","ref":"<isoteh_ref>"}'`} />
            <p className="text-muted-foreground">value is in cents (or the smallest unit of the currency). Never send names, emails or phone numbers; we don’t accept them and don’t need them.</p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export function Events() {
  const [params] = useSearchParams();
  const { site } = useApp();
  const [by, setBy] = React.useState<'day' | 'hour'>('day');
  const [days, setDays] = React.useState<number | 'custom'>(30);
  const [custom, setCustom] = React.useState<Range>({ from: iso(Date.now() - 29 * 86_400_000), to: iso(Date.now()), label: 'Custom' });
  const [data, setData] = React.useState<any>(null);
  const [setup, setSetup] = React.useState<false | string>(params.get('setup') ? 'tag' : false);
  React.useEffect(() => {
    const qs = days === 'custom' ? `from=${custom.from}&to=${custom.to}` : `days=${by === 'hour' ? Math.min(days, 7) : days}`;
    api(`/v1/events?${qs}&by=${by}`).then(setData).catch(() => setData(null));
  }, [by, days, custom]);
  const series = React.useMemo(() => {
    if (!data) return [];
    const m = new Map<string, any>();
    for (const r of data.rows) { const o = m.get(r.k) ?? { k: r.k }; o[r.name] = (o[r.name] ?? 0) + r.n; m.set(r.k, o); }
    if (by === 'day') for (const r of data.clicks) { const o = m.get(r.k) ?? { k: r.k }; o.clicks = r.n; m.set(r.k, o); }
    return [...m.values()].sort((a, b) => a.k.localeCompare(b.k));
  }, [data, by]);
  const total = (k: string) => k === 'clicks' ? (data?.clicks ?? []).reduce((s: number, r: any) => s + r.n, 0) : (data?.rows ?? []).filter((r: any) => r.name === k).reduce((s: number, r: any) => s + r.n, 0);
  const names: string[] = [...new Set<string>((data?.rows ?? []).map((r: any) => r.name as string))];
  const has = (data?.rows?.length ?? 0) > 0;
  const src = data?.sources ?? {};
  const status = (k: string) => src[k] ? <Badge variant="outline" className="border-brand/40 bg-brand-soft font-normal text-brand">Last event {when(src[k])}</Badge> : <Badge variant="outline" className="font-normal text-muted-foreground">No data yet</Badge>;
  const seg = (on: boolean) => cn('h-8 rounded-md px-3 text-sm transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none', on && 'bg-background font-medium shadow-xs ring-1 ring-border');
  return (
    <Page>
      <PageHeader title="Events Manager" actions={<Button variant="outline" onClick={() => setSetup('tag')}>Set up tracking</Button>}>
        <button type="button" onClick={() => setSetup('tag')} className="mt-1 inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline">How it works<IconExternalLink className="size-3.5" /></button>
      </PageHeader>
      <h2 className="mb-3 font-medium">Connection status</h2>
      <div className="grid overflow-hidden rounded-xl border bg-card shadow-xs md:grid-cols-2">
        {[['tag', 'Browser tag', 'A small script on your site. Counts visits and sales after a click, with no cookies.'], ['server', 'Conversions API', 'Your server sends events with your organization key.']].map(([k, t, tip], i) => (
          <div key={k} className={cn('flex flex-wrap items-center gap-2 px-4 py-3.5', i && 'border-t md:border-t-0 md:border-l')}>
            <span className="font-medium">{t}</span>
            <Tooltip><TooltipTrigger asChild><button type="button" aria-label={`About ${t}`} className="text-muted-foreground"><IconInfoCircle className="size-4" /></button></TooltipTrigger><TooltipContent className="max-w-60">{tip}</TooltipContent></Tooltip>
            <span className="ml-auto flex items-center gap-2"><Button variant="link" size="sm" className="h-auto px-1 text-foreground" onClick={() => setSetup(k)}>Set up<IconExternalLink className="size-3.5" /></Button>{status(k)}</span>
          </div>
        ))}
      </div>

      <section className="mt-6 rounded-xl border bg-card p-4 shadow-xs sm:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto font-medium">Event Analytics</h2>
          <div className="flex rounded-lg bg-muted p-0.5">{(['day', 'hour'] as const).map((b) => <button key={b} type="button" className={seg(by === b)} onClick={() => setBy(b)}>{b === 'day' ? 'Daily' : 'Hourly'}</button>)}</div>
          <div className="flex rounded-lg bg-muted p-0.5">{[7, 14, 30, 90].map((d) => <button key={d} type="button" className={seg(days === d)} onClick={() => setDays(d)} disabled={by === 'hour' && d > 7}>{d}d</button>)}</div>
          <DateRange value={days === 'custom' ? custom : { ...custom, label: 'Custom' }} onChange={(r) => { setCustom({ ...r, label: r.label }); setDays('custom'); }} className="h-9" />
        </div>
        <div className="relative h-[300px]">
          {has ? <TrendChart data={series} hourly={by === 'hour'} height={300} keys={[...(by === 'day' ? [{ key: 'clicks', label: 'Clicks' }] : []), ...names.slice(0, 4).map((n) => ({ key: n, label: n.replace(/_/g, ' ') }))]} /> : (
            <div className="absolute inset-0"><GhostWave />
              <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                <p className="font-medium">No events recorded yet</p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">Set up {site.brand} tracking to start counting visits, sign-ups and sales from your website, server or app.</p>
                <Button variant="ink" className="mt-4" onClick={() => setSetup('tag')}>Set Up Tracking</Button>
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {CARDS.map(([k, l]) => (
            <div key={k} className={cn('rounded-lg border p-3.5', !has && 'opacity-50')}>
              <p className="text-xs text-muted-foreground">{l}</p>
              <p className="mt-1 text-lg font-semibold tabular">{has || total(k) ? num(total(k)) : '—'}</p>
            </div>
          ))}
        </div>
      </section>
      {(data?.recent?.length ?? 0) > 0 && (
        <section className="mt-6 overflow-hidden rounded-xl border bg-card shadow-xs">
          <h2 className="border-b px-5 py-3.5 font-medium">Recent events</h2>
          <table className="w-full text-sm"><tbody>{data.recent.map((e: any, i: number) => (
            <tr key={i} className="border-b last:border-0"><td className="px-5 py-3 font-medium">{e.name.replace(/_/g, ' ')}</td><td className="px-3 py-3 text-muted-foreground">{e.title || e.sponsor || 'Not from an ad'}</td>
              <td className="px-3 py-3 text-right tabular">{num(e.n)}</td><td className="px-5 py-3 text-right text-muted-foreground tabular">{when(Date.parse(`${e.hour}:00:00Z`))}</td></tr>))}</tbody></table>
        </section>
      )}
      <TrackingDialog open={setup !== false} start={setup || undefined} onOpenChange={(o) => !o && setSetup(false)} />
    </Page>
  );
}
