import * as React from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Field, FormError, useAction } from '@/components/form';
import { api, toMinor, money, fileToB64 } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { toast } from 'sonner';

const Cur = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const { site } = useApp();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full" aria-label="Currency"><SelectValue /></SelectTrigger>
      <SelectContent>{(site.currencies ?? ['USD']).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
    </Select>
  );
};

export function CampaignDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: (c: any, next: boolean) => void }) {
  const [kind, setKind] = React.useState<'network' | 'direct'>('network');
  const [f, setF] = React.useState({ name: '', currency: 'USD', budget: '', cpm: '5', daily_views: '', starts: '', ends: '', keywords: '', countries: '' });
  const { busy, error, setError, run } = useAction();
  React.useEffect(() => { if (open) { setError(null); setKind('network'); setF({ name: '', currency: 'USD', budget: '', cpm: '5', daily_views: '', starts: '', ends: '', keywords: '', countries: '' }); } }, [open, setError]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const views = Number(f.budget) && Number(f.cpm) ? Math.floor((Number(f.budget) / Number(f.cpm)) * 1000) : 0;
  async function save(next: boolean) {
    let made: any;
    const ok = await run(async () => {
      const body = kind === 'direct' ? { name: f.name, currency: f.currency } : {
        name: f.name, currency: f.currency, budget: toMinor(f.budget, f.currency), cpm: toMinor(f.cpm, f.currency), daily_views: Number(f.daily_views) || 0,
        starts: f.starts ? Date.parse(`${f.starts}T00:00:00Z`) : undefined, ends: f.ends ? Date.parse(`${f.ends}T23:59:59Z`) : undefined, keywords: f.keywords, countries: f.countries };
      if (kind === 'network' && (!body.budget || !body.cpm)) throw new Error('Set a budget and a price per 1,000 views');
      made = (await api('/v1/campaigns', body)).campaign;
    });
    if (ok) { toast.success('Campaign saved as a draft'); onDone(made, next); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>New campaign</DialogTitle><DialogDescription>A campaign holds your budget. Ad groups pick the audience, and ads are what people see.</DialogDescription></DialogHeader>
        <form className="grid gap-5" onSubmit={(e) => { e.preventDefault(); save(true); }}>
          <Field label="Campaign name" htmlFor="c-name"><Input id="c-name" autoFocus value={f.name} onChange={set('name')} placeholder="Autumn launch" maxLength={80} /></Field>
          <RadioGroup value={kind} onValueChange={(v) => setKind(v as 'network' | 'direct')} className="grid gap-2 sm:grid-cols-2">
            {[['network', 'Pay per view', 'Runs across blogs, newsletters, games and apps that fit your audience. You pay for ads that were actually seen.'],
              ['direct', 'Direct bookings', 'Book one place for set dates or posts. The price is the owner’s, paid up front.']].map(([v, t, d]) => (
              <Label key={v} htmlFor={`k-${v}`} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 font-normal has-[[data-state=checked]]:border-brand has-[[data-state=checked]]:bg-brand-soft/50">
                <RadioGroupItem value={v} id={`k-${v}`} className="mt-0.5" /><span className="grid gap-1"><span className="font-medium">{t}</span><span className="text-xs leading-relaxed text-muted-foreground">{d}</span></span>
              </Label>
            ))}
          </RadioGroup>
          {kind === 'network' ? <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Currency"><Cur value={f.currency} onChange={(v) => setF({ ...f, currency: v })} /></Field>
              <Field label="Total budget" htmlFor="c-budget"><Input id="c-budget" inputMode="decimal" value={f.budget} onChange={set('budget')} placeholder="500" /></Field>
              <Field label="Price per 1,000 views" htmlFor="c-cpm"><Input id="c-cpm" inputMode="decimal" value={f.cpm} onChange={set('cpm')} /></Field>
            </div>
            {views > 0 && <p className="-mt-2 text-sm text-muted-foreground">About {new Intl.NumberFormat().format(views)} views for {money(toMinor(f.budget, f.currency), f.currency)}. A view counts only when half the ad was on screen for a second.</p>}
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Starts" htmlFor="c-starts" hint="Optional"><Input id="c-starts" type="date" value={f.starts} onChange={set('starts')} /></Field>
              <Field label="Ends" htmlFor="c-ends" hint="Optional"><Input id="c-ends" type="date" value={f.ends} min={f.starts} onChange={set('ends')} /></Field>
              <Field label="Most views a day" htmlFor="c-daily" hint="Empty for no limit"><Input id="c-daily" type="number" min={0} value={f.daily_views} onChange={set('daily_views')} /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Topics" htmlFor="c-kw" hint="Empty runs on any topic. Ad groups can narrow it with an audience."><Input id="c-kw" value={f.keywords} onChange={set('keywords')} placeholder="coffee, food, austin" /></Field>
              <Field label="Countries" htmlFor="c-co" hint="Two-letter codes. Empty for anywhere."><Input id="c-co" value={f.countries} onChange={set('countries')} placeholder="US, CA" /></Field>
            </div>
          </> : <>
            <Field label="Currency"><Cur value={f.currency} onChange={(v) => setF({ ...f, currency: v })} /></Field>
            <p className="text-sm text-muted-foreground">Save it, add an ad, then pick a place in <Link to="/app/find" className="text-foreground underline underline-offset-4" onClick={() => onOpenChange(false)}>Find ad space</Link>.</p>
          </>}
          <FormError error={error} />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" disabled={busy || !f.name.trim()} onClick={() => save(false)}>Save as draft</Button>
            <Button type="submit" disabled={busy || !f.name.trim()}>{busy ? 'Saving…' : 'Save and add an ad group'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function GroupDialog({ open, onOpenChange, onDone, campaigns, campaignId }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: (g: any, next: boolean) => void; campaigns: any[]; campaignId?: string }) {
  const [audiences, setAudiences] = React.useState<any[]>([]);
  const [f, setF] = React.useState({ campaign_id: '', name: '', audience_id: 'none' });
  const { busy, error, setError, run } = useAction();
  React.useEffect(() => {
    if (!open) return;
    setError(null); setF({ campaign_id: campaignId ?? campaigns[0]?.id ?? '', name: '', audience_id: 'none' });
    api('/v1/audiences').then((r) => setAudiences(r.audiences)).catch(() => setAudiences([]));
  }, [open, campaignId, campaigns, setError]);
  async function save(next: boolean) {
    let g: any;
    if (await run(async () => { g = (await api('/v1/groups', { campaign_id: f.campaign_id, name: f.name, audience_id: f.audience_id === 'none' ? null : f.audience_id })).group; })) { toast.success('Ad group made'); onDone(g, next); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New ad group</DialogTitle><DialogDescription>Ads in a group share one audience: the kinds of places they may show on.</DialogDescription></DialogHeader>
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save(true); }}>
          <Field label="Campaign">
            <Select value={f.campaign_id} onValueChange={(v) => setF({ ...f, campaign_id: v })}>
              <SelectTrigger className="w-full" aria-label="Campaign"><SelectValue placeholder="Pick a campaign" /></SelectTrigger>
              <SelectContent>{campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Ad group name" htmlFor="g-name"><Input id="g-name" autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Food blogs in Texas" maxLength={80} /></Field>
          <Field label="Audience" hint={<>Make audiences in <Link to="/app/audiences" className="underline underline-offset-4" onClick={() => onOpenChange(false)}>Audiences</Link>.</>}>
            <Select value={f.audience_id} onValueChange={(v) => setF({ ...f, audience_id: v })}>
              <SelectTrigger className="w-full" aria-label="Audience"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">Everyone in the network</SelectItem>{audiences.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <FormError error={error} />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" disabled={busy || !f.name.trim() || !f.campaign_id} onClick={() => save(false)}>Save</Button>
            <Button type="submit" disabled={busy || !f.name.trim() || !f.campaign_id}>Save and add an ad</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdPreview({ kind, sponsor, title, body, cta, image }: { kind: string; sponsor: string; title: string; body: string; cta: string; image: string }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      {kind === 'image' ? (
        <div className="relative aspect-[6/5] bg-muted">
          {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">Your image shows here</div>}
          <span className="absolute top-2 left-2 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium">Sponsored</span>
        </div>
      ) : (
        <div className="flex gap-3 p-3">
          {image && <img src={image} alt="" className="size-16 shrink-0 rounded-md object-cover" />}
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground">Sponsored · {sponsor || 'Your brand'}</p>
            <p className="font-medium leading-snug">{title || 'Your headline'}</p>
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{body || 'One or two lines about what you offer.'}</p>
            <span className="mt-2 inline-block rounded-md bg-ink px-2.5 py-1 text-xs font-medium text-ink-foreground">{cta || 'Learn more'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdDialog({ open, onOpenChange, onDone, campaigns, groups, campaignId, groupId }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void; campaigns: any[]; groups: any[]; campaignId?: string; groupId?: string }) {
  const { ws } = useApp();
  const blank = { campaign_id: '', group_id: 'none', kind: 'image', sponsor: '', title: '', body: '', cta: '', url: '' };
  const [f, setF] = React.useState(blank);
  const [file, setFile] = React.useState<File | null>(null);
  const [img, setImg] = React.useState('');
  const { busy, error, setError, run } = useAction();
  const [reading, setReading] = React.useState(false);
  React.useEffect(() => {
    if (!open) return;
    setError(null); setFile(null); setImg('');
    setF({ ...blank, campaign_id: campaignId ?? campaigns[0]?.id ?? 'new', group_id: groupId ?? 'none', sponsor: ws.org.kind === 'org' ? ws.org.name : '', url: ws.org.website ? `${ws.org.website}/` : '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  React.useEffect(() => { if (!file) return; const u = URL.createObjectURL(file); setImg(u); return () => URL.revokeObjectURL(u); }, [file]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const myGroups = groups.filter((g) => g.campaign_id === f.campaign_id);
  async function fill() {
    if (!f.url) return;
    setReading(true);
    try { const { ad } = await api(`/v1/preview?url=${encodeURIComponent(f.url)}`); setF((x) => ({ ...x, sponsor: x.sponsor || ad.name, title: x.title || ad.name, body: x.body || ad.line })); if (ad.image && !file) setImg(ad.image); toast.success('Filled in from your website'); }
    catch (e: any) { toast.error(e.message); } finally { setReading(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>New ad</DialogTitle><DialogDescription>Images or plain text only. Every ad is labelled Sponsored and checked by our team before it runs.</DialogDescription></DialogHeader>
        <form className="grid gap-6 md:grid-cols-[1fr_260px]" onSubmit={async (e) => {
          e.preventDefault();
          if (await run(async () => {
            let cid = f.campaign_id;
            if (cid === 'new' || !cid) cid = (await api('/v1/campaigns', { name: `${f.sponsor || 'My'} ads`, currency: 'USD' })).campaign.id;
            if (f.kind === 'image' && !file) throw new Error('Add an image');
            await api('/v1/ads', { campaign_id: cid, group_id: f.group_id === 'none' ? undefined : f.group_id, kind: f.kind, sponsor: f.sponsor, title: f.title, body: f.kind === 'native' ? f.body : '', cta: f.kind === 'native' ? f.cta : '', url: f.url, image: file ? await fileToB64(file) : undefined });
          })) { toast.success('Ad saved. We check it before it runs, usually within a day.'); onDone(); }
        }}>
          <div className="grid content-start gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Campaign">
                <Select value={f.campaign_id} onValueChange={(v) => setF({ ...f, campaign_id: v, group_id: 'none' })}>
                  <SelectTrigger className="w-full" aria-label="Campaign"><SelectValue /></SelectTrigger>
                  <SelectContent>{campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}<SelectItem value="new">A new campaign</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Ad group">
                <Select value={f.group_id} onValueChange={(v) => setF({ ...f, group_id: v })}>
                  <SelectTrigger className="w-full" aria-label="Ad group"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">No group</SelectItem>{myGroups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Kind of ad">
              <Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v })}>
                <SelectTrigger className="w-full" aria-label="Kind of ad"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="image">Image: banners, newsletter blocks, game billboards</SelectItem><SelectItem value="native">Native card: headline, text and a small picture</SelectItem></SelectContent>
              </Select>
            </Field>
            <Field label="Link" htmlFor="ad-url" hint="Where a click goes. We add a reference so you can count sales; it names the ad, never the person.">
              <div className="flex gap-2"><Input id="ad-url" value={f.url} onChange={set('url')} placeholder="https://yourbrand.com/" /><Button type="button" variant="outline" disabled={!f.url || reading} onClick={fill}>{reading ? 'Reading…' : 'Fill from site'}</Button></div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Sponsor name" htmlFor="ad-sp"><Input id="ad-sp" value={f.sponsor} onChange={set('sponsor')} maxLength={60} /></Field>
              <Field label="Headline" htmlFor="ad-t" hint={f.kind === 'image' ? 'Optional' : undefined}><Input id="ad-t" value={f.title} onChange={set('title')} maxLength={80} /></Field>
            </div>
            {f.kind === 'native' && <>
              <Field label="Text" htmlFor="ad-b"><Textarea id="ad-b" rows={2} value={f.body} onChange={set('body')} maxLength={220} /></Field>
              <Field label="Button word" htmlFor="ad-c"><Input id="ad-c" value={f.cta} onChange={set('cta')} maxLength={24} placeholder="Order now" /></Field>
            </>}
            <Field label="Image" htmlFor="ad-img" hint="PNG, JPEG, WebP or GIF under 1.5 MB. Common sizes: 300×250, 728×90, 600×200 for newsletters.">
              <Input id="ad-img" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </Field>
            <FormError error={error} />
          </div>
          <div className="grid content-start gap-3">
            <p className="text-sm font-medium">Preview</p>
            <AdPreview kind={f.kind} sponsor={f.sponsor} title={f.title} body={f.body} cta={f.cta} image={img} />
            <Button type="submit" className="mt-2" disabled={busy || !f.sponsor || !f.url}>{busy ? 'Saving…' : 'Save ad'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
