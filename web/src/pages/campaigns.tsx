import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { IconPlus, IconChevronDown, IconSearch, IconFilter, IconDownload, IconPlayerPlay, IconPlayerPause, IconPlayerStop, IconDots, IconX } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Page, PageHeader, GhostRows } from '@/components/page';
import { DateRange, preset, type Range } from '@/components/date-range';
import { api, money, num, pct, downloadCsv, day, type Totals } from '@/lib/api';
import { StatusBadge } from './dashboard';
import { CampaignDialog, GroupDialog, AdDialog } from './campaign-dialogs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type All = { from: string; to: string; currency: string; campaigns: any[]; groups: any[]; ads: any[]; by: { ad: Record<string, Totals>; group: Record<string, Totals>; campaign: Record<string, Totals> } };
const Z: Totals = { spend: 0, views: 0, clicks: 0, serves: 0, conversions: 0, value: 0 };
const REVIEW: Record<string, string> = { pending: 'Being checked', approved: 'Approved', rejected: 'Not approved' };

export function Campaigns() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = React.useState(params.get('tab') ?? 'campaigns');
  const [range, setRange] = React.useState<Range>(() => preset('This month'));
  const [all, setAll] = React.useState<All | null>(null);
  const [search, setSearch] = React.useState<string | null>(null);
  const [statuses, setStatuses] = React.useState<string[]>([]);
  const [dialog, setDialog] = React.useState<null | 'campaign' | 'group' | 'ad'>(null);
  const [dialogFor, setDialogFor] = React.useState<{ campaign_id?: string; group_id?: string }>({});
  const load = React.useCallback(() => api<All>(`/v1/ads/all?from=${range.from}&to=${range.to}`).then(setAll).catch((e) => toast.error(e.message)), [range]);
  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => {
    const c = params.get('create');
    if (c === 'campaign' || c === 'group' || c === 'ad') { setDialog(c); params.delete('create'); setParams(params, { replace: true }); }
  }, [params, setParams]);
  const open = (k: 'campaign' | 'group' | 'ad', f: { campaign_id?: string; group_id?: string } = {}) => { setDialogFor(f); setDialog(k); };

  const cf = params.get('c');
  const q = (search ?? '').toLowerCase();
  const camps = (all?.campaigns ?? []).filter((c) => (!cf || c.id === cf) && (!q || c.name.toLowerCase().includes(q)) && (!statuses.length || statuses.includes(c.status)));
  const campName = (id: string) => all?.campaigns.find((c) => c.id === id)?.name ?? '';
  const campCur = (id: string) => all?.campaigns.find((c) => c.id === id)?.currency ?? all?.currency ?? 'USD';
  const groups = (all?.groups ?? []).filter((g) => (!cf || g.campaign_id === cf) && (!q || g.name.toLowerCase().includes(q) || campName(g.campaign_id).toLowerCase().includes(q)) && (!statuses.length || statuses.includes(g.status)));
  const ads = (all?.ads ?? []).filter((a) => (!cf || a.campaign_id === cf) && (!q || `${a.sponsor} ${a.title} ${campName(a.campaign_id)}`.toLowerCase().includes(q)) && (!statuses.length || statuses.includes(a.review)));
  const groupName = (id: string) => all?.groups.find((g) => g.id === id)?.name ?? '';
  const rows = tab === 'campaigns' ? camps : tab === 'groups' ? groups : ads;
  const statusOptions = tab === 'ads' ? Object.entries(REVIEW) : Object.entries({ draft: 'Draft', active: 'Running', paused: 'Paused', ended: 'Ended' }).filter(([k]) => tab === 'campaigns' || ['active', 'paused'].includes(k));

  async function setStatus(c: any, status: string) {
    try { await api(`/v1/campaigns/${c.id}`, { status }, 'PATCH'); toast.success(status === 'active' ? 'Campaign started' : status === 'paused' ? 'Paused' : 'Ended; unspent budget is back in your credit'); load(); }
    catch (e: any) { toast.error(e.message, e.message.match(/credit|balance/i) ? { action: { label: 'Add credit', onClick: () => nav('/app/settings?tab=billing') } } : undefined); }
  }
  async function setGroup(g: any, status: string) { try { await api(`/v1/groups/${g.id}`, { status }, 'PATCH'); load(); } catch (e: any) { toast.error(e.message); } }

  function exportCsv() {
    if (!all) return;
    const m = (x?: Totals) => { const t = x ?? Z; return [t.views, t.clicks, t.views ? ((t.clicks / t.views) * 100).toFixed(2) : '', t.conversions]; };
    const cur = (minor: number, c: string) => (minor / 100).toFixed(2) + ` ${c}`;
    const out: (string | number)[][] = tab === 'campaigns'
      ? [['Campaign', 'Status', 'Kind', 'Budget', 'Spend', 'Impressions', 'Clicks', 'CTR %', 'Conversions'], ...camps.map((c) => [c.name, c.status, c.cpm ? 'Pay per view' : 'Direct bookings', c.cpm ? cur(c.budget, c.currency) : '', cur(all.by.campaign[c.id]?.spend ?? 0, c.currency), ...m(all.by.campaign[c.id])])]
      : tab === 'groups'
        ? [['Ad group', 'Campaign', 'Audience', 'Status', 'Spend', 'Impressions', 'Clicks', 'CTR %', 'Conversions'], ...groups.map((g) => [g.name, campName(g.campaign_id), g.audience ?? 'Everyone', g.status, cur(all.by.group[g.id]?.spend ?? 0, campCur(g.campaign_id)), ...m(all.by.group[g.id])])]
        : [['Ad', 'Sponsor', 'Campaign', 'Ad group', 'Review', 'Link', 'Impressions', 'Clicks', 'CTR %', 'Conversions'], ...ads.map((a) => [a.title || '(image)', a.sponsor, campName(a.campaign_id), groupName(a.group_id), a.review, a.url, ...m(all.by.ad[a.id])])];
    downloadCsv(`isoteh-${tab}-${range.from}-to-${range.to}.csv`, out);
  }

  const th = 'px-3 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap';
  const td = 'px-3 py-3 whitespace-nowrap';
  const metricsCells = (x: Totals | undefined, cur: string) => { const t = x ?? Z; return (<>
    <td className={cn(td, 'text-right tabular')}>{money(t.spend, cur)}</td><td className={cn(td, 'text-right tabular')}>{num(t.views)}</td>
    <td className={cn(td, 'text-right tabular')}>{num(t.clicks)}</td><td className={cn(td, 'text-right tabular hidden md:table-cell')}>{pct(t.clicks, t.views)}</td>
    <td className={cn(td, 'text-right tabular hidden md:table-cell')}>{num(t.conversions)}</td></>); };
  const metricHeads = <><th className={cn(th, 'text-right')}>Spend</th><th className={cn(th, 'text-right')}>Impressions</th><th className={cn(th, 'text-right')}>Clicks</th><th className={cn(th, 'text-right hidden md:table-cell')}>CTR</th><th className={cn(th, 'text-right hidden md:table-cell')}>Conversions</th></>;

  return (
    <Page>
      <PageHeader title="Campaigns" actions={<>
        {search === null
          ? <Button variant="ghost" size="icon" aria-label="Search" onClick={() => setSearch('')}><IconSearch /></Button>
          : <div className="relative"><Input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="w-44 pr-8 sm:w-56" aria-label="Search" />
              <button type="button" aria-label="Close search" className="absolute top-2.5 right-2 text-muted-foreground" onClick={() => setSearch(null)}><IconX className="size-4" /></button></div>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button><IconPlus />Create<IconChevronDown className="opacity-80" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem onSelect={() => open('campaign')} className="flex-col items-start gap-0.5"><span className="font-medium">Campaign</span><span className="text-xs text-muted-foreground">A budget that runs across the network</span></DropdownMenuItem>
            <DropdownMenuItem onSelect={() => open('group')} disabled={!all?.campaigns.length} className="flex-col items-start gap-0.5"><span className="font-medium">Ad group</span><span className="text-xs text-muted-foreground">Ads that share an audience</span></DropdownMenuItem>
            <DropdownMenuItem onSelect={() => open('ad')} className="flex-col items-start gap-0.5"><span className="font-medium">Ad</span><span className="text-xs text-muted-foreground">An image or a native card</span></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => nav('/app/find')} className="flex-col items-start gap-0.5"><span className="font-medium">Book ad space</span><span className="text-xs text-muted-foreground">A blog, newsletter, game or creator, for set dates</span></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>} />

      <div className="-mt-2 mb-0 flex flex-wrap items-center justify-between gap-2 border-b">
        <Tabs value={tab} onValueChange={(v) => { setTab(v); setStatuses([]); }}>
          <TabsList className="h-auto gap-4 rounded-none bg-transparent p-0">
            {[['campaigns', 'Campaigns'], ['groups', 'Ad groups'], ['ads', 'Ads']].map(([k, l]) => (
              <TabsTrigger key={k} value={k} className="rounded-none border-0 border-b-2 border-transparent px-0 pt-1 pb-3 text-muted-foreground shadow-none data-[state=active]:border-ink data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent">{l}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-1 pb-2">
          {cf && <Button variant="secondary" size="sm" onClick={() => { params.delete('c'); setParams(params); }}>{campName(cf)}<IconX /></Button>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><IconFilter />Filter{statuses.length ? ` (${statuses.length})` : ''}</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{tab === 'ads' ? 'Review' : 'Status'}</DropdownMenuLabel>
              {statusOptions.map(([k, l]) => <DropdownMenuCheckboxItem key={k} checked={statuses.includes(k)} onCheckedChange={(on) => setStatuses(on ? [...statuses, k] : statuses.filter((x) => x !== k))} onSelect={(e) => e.preventDefault()}>{l}</DropdownMenuCheckboxItem>)}
              {statuses.length > 0 && <><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => setStatuses([])}>Clear</DropdownMenuItem></>}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="sm" disabled={!rows.length} onClick={exportCsv}><IconDownload />Export CSV</Button>
          <DateRange value={range} onChange={setRange} className="h-8" />
        </div>
      </div>
      <p className="px-1 pt-4 pb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{tab === 'campaigns' ? 'Campaigns' : tab === 'groups' ? 'Ad groups' : 'Ads'}</p>

      {!all ? <GhostRows /> : !rows.length ? (
        <div className="relative"><GhostRows />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            {q || statuses.length || cf ? <p className="font-medium">Nothing matches</p> : tab === 'campaigns' ? <>
              <p className="font-medium">Create your first campaign</p><p className="mt-1 text-sm text-muted-foreground">Launch a campaign to start reaching readers, players and viewers.</p>
              <Button variant="ink" className="mt-4" onClick={() => open('campaign')}><IconPlus />Create campaign</Button></> : tab === 'groups' ? <>
              <p className="font-medium">No ad groups yet</p><p className="mt-1 text-sm text-muted-foreground">An ad group keeps ads together that share one audience.</p>
              <Button variant="ink" className="mt-4" disabled={!all.campaigns.length} onClick={() => open('group')}><IconPlus />Create ad group</Button></> : <>
              <p className="font-medium">No ads yet</p><p className="mt-1 text-sm text-muted-foreground">Make an image ad or a native card. Our team checks each one before it runs.</p>
              <Button variant="ink" className="mt-4" onClick={() => open('ad')}><IconPlus />Create ad</Button></>}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
          <table className="w-full text-sm">
            {tab === 'campaigns' && <>
              <thead><tr className="border-b text-left"><th className={cn(th, 'pl-5')}>Name</th><th className={th}>Status</th><th className={cn(th, 'text-right hidden lg:table-cell')}>Budget</th>{metricHeads}<th className={th}><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>{camps.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-accent/40">
                  <td className={cn(td, 'pl-5')}><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.cpm ? `${money(c.cpm, c.currency)} per 1,000 views` : 'Direct bookings'}{c.starts ? ` · from ${day(c.starts)}` : ''}</div></td>
                  <td className={td}><StatusBadge status={c.status} /></td>
                  <td className={cn(td, 'text-right tabular hidden lg:table-cell')}>{c.cpm ? <>{money(c.budget, c.currency)}<div className="text-xs text-muted-foreground">{money(c.spent, c.currency)} used</div></> : '—'}</td>
                  {metricsCells(all.by.campaign[c.id], c.currency)}
                  <td className={cn(td, 'pr-3 text-right')}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.name}`}><IconDots /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!!c.cpm && c.status !== 'active' && c.status !== 'ended' && <DropdownMenuItem onSelect={() => setStatus(c, 'active')}><IconPlayerPlay />Start</DropdownMenuItem>}
                        {!!c.cpm && c.status === 'active' && <DropdownMenuItem onSelect={() => setStatus(c, 'paused')}><IconPlayerPause />Pause</DropdownMenuItem>}
                        <DropdownMenuItem onSelect={() => open('group', { campaign_id: c.id })}><IconPlus />Add ad group</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => open('ad', { campaign_id: c.id })}><IconPlus />Add ad</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => { setTab('ads'); params.set('c', c.id); setParams(params); }}>See its ads</DropdownMenuItem>
                        {!!c.cpm && c.status !== 'ended' && <><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={() => setStatus(c, 'ended')}><IconPlayerStop />End and return budget</DropdownMenuItem></>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>))}</tbody></>}
            {tab === 'groups' && <>
              <thead><tr className="border-b text-left"><th className={cn(th, 'pl-5')}>Ad group</th><th className={th}>Audience</th><th className={th}>Status</th>{metricHeads}<th className={th}><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>{groups.map((g) => (
                <tr key={g.id} className="border-b last:border-0 hover:bg-accent/40">
                  <td className={cn(td, 'pl-5')}><div className="font-medium">{g.name}</div><div className="text-xs text-muted-foreground">{campName(g.campaign_id)}</div></td>
                  <td className={td}>{g.audience ?? <span className="text-muted-foreground">Everyone in the network</span>}</td>
                  <td className={td}><StatusBadge status={g.status} /></td>
                  {metricsCells(all.by.group[g.id], campCur(g.campaign_id))}
                  <td className={cn(td, 'pr-3 text-right')}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${g.name}`}><IconDots /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {g.status === 'active' ? <DropdownMenuItem onSelect={() => setGroup(g, 'paused')}><IconPlayerPause />Pause</DropdownMenuItem> : <DropdownMenuItem onSelect={() => setGroup(g, 'active')}><IconPlayerPlay />Resume</DropdownMenuItem>}
                        <DropdownMenuItem onSelect={() => open('ad', { campaign_id: g.campaign_id, group_id: g.id })}><IconPlus />Add ad</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>))}</tbody></>}
            {tab === 'ads' && <>
              <thead><tr className="border-b text-left"><th className={cn(th, 'pl-5')}>Ad</th><th className={th}>Review</th><th className={cn(th, 'text-right')}>Impressions</th><th className={cn(th, 'text-right')}>Clicks</th><th className={cn(th, 'text-right hidden md:table-cell')}>CTR</th><th className={cn(th, 'text-right hidden md:table-cell')}>Conversions</th></tr></thead>
              <tbody>{ads.map((a) => { const t = all.by.ad[a.id] ?? Z; return (
                <tr key={a.id} className="border-b last:border-0 hover:bg-accent/40">
                  <td className={cn(td, 'pl-5')}>
                    <div className="flex items-center gap-3">
                      {a.image_url ? <img src={a.image_url} alt="" className="h-10 w-14 rounded-md border object-cover" /> : <div className="flex h-10 w-14 items-center justify-center rounded-md border bg-muted text-[10px] text-muted-foreground">Native</div>}
                      <div className="min-w-0"><div className="max-w-[260px] truncate font-medium">{a.title || a.sponsor}</div><div className="text-xs text-muted-foreground">{campName(a.campaign_id)}{a.group_id ? ` · ${groupName(a.group_id)}` : ''}</div></div>
                    </div>
                  </td>
                  <td className={td}><Badge variant="outline" className={cn('font-normal', a.review === 'approved' && 'border-brand/40 bg-brand-soft text-brand', a.review === 'rejected' && 'border-destructive/40 text-destructive')}>{REVIEW[a.review] ?? a.review}</Badge>{a.review_note && <div className="mt-1 max-w-[220px] truncate text-xs text-muted-foreground" title={a.review_note}>{a.review_note}</div>}</td>
                  <td className={cn(td, 'text-right tabular')}>{num(t.views)}</td><td className={cn(td, 'text-right tabular')}>{num(t.clicks)}</td>
                  <td className={cn(td, 'text-right tabular hidden md:table-cell')}>{pct(t.clicks, t.views)}</td><td className={cn(td, 'text-right tabular hidden md:table-cell')}>{num(t.conversions)}</td>
                </tr>); })}</tbody></>}
          </table>
        </div>
      )}
      <CampaignDialog open={dialog === 'campaign'} onOpenChange={(o) => !o && setDialog(null)} onDone={(c, next) => { load(); if (next) open('group', { campaign_id: c.id }); else setDialog(null); }} />
      <GroupDialog open={dialog === 'group'} campaigns={all?.campaigns ?? []} campaignId={dialogFor.campaign_id} onOpenChange={(o) => !o && setDialog(null)} onDone={(g, next) => { load(); if (next) open('ad', { campaign_id: g.campaign_id, group_id: g.id }); else setDialog(null); }} />
      <AdDialog open={dialog === 'ad'} campaigns={all?.campaigns ?? []} groups={all?.groups ?? []} campaignId={dialogFor.campaign_id} groupId={dialogFor.group_id} onOpenChange={(o) => !o && setDialog(null)} onDone={() => { load(); setDialog(null); setTab('ads'); }} />
    </Page>
  );
}
