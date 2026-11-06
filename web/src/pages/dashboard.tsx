import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconPlus, IconX, IconCheck } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Page, PageHeader, GhostRows } from '@/components/page';
import { DateRange, preset, type Range } from '@/components/date-range';
import { TrendChart, GhostWave } from '@/components/trend-chart';
import { useApp } from '@/lib/app-context';
import { api, money, num, pct, when, type Totals } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PublisherDashboard } from './publisher';

type Overview = { from: string; to: string; currency: string; series: (Totals & { day: string })[]; total: Totals; by: { campaign: Record<string, Totals> } };

export function Dashboard() {
  const { mode } = useApp();
  return mode === 'publisher' ? <PublisherDashboard /> : <AdvertiserDashboard />;
}

export const STATUS: Record<string, string> = { draft: 'Draft', active: 'Running', paused: 'Paused', ended: 'Ended' };
export function StatusBadge({ status }: { status: string }) {
  return <Badge variant="outline" className={cn('font-normal', status === 'active' && 'border-brand/40 bg-brand-soft text-brand')}>{STATUS[status] ?? status}</Badge>;
}

function SetupCard() {
  const { ws, reload } = useApp();
  const nav = useNavigate();
  const s = ws.setup;
  if (ws.org.setup_hidden) return null;
  const steps = [
    { done: s.tracking, label: 'Set up tracking', button: <Button size="sm" variant="ink" onClick={() => nav('/app/events?setup=1')}>Set up</Button> },
    { done: s.payment, label: 'Add a payment method', button: <Button size="sm" variant="outline" onClick={() => nav('/app/settings?tab=billing')}>Add card</Button> },
    { done: s.launched, label: 'Launch your first campaign', button: <Button size="sm" variant="outline" onClick={() => nav('/app/campaigns?create=campaign')}>Create</Button> },
  ];
  const n = steps.filter((x) => x.done).length;
  if (n === 3) return null;
  return (
    <section className="mb-6 rounded-xl border bg-card p-5 shadow-xs">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="flex-1 font-medium">Get set up to run ads</h2>
        <span className="text-sm text-muted-foreground tabular">{n} of 3 complete</span>
        <span className="text-sm text-muted-foreground tabular">{Math.round((n / 3) * 100)}%</span>
        <Button variant="ghost" size="icon-sm" aria-label="Hide" onClick={async () => { await api('/v1/org', { setup_hidden: true }, 'PATCH'); reload(); }}><IconX /></Button>
      </div>
      <div className="mb-4 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand transition-[transform]" style={{ width: `${(n / 3) * 100}%` }} /></div>
      <div className="grid gap-3 md:grid-cols-3">
        {steps.map((x) => (
          <div key={x.label} className="rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <span className={cn('flex size-5 items-center justify-center rounded-full border', x.done && 'border-brand bg-brand text-white')}>{x.done && <IconCheck className="size-3" />}</span>
              <span className={cn('text-sm font-medium', x.done && 'text-muted-foreground line-through')}>{x.label}</span>
            </div>
            {!x.done && <div className="mt-3 pl-8">{x.button}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}

function AdvertiserDashboard() {
  const nav = useNavigate();
  const [range, setRange] = React.useState<Range>(() => preset('Last 30 days'));
  const [ov, setOv] = React.useState<Overview | null>(null);
  const [all, setAll] = React.useState<any>(null);
  const [events, setEvents] = React.useState<any>(null);
  const [metric, setMetric] = React.useState('spend');
  React.useEffect(() => {
    const qs = `from=${range.from}&to=${range.to}`;
    api<Overview>(`/v1/overview?${qs}`).then(setOv).catch(() => setOv(null));
    api(`/v1/ads/all?${qs}`).then(setAll).catch(() => setAll(null));
    api('/v1/events?days=30').then(setEvents).catch(() => setEvents(null));
  }, [range]);
  const t = ov?.total, cur = ov?.currency ?? 'USD';
  const any = !!t && (t.views + t.clicks + t.spend + t.conversions > 0);
  const M = [
    { key: 'spend', label: 'Spend', v: t && money(t.spend, cur), fmt: (v: number) => money(v, cur, true) },
    { key: 'views', label: 'Impressions', v: t && num(t.views) },
    { key: 'clicks', label: 'Clicks', v: t && num(t.clicks) },
    { key: 'cpm', label: 'CPM', v: t && (t.views ? money(Math.round((t.spend / t.views) * 1000), cur) : '—'), fmt: (v: number) => money(v, cur) },
    { key: 'ctr', label: 'CTR', v: t && pct(t.clicks, t.views), fmt: (v: number) => `${v.toFixed(1)}%` },
    { key: 'roas', label: 'ROAS', v: t && (t.spend && t.value ? `${(t.value / t.spend).toFixed(2)}×` : '—'), fmt: (v: number) => `${v.toFixed(1)}×` },
  ];
  const data = (ov?.series ?? []).map((s) => ({ k: s.day, spend: s.spend, views: s.views, clicks: s.clicks, cpm: s.views ? Math.round((s.spend / s.views) * 1000) : 0, ctr: s.views ? (s.clicks / s.views) * 100 : 0, roas: s.spend ? s.value / s.spend : 0 }));
  const m = M.find((x) => x.key === metric)!;
  const camps = (all?.campaigns ?? []).slice(0, 6);
  return (
    <Page>
      <PageHeader title="Dashboard" actions={<Button onClick={() => nav('/app/campaigns?create=campaign')}><IconPlus />Create Campaign</Button>} />
      <SetupCard />
      <section className="rounded-xl border bg-card shadow-xs">
        <div className="flex flex-wrap items-center justify-end gap-2 border-b px-4 py-3"><DateRange value={range} onChange={setRange} /></div>
        <div role="tablist" aria-label="Pick a number to chart" className="grid grid-cols-2 border-b sm:grid-cols-3 lg:grid-cols-6">
          {M.map((x) => (
            <button key={x.key} role="tab" aria-selected={metric === x.key} type="button" onClick={() => setMetric(x.key)}
              className={cn('relative px-5 py-4 text-left transition-colors hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none', metric === x.key && 'bg-accent/40')}>
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{x.label}</span>
              <span className="mt-1 block text-xl font-semibold tracking-tight tabular">{any ? x.v : '——'}</span>
              {metric === x.key && <span className="absolute inset-x-5 bottom-0 h-0.5 rounded-full bg-brand" />}
            </button>
          ))}
        </div>
        <div className="relative h-[300px] px-2 pt-4 pb-2">
          {any ? <TrendChart data={data} keys={[{ key: metric, label: m.label }]} format={m.fmt} height={280} /> : (
            <div className="absolute inset-x-4 bottom-2 top-16"><GhostWave />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center"><p className="font-medium">No numbers yet</p><p className="mt-1 max-w-sm text-sm text-muted-foreground">They show up here once your first ad runs.</p></div>
            </div>
          )}
        </div>
      </section>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
          <div className="flex items-center border-b px-5 py-3.5"><h2 className="flex-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Campaigns</h2>{camps.length > 0 && <Link to="/app/campaigns" className="text-sm underline-offset-4 hover:underline">See all</Link>}</div>
          {camps.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="px-5 py-2.5 font-medium">Name</th><th className="px-3 py-2.5 font-medium">Status</th><th className="px-3 py-2.5 text-right font-medium">Spend</th><th className="px-3 py-2.5 text-right font-medium">Impr.</th><th className="px-5 py-2.5 text-right font-medium">Clicks</th></tr></thead>
                <tbody>{camps.map((c: any) => { const x = all.by.campaign[c.id] ?? {}; return (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-accent/40"><td className="px-5 py-3 font-medium"><Link to={`/app/campaigns?c=${c.id}`} className="hover:underline">{c.name}</Link></td><td className="px-3 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-3 py-3 text-right tabular">{money(x.spend ?? 0, c.currency)}</td><td className="px-3 py-3 text-right tabular">{num(x.views ?? 0)}</td><td className="px-5 py-3 text-right tabular">{num(x.clicks ?? 0)}</td></tr>); })}</tbody>
              </table>
            </div>
          ) : (
            <div className="relative"><GhostRows rows={4} />
              <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"><p className="font-medium">Create your first campaign</p><p className="mt-1 text-sm text-muted-foreground">Launch a campaign to start reaching readers, players and viewers.</p>
                <Button variant="ink" className="mt-4" onClick={() => nav('/app/campaigns?create=campaign')}><IconPlus />Create campaign</Button></div></div>
          )}
        </section>
        <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
          <div className="flex items-center border-b px-5 py-3.5"><h2 className="flex-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Event activity</h2><Link to="/app/events" className="text-sm underline-offset-4 hover:underline">Events Manager</Link></div>
          {events?.recent?.length ? (
            <ul className="divide-y">{events.recent.slice(0, 7).map((e: any, i: number) => (
              <li key={i} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="flex-1 truncate"><span className="font-medium">{e.name.replace(/_/g, ' ')}</span>{e.sponsor && <span className="text-muted-foreground"> from {e.title || e.sponsor}</span>}</span>
                <span className="text-xs text-muted-foreground tabular">{e.n > 1 ? `${num(e.n)} · ` : ''}{when(Date.parse(`${e.hour}:00:00Z`))}</span>
              </li>))}</ul>
          ) : <div className="px-5 py-10 text-center text-sm text-muted-foreground">——<p className="mt-2">Sales and sign-ups after a click show up here once tracking is set up.</p></div>}
        </section>
      </div>
    </Page>
  );
}
