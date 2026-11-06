import * as React from 'react';
import { IconPlus, IconUsers, IconTrash, IconFileUpload, IconX } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Page, PageHeader } from '@/components/page';
import { Field, FormError, useAction } from '@/components/form';
import { api, num, day } from '@/lib/api';
import { toast } from 'sonner';

const FIELDS: Record<string, { label: string; placeholder: string; options?: [string, string][] }> = {
  topic: { label: 'Topic is', placeholder: 'coffee, food, racing' },
  country: { label: 'Country is', placeholder: 'US, CA' },
  kind: { label: 'Kind of place is', placeholder: '', options: [['site', 'Website or blog'], ['newsletter', 'Newsletter'], ['app', 'App or chat'], ['game', 'Game'], ['creator', 'Creator channel']] },
  format: { label: 'Ad format is', placeholder: '', options: [['banner', 'Banner'], ['native', 'Native card'], ['email', 'Newsletter block'], ['game', 'In-game board']] },
  site: { label: 'Website is', placeholder: 'example.com' },
};
type Cond = { field: string; value: string };
type ListRef = { id: string; exclude: boolean };
const describe = (c: Cond) => `${FIELDS[c.field]?.label.toLowerCase() ?? c.field} ${FIELDS[c.field]?.options?.find(([v]) => v === c.value)?.[1] ?? c.value}`;

function Conditions({ items, onChange }: { items: Cond[]; onChange: (c: Cond[]) => void }) {
  return (
    <div className="grid gap-2">
      {items.map((c, i) => {
        const f = FIELDS[c.field];
        const upd = (x: Partial<Cond>) => onChange(items.map((y, j) => (j === i ? { ...y, ...x } : y)));
        return (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <Select value={c.field} onValueChange={(v) => upd({ field: v, value: FIELDS[v].options?.[0][0] ?? '' })}>
              <SelectTrigger className="w-44" aria-label="What to look at"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(FIELDS).map(([k, x]) => <SelectItem key={k} value={k}>{x.label}</SelectItem>)}</SelectContent>
            </Select>
            {f.options ? (
              <Select value={c.value} onValueChange={(v) => upd({ value: v })}>
                <SelectTrigger className="min-w-40 flex-1" aria-label="Value"><SelectValue /></SelectTrigger>
                <SelectContent>{f.options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            ) : <Input className="min-w-40 flex-1" value={c.value} onChange={(e) => upd({ value: e.target.value })} placeholder={f.placeholder} aria-label="Value" />}
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove condition" onClick={() => onChange(items.filter((_, j) => j !== i))}><IconX /></Button>
          </div>
        );
      })}
      <div><Button type="button" variant="outline" onClick={() => onChange([...items, { field: 'topic', value: '' }])}><IconPlus />Add condition</Button></div>
    </div>
  );
}

function ListDialog({ open, onOpenChange, lists, onPick, onMade }: { open: boolean; onOpenChange: (o: boolean) => void; lists: any[]; onPick: (l: ListRef) => void; onMade: () => Promise<any> }) {
  const [mode, setMode] = React.useState<'new' | 'old'>('new');
  const [f, setF] = React.useState({ name: '', kind: 'sites', items: '', pick: '', exclude: 'include' });
  const { busy, error, setError, run } = useAction();
  React.useEffect(() => { if (open) { setError(null); setMode(lists.length ? 'old' : 'new'); setF({ name: '', kind: 'sites', items: '', pick: lists[0]?.id ?? '', exclude: 'include' }); } }, [open, lists, setError]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Add a list</DialogTitle><DialogDescription>A list of websites or topics to include or leave out. Lists never hold people or email addresses.</DialogDescription></DialogHeader>
        <form className="grid gap-4" onSubmit={async (e) => {
          e.preventDefault();
          let id = f.pick;
          if (await run(async () => { if (mode === 'new') { id = (await api('/v1/lists', { name: f.name, kind: f.kind, items: f.items })).list.id; await onMade(); } })) { onPick({ id, exclude: f.exclude === 'exclude' }); onOpenChange(false); }
        }}>
          {lists.length > 0 && (
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'new' | 'old')} className="flex gap-4">
              <Label className="flex items-center gap-2 font-normal"><RadioGroupItem value="old" />Use a saved list</Label>
              <Label className="flex items-center gap-2 font-normal"><RadioGroupItem value="new" />Upload a new one</Label>
            </RadioGroup>
          )}
          {mode === 'old' ? (
            <Field label="List">
              <Select value={f.pick} onValueChange={(v) => setF({ ...f, pick: v })}>
                <SelectTrigger className="w-full" aria-label="List"><SelectValue /></SelectTrigger>
                <SelectContent>{lists.map((l) => <SelectItem key={l.id} value={l.id}>{l.name} ({num(l.count)} {l.kind})</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          ) : <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" htmlFor="l-name"><Input id="l-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Coffee blogs we like" /></Field>
              <Field label="It holds">
                <Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v })}><SelectTrigger className="w-full" aria-label="It holds"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="sites">Websites</SelectItem><SelectItem value="topics">Topics</SelectItem></SelectContent></Select>
              </Field>
            </div>
            <Field label="One per line, or paste a CSV column" htmlFor="l-items"><Textarea id="l-items" rows={6} value={f.items} onChange={(e) => setF({ ...f, items: e.target.value })} placeholder={f.kind === 'sites' ? 'sprudge.com\nbaristamagazine.com' : 'espresso\nlatte art'} /></Field>
            <Input type="file" accept=".csv,.txt,text/plain,text/csv" aria-label="Upload a file" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setF({ ...f, items: (await file.text()).slice(0, 200_000) }); }} />
          </>}
          <Field label="Use it to">
            <Select value={f.exclude} onValueChange={(v) => setF({ ...f, exclude: v })}><SelectTrigger className="w-full" aria-label="Use it to"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="include">Include these</SelectItem><SelectItem value="exclude">Leave these out</SelectItem></SelectContent></Select>
          </Field>
          <FormError error={error} />
          <Button type="submit" variant="ink" disabled={busy || (mode === 'new' ? !f.name || !f.items : !f.pick)}>Add list</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Audiences() {
  const [tab, setTab] = React.useState('create');
  const [data, setData] = React.useState<{ audiences: any[]; lists: any[]; reach: any[] }>({ audiences: [], lists: [], reach: [] });
  const [name, setName] = React.useState('');
  const [match, setMatch] = React.useState<'any' | 'all'>('any');
  const [inc, setInc] = React.useState<Cond[]>([]);
  const [exc, setExc] = React.useState<Cond[]>([]);
  const [lists, setLists] = React.useState<ListRef[]>([]);
  const [listOpen, setListOpen] = React.useState(false);
  const { busy, error, run } = useAction();
  const load = React.useCallback(() => api('/v1/audiences').then(setData).catch(() => {}), []);
  React.useEffect(() => { load(); }, [load]);
  const listName = (id: string) => data.lists.find((l) => l.id === id)?.name ?? 'List';
  const places = data.reach.reduce((s, r) => s + r.n, 0);
  return (
    <Page>
      <PageHeader title="Audiences" />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-b bg-transparent p-0">
          {[['create', 'Create'], ['all', 'View all audiences']].map(([k, l]) => (
            <TabsTrigger key={k} value={k} className="flex-none rounded-none border-0 border-b-2 border-transparent px-3.5 pb-3 shadow-none data-[state=active]:border-ink data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent">{l}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="create" className="pt-7">
          <form className="rounded-xl border bg-card p-5 shadow-xs sm:p-6" onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => api('/v1/audiences', { name, match, include: inc.filter((c) => c.value.trim()), exclude: exc.filter((c) => c.value.trim()), lists }))) {
              toast.success('Audience made. Pick it when you make an ad group.'); setName(''); setInc([]); setExc([]); setLists([]); load(); setTab('all');
            }
          }}>
            <div className="mb-6 flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-lg border bg-muted/50"><IconUsers className="size-4" /></span><h2 className="text-lg font-medium">New audience</h2></div>
            <Field label="Audience name" htmlFor="au-name"><Input id="au-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Food and coffee sites in the US, no politics" maxLength={80} /></Field>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm font-medium">Require
                  <Select value={match} onValueChange={(v) => setMatch(v as 'any' | 'all')}><SelectTrigger className="h-8 w-24" aria-label="Any or all"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="any">any</SelectItem><SelectItem value="all">all</SelectItem></SelectContent></Select>condition
                </div>
                <Conditions items={inc} onChange={setInc} />
                {!inc.length && <p className="mt-3 text-xs text-muted-foreground">No include conditions: this audience is every place in the network, minus what you leave out.</p>}
              </div>
              <div className="rounded-lg border p-4">
                <p className="mb-3 text-sm font-medium">Leave out places where</p>
                <Conditions items={exc} onChange={setExc} />
              </div>
            </div>
            {lists.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{lists.map((l) => (
              <span key={l.id} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm">{l.exclude ? 'Leave out' : 'Include'}: {listName(l.id)}
                <button type="button" aria-label="Remove list" onClick={() => setLists(lists.filter((x) => x.id !== l.id))} className="text-muted-foreground hover:text-foreground"><IconX className="size-3.5" /></button></span>))}</div>}
            <div className="mt-4"><Button type="button" variant="outline" onClick={() => setListOpen(true)}><IconFileUpload />Add list</Button></div>
            <p className="mt-5 text-sm text-muted-foreground">Audiences choose places, not people: the topic of the page, the country, the kind of place and the ad format. {places > 0 && `${num(places)} ad spaces take network ads right now.`}</p>
            <FormError error={error} />
            <Button type="submit" variant="ink" className="mt-5 w-full" size="lg" disabled={busy || !name.trim()}><IconPlus />Create audience</Button>
          </form>
        </TabsContent>
        <TabsContent value="all" className="grid gap-8 pt-7">
          <div>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-medium">All audiences</h2><span className="rounded-full bg-muted px-2.5 py-0.5 text-xs tabular">{data.audiences.length}</span></div>
            {data.audiences.length ? <div className="divide-y rounded-xl border bg-card shadow-xs">{data.audiences.map((a) => (
              <div key={a.id} className="flex flex-wrap items-start gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{a.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {a.include.length ? `${a.match === 'all' ? 'All of' : 'Any of'}: ${a.include.map(describe).join('; ')}` : 'Every place'}
                    {a.exclude.length ? `. Leaving out ${a.exclude.map(describe).join('; ')}` : ''}{a.lists.length ? `. ${a.lists.length} list${a.lists.length > 1 ? 's' : ''}` : ''}.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Used by {a.groups} ad group{a.groups === 1 ? '' : 's'} · made {day(a.created)}</p>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${a.name}`} onClick={async () => { if (confirm(`Delete "${a.name}"? Ad groups using it will show to everyone in the network.`)) { await api(`/v1/audiences/${a.id}/delete`, {}); load(); } }}><IconTrash /></Button>
              </div>))}</div>
              : <div className="rounded-xl border bg-card py-10 text-center font-medium shadow-xs">No audiences yet</div>}
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-medium">Uploaded lists</h2><span className="rounded-full bg-muted px-2.5 py-0.5 text-xs tabular">{data.lists.length}</span></div>
            {data.lists.length ? <div className="divide-y rounded-xl border bg-card shadow-xs">{data.lists.map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1"><p className="font-medium">{l.name}</p><p className="text-sm text-muted-foreground">{num(l.count)} {l.kind === 'sites' ? 'websites' : 'topics'} · {day(l.created)}</p></div>
                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${l.name}`} onClick={async () => { if (confirm(`Delete the list "${l.name}"?`)) { await api(`/v1/lists/${l.id}/delete`, {}); load(); } }}><IconTrash /></Button>
              </div>))}</div>
              : <div className="rounded-xl border bg-card py-10 text-center font-medium shadow-xs">No uploaded lists yet</div>}
          </div>
        </TabsContent>
      </Tabs>
      <ListDialog open={listOpen} onOpenChange={setListOpen} lists={data.lists} onMade={load} onPick={(l) => setLists([...lists.filter((x) => x.id !== l.id), l])} />
    </Page>
  );
}
