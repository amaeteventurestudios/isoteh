import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { IconUserCircle, IconUsers, IconSettings, IconCreditCard, IconEye, IconEyeOff, IconShieldLock, IconUserPlus, IconCopy, IconPlus, IconCoins, IconReceipt, IconDownload, IconTrash, IconCheck,
  IconBrandStripe, IconBrandWordpress, IconWebhook, IconTags, IconShoppingBag } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Page, PageHeader, Section } from '@/components/page';
import { Field, FormError, useAction } from '@/components/form';
import { initials } from '@/components/app-sidebar';
import { useApp } from '@/lib/app-context';
import { api, money, toMinor, day, downloadCsv } from '@/lib/api';
import { Code, TrackingDialog } from './events';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const TABS = [['account', 'Account', IconUserCircle], ['users', 'Team', IconUsers], ['organization', 'Organization', IconSettings], ['billing', 'Billing', IconCreditCard]] as const;

export function Settings() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab')! : params.get('tab') === 'team' ? 'users' : 'account';
  return (
    <Page>
      <PageHeader title="Settings" />
      <div role="tablist" className="mb-7 flex gap-1 overflow-x-auto border-b">
        {TABS.map(([k, l, I]) => (
          <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setParams(k === 'account' ? {} : { tab: k })}
            className={cn('-mb-px flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3.5 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none', tab === k && 'border-ink font-medium text-foreground')}>
            <I className="size-4" />{l}
          </button>
        ))}
      </div>
      <div className="grid gap-5">
        {tab === 'account' && <Account />}
        {tab === 'users' && <Team />}
        {tab === 'organization' && <Organization />}
        {tab === 'billing' && <Billing />}
      </div>
    </Page>
  );
}

function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? 'text' : 'password'} className="pr-10" />
      <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)} className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground">{show ? <IconEyeOff className="size-4" /> : <IconEye className="size-4" />}</button>
    </div>
  );
}

function Account() {
  const { ws, reload } = useApp();
  const parts = ws.me.name.split(' ');
  const [first, setFirst] = React.useState(parts[0] ?? '');
  const [last, setLast] = React.useState(parts.slice(1).join(' '));
  const [pw, setPw] = React.useState({ current: '', next: '', confirm: '' });
  const [tfa, setTfa] = React.useState(false);
  const nameAct = useAction(), pwAct = useAction();
  const changed = `${first} ${last}`.trim() !== ws.me.name;
  return <>
    <Section title="Personal Information" description="Your name and email for this account.">
      <form className="grid max-w-xl gap-4" onSubmit={async (e) => { e.preventDefault(); if (await nameAct.run(() => api('/v1/me', { name: `${first} ${last}`.trim() }, 'PATCH'))) { await reload(); toast.success('Saved'); } }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="a-first"><Input id="a-first" value={first} onChange={(e) => setFirst(e.target.value)} /></Field>
          <Field label="Last name" htmlFor="a-last"><Input id="a-last" value={last} onChange={(e) => setLast(e.target.value)} /></Field>
        </div>
        <Field label="Email" htmlFor="a-email" hint="Contact support to change your email."><Input id="a-email" value={ws.me.email} disabled /></Field>
        <FormError error={nameAct.error} />
        {changed && <div><Button type="submit" variant="ink" disabled={nameAct.busy || !first.trim()}>Save</Button></div>}
      </form>
    </Section>
    <Section title="Password" description="Update your password to keep your account secure. Other devices are signed out.">
      <form className="grid max-w-md gap-4" onSubmit={async (e) => {
        e.preventDefault();
        if (pw.next !== pw.confirm) return pwAct.setError('The two new passwords are not the same');
        if (await pwAct.run(() => api('/v1/me/password', { current: pw.current, password: pw.next }))) { setPw({ current: '', next: '', confirm: '' }); toast.success('Password changed'); }
      }}>
        <Field label="Current password" htmlFor="pw-cur"><PasswordInput id="pw-cur" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
        <Field label="New Password" htmlFor="pw-new"><PasswordInput id="pw-new" autoComplete="new-password" placeholder="Min. 12 characters" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
        <Field label="Confirm Password" htmlFor="pw-conf"><PasswordInput id="pw-conf" autoComplete="new-password" placeholder="Confirm new password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
        <FormError error={pwAct.error} />
        {(pw.current || pw.next) && <div><Button type="submit" variant="ink" disabled={pwAct.busy || pw.next.length < 12}>Update password</Button></div>}
      </form>
    </Section>
    <Section title={<span className="flex items-center gap-2"><IconShieldLock className="size-4" />Two-Factor Authentication</span>} description="An extra step when you sign in: a six-digit code from an app on your phone.">
      <p className="mb-4 text-sm">{ws.me.totp_on ? 'Two-factor authentication is on. You need a code from your authenticator app each time you sign in.' : 'Two-factor authentication is not on. Turn it on to protect your account with an authenticator app such as Google Authenticator, 1Password or Authy.'}</p>
      <Button variant="outline" onClick={() => setTfa(true)}>{ws.me.totp_on ? 'Turn off Two-Factor Authentication' : 'Enable Two-Factor Authentication'}</Button>
      <TwoFactorDialog open={tfa} onOpenChange={setTfa} />
    </Section>
  </>;
}

function TwoFactorDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { ws, reload } = useApp();
  const [setup, setSetup] = React.useState<{ secret: string; uri: string; qr: string } | null>(null);
  const [code, setCode] = React.useState('');
  const { busy, error, setError, run } = useAction();
  React.useEffect(() => {
    if (!open) return;
    setCode(''); setError(null); setSetup(null);
    if (!ws.me.totp_on) run(async () => { const r = await api('/v1/me/2fa/start', {}); setSetup({ ...r, qr: await QRCode.toDataURL(r.uri, { margin: 1, width: 200 }) }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{ws.me.totp_on ? 'Turn off two-factor authentication' : 'Turn on two-factor authentication'}</DialogTitle>
          <DialogDescription>{ws.me.totp_on ? 'Enter a code from your authenticator app to turn it off.' : 'Scan this with your authenticator app, then enter the six-digit code it shows.'}</DialogDescription></DialogHeader>
        <form className="grid gap-4" onSubmit={async (e) => { e.preventDefault(); if (await run(() => api(`/v1/me/2fa/${ws.me.totp_on ? 'disable' : 'enable'}`, { code }))) { await reload(); toast.success(ws.me.totp_on ? 'Two-factor authentication is off' : 'Two-factor authentication is on'); onOpenChange(false); } }}>
          {setup && <>
            <img src={setup.qr} alt="QR code for your authenticator app" className="mx-auto size-48 rounded-lg border bg-white p-2" />
            <p className="text-center text-xs text-muted-foreground">Can’t scan it? Enter this key: <code className="font-mono break-all text-foreground">{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</code></p>
          </>}
          <Field label="Six-digit code" htmlFor="tfa-code"><Input id="tfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus /></Field>
          <FormError error={error} />
          <Button type="submit" variant="ink" disabled={busy || code.length !== 6}>{ws.me.totp_on ? 'Turn off' : 'Turn on'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Team() {
  const { ws } = useApp();
  const [data, setData] = React.useState<{ members: any[]; invites: any[]; you: string } | null>(null);
  const [add, setAdd] = React.useState(false);
  const [f, setF] = React.useState({ email: '', role: 'member' });
  const { busy, error, setError, run } = useAction();
  const load = React.useCallback(() => api('/v1/team').then(setData).catch(() => {}), []);
  React.useEffect(() => { load(); }, [load, ws.org.id]);
  const admin = ws.org.role === 'admin';
  const remove = async (id: string, label: string) => { if (confirm(`Remove ${label} from ${ws.org.name}?`)) { try { await api(`/v1/team/${id}/remove`, {}); load(); } catch (e: any) { toast.error(e.message); } } };
  return (
    <Section title="Team Members" description="Manage who has access to this organization." action={admin && <Button variant="outline" onClick={() => { setF({ email: '', role: 'member' }); setError(null); setAdd(true); }}><IconUserPlus />Add Member</Button>}>
      <ul className="divide-y">
        {data?.members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-3">
            <Avatar className="size-9"><AvatarFallback className="bg-ink text-xs text-ink-foreground">{initials(m.name)}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{m.name} {m.id === data.you && <span className="ml-1 text-xs font-normal text-muted-foreground">you</span>}</p><p className="truncate text-sm text-muted-foreground">{m.email}</p></div>
            <span className="text-sm text-muted-foreground">{m.role === 'admin' ? 'Admin' : 'Member'}</span>
            {(admin || m.id === data.you) && !m.owner && <Button variant="ghost" size="icon-sm" aria-label={`Remove ${m.name}`} onClick={() => remove(m.id, m.name)}><IconTrash /></Button>}
          </li>
        ))}
        {data?.invites.map((i) => (
          <li key={i.id} className="flex items-center gap-3 py-3">
            <Avatar className="size-9"><AvatarFallback className="text-xs">{initials(i.email)}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{i.email}</p><p className="text-sm text-muted-foreground">Invited {day(i.created)}. They join when they sign in or sign up with this email.</p></div>
            <Badge variant="outline" className="font-normal">Invited</Badge>
            {admin && <Button variant="ghost" size="icon-sm" aria-label={`Cancel invite for ${i.email}`} onClick={() => remove(i.id, i.email)}><IconTrash /></Button>}
          </li>
        ))}
      </ul>
      {ws.org.kind !== 'org' && <p className="mt-3 text-sm text-muted-foreground">This is your own account. To work with a team under a company name, make an organization from the menu at the top left.</p>}
      <Dialog open={add} onOpenChange={setAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add a member</DialogTitle><DialogDescription>They see everything in {ws.org.name}: campaigns, places, bookings and money.</DialogDescription></DialogHeader>
          <form className="grid gap-4" onSubmit={async (e) => { e.preventDefault(); let r: any; if (await run(async () => { r = await api('/v1/team', f); })) { toast.success(r.added ? 'Added' : 'Invited. Tell them to sign up with that email.'); setAdd(false); load(); } }}>
            <Field label="Email" htmlFor="t-email"><Input id="t-email" type="email" autoFocus value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Role">
              <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v })}><SelectTrigger className="w-full" aria-label="Role"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="member">Member: runs campaigns and places</SelectItem><SelectItem value="admin">Admin: also manages the team, key and Slack</SelectItem></SelectContent></Select>
            </Field>
            <FormError error={error} />
            <Button type="submit" variant="ink" disabled={busy || !f.email}>Add member</Button>
          </form>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

const INTEGRATIONS = [
  { key: 'shopify', name: 'Shopify', icon: IconShoppingBag, text: 'Purchases, add-to-cart and checkout events', how: 'tag' },
  { key: 'stripe', name: 'Stripe', icon: IconBrandStripe, text: 'Count Stripe payments as conversions', how: 'server' },
  { key: 'woo', name: 'WooCommerce and WordPress', icon: IconBrandWordpress, text: 'Orders and sign-ups from a WordPress shop', how: 'tag' },
  { key: 'gtm', name: 'Google Tag Manager', icon: IconTags, text: 'Add the tag and events without touching code', how: 'tag' },
  { key: 'hook', name: 'Zapier, Make or any server', icon: IconWebhook, text: 'Send events from any tool that can post to a web address', how: 'server' },
];

function Organization() {
  const { ws, reload } = useApp();
  const [f, setF] = React.useState({ name: ws.org.name, website: ws.org.website });
  const [key, setKey] = React.useState<{ id: string; created: number } | null>(null);
  const [fresh, setFresh] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const [howTo, setHowTo] = React.useState<false | string>(false);
  const act = useAction(), keyAct = useAction();
  React.useEffect(() => { setF({ name: ws.org.name, website: ws.org.website }); api('/v1/org/key').then((r) => setKey(r.key)).catch(() => {}); setFresh(''); }, [ws.org.id, ws.org.name, ws.org.website]);
  const admin = ws.org.role === 'admin';
  const changed = f.name !== ws.org.name || f.website !== ws.org.website;
  return <>
    <Section title="Organization" description="Your organization’s name and website.">
      <form className="grid max-w-md gap-4" onSubmit={async (e) => { e.preventDefault(); if (await act.run(() => api('/v1/org', f, 'PATCH'))) { await reload(); toast.success('Saved'); } }}>
        <Field label="Name" htmlFor="o-name"><Input id="o-name" value={f.name} disabled={!admin} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Website" htmlFor="o-web"><Input id="o-web" value={f.website} disabled={!admin} placeholder="https://yourbrand.com" onChange={(e) => setF({ ...f, website: e.target.value })} /></Field>
        <FormError error={act.error} />
        {changed && <div><Button type="submit" variant="ink" disabled={act.busy}>Save</Button></div>}
      </form>
    </Section>
    <Section title="API Key" description="Use this key from your server to send conversions to the Conversions API, or to add places and slots from your own tools. It is for server use only.">
      <div className="flex max-w-xl flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Input readOnly value={fresh || (key ? '•'.repeat(44) : 'No key yet')} className={cn('pr-10 font-mono text-xs', !fresh && 'tracking-widest')} aria-label="API key" />
          <button type="button" aria-label="Copy key" disabled={!fresh} onClick={async () => { try { await navigator.clipboard.writeText(fresh); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* */ } }}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-40">{copied ? <IconCheck className="size-4" /> : <IconCopy className="size-4" />}</button>
        </div>
        <Button variant="outline" disabled={!admin || keyAct.busy} onClick={async () => {
          if (key && !confirm('Make a new key? The old one stops working straight away.')) return;
          await keyAct.run(async () => { const r = await api('/v1/org/key/rotate', {}); setFresh(r.key); setKey({ id: 'new', created: Date.now() }); });
        }}>{key ? 'Rotate' : 'Make a key'}</Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{fresh ? 'Copy it now: we only keep a fingerprint of it, so it won’t be shown again.' : key ? `Made ${day(key.created)}. We keep only a fingerprint, so a lost key can’t be shown again; rotate to get a new one.` : 'Make a key when your server is ready to send events.'}</p>
      <FormError error={keyAct.error} />
    </Section>
    <Section title="Integrations" description="Connect your tools to count conversions automatically. Each one counts events against the ad that was clicked, never against a person.">
      <ul className="-mx-2 divide-y">
        {INTEGRATIONS.map((x) => (
          <li key={x.key} className="flex items-center gap-4 px-2 py-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40"><x.icon className="size-5" /></span>
            <div className="min-w-0 flex-1"><p className="text-sm font-medium">{x.name}</p><p className="text-sm text-muted-foreground">{x.text}</p></div>
            <Button variant="outline" size="sm" onClick={() => setHowTo(x.how)}>Connect</Button>
          </li>
        ))}
      </ul>
      <TrackingDialog open={howTo !== false} start={howTo || undefined} onOpenChange={(o) => !o && setHowTo(false)} />
    </Section>
  </>;
}

function Billing() {
  const { site } = useApp();
  const [m, setM] = React.useState<any>(null);
  const [add, setAdd] = React.useState(false);
  const [f, setF] = React.useState({ amount: '', currency: 'USD', provider: '' });
  const { busy, error, setError, run } = useAction();
  React.useEffect(() => { api('/v1/money').then(setM).catch(() => {}); }, []);
  const card = site.providers?.includes('stripe');
  const methods: string[] = [...new Set<string>((m?.payments ?? []).filter((p: any) => p.status === "paid").map((p: any) => p.provider as string))];
  const credit = (m?.balances ?? []).filter((b: any) => b.amount > 0);
  const LABEL: Record<string, string> = { stripe: 'Card (Stripe)', paystack: 'Paystack', manual: 'Bank transfer' };
  const invoices = (m?.payments ?? []) as any[];
  const startPay = async () => {
    if (await run(async () => {
      const r = await api('/v1/topups', { amount: toMinor(f.amount, f.currency), currency: f.currency, provider: f.provider });
      if (r.url.startsWith(location.origin)) location.href = r.url.replace(location.origin, ''); else location.href = r.url;
    })) setAdd(false);
  };
  return <>
    <Section title="Payment Methods" description="Used to fund your campaign budgets and bookings. We never see or store card numbers; cards go through Stripe."
      action={<Button variant="outline" onClick={() => { setF({ amount: '', currency: 'USD', provider: card ? 'stripe' : site.providers?.[0] ?? 'manual' }); setError(null); setAdd(true); }}><IconPlus />{card ? 'Add card' : 'Add funds'}</Button>}>
      <div className="grid gap-3">
        {methods.length ? methods.map((p) => (
          <div key={p} className="flex items-center gap-4 rounded-lg border bg-muted/30 px-4 py-3.5"><span className="flex size-9 items-center justify-center rounded-md border bg-background"><IconCreditCard className="size-4" /></span>
            <div><p className="text-sm font-medium">{LABEL[p] ?? p}</p><p className="text-xs text-muted-foreground">Used before. Pick it again when you add funds.</p></div></div>
        )) : (
          <div className="flex items-center gap-4 rounded-lg border bg-muted/30 px-4 py-3.5"><span className="flex size-9 items-center justify-center rounded-md border bg-background"><IconCreditCard className="size-4" /></span>
            <div><p className="text-sm font-medium">No payment method</p><p className="text-xs text-muted-foreground">{card ? 'Add a card to start running campaigns.' : 'Card payments are not switched on yet. Pay by bank transfer to start running campaigns.'}</p></div></div>
        )}
        <div className="flex items-center gap-4 rounded-lg border bg-muted/30 px-4 py-3.5"><span className="flex size-9 items-center justify-center rounded-md border bg-background"><IconCoins className="size-4" /></span>
          <div><p className="text-sm font-medium">Account credit: {credit.length ? credit.map((b: any) => money(b.amount, b.currency)).join(' · ') : money(0, 'USD')}</p><p className="text-xs text-muted-foreground">Credit is spent before your card is charged. Unspent campaign budget comes back here.</p></div></div>
      </div>
    </Section>
    <Section title="Billing History" description="Past payments on this account." action={<Button variant="outline" size="sm" disabled={!invoices.length}
      onClick={() => downloadCsv('isoteh-billing.csv', [['Date', 'Reference', 'For', 'Amount', 'Currency', 'Method', 'Status'], ...invoices.map((p) => [day(p.created), p.ref, p.kind === 'booking' ? 'Booking' : 'Credit', (p.amount / 100).toFixed(2), p.currency, LABEL[p.provider] ?? p.provider, p.status])])}><IconDownload />Download CSV</Button>}>
      {invoices.length ? (
        <div className="-mx-2 overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="px-2 py-2 font-medium">Date</th><th className="px-2 py-2 font-medium">For</th><th className="px-2 py-2 font-medium">Method</th><th className="px-2 py-2 font-medium">Status</th><th className="px-2 py-2 text-right font-medium">Amount</th></tr></thead>
          <tbody>{invoices.map((p) => (
            <tr key={p.ref} className="border-b last:border-0"><td className="px-2 py-3 whitespace-nowrap">{day(p.created)}</td><td className="px-2 py-3">{p.kind === 'booking' ? 'Booking' : 'Ad credit'}<div className="font-mono text-xs text-muted-foreground">{p.ref}</div></td>
              <td className="px-2 py-3">{LABEL[p.provider] ?? p.provider}</td><td className="px-2 py-3"><Badge variant="outline" className={cn('font-normal', p.status === 'paid' && 'border-brand/40 bg-brand-soft text-brand')}>{p.status === 'paid' ? 'Paid' : 'Waiting'}</Badge></td>
              <td className="px-2 py-3 text-right tabular">{money(p.amount, p.currency)}</td></tr>))}</tbody></table></div>
      ) : <p className="flex items-center gap-2 text-sm text-muted-foreground"><IconReceipt className="size-4" />No invoices yet.</p>}
    </Section>
    <Dialog open={add} onOpenChange={setAdd}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{card ? 'Add a card and funds' : 'Add funds'}</DialogTitle><DialogDescription>Funds become credit for pay-per-view campaigns. Bookings are paid one by one when you book.</DialogDescription></DialogHeader>
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); startPay(); }}>
          <div className="grid grid-cols-[1fr_110px] gap-3">
            <Field label="Amount" htmlFor="b-amt"><Input id="b-amt" inputMode="decimal" autoFocus value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="100" /></Field>
            <Field label="Currency"><Select value={f.currency} onValueChange={(v) => setF({ ...f, currency: v })}><SelectTrigger className="w-full" aria-label="Currency"><SelectValue /></SelectTrigger><SelectContent>{(site.currencies ?? ['USD']).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></Field>
          </div>
          <Field label="Pay with"><Select value={f.provider} onValueChange={(v) => setF({ ...f, provider: v })}><SelectTrigger className="w-full" aria-label="Pay with"><SelectValue /></SelectTrigger>
            <SelectContent>{(site.providers ?? ['manual']).map((p) => <SelectItem key={p} value={p}>{LABEL[p] ?? p}</SelectItem>)}</SelectContent></Select></Field>
          {f.provider === 'manual' && <p className="text-sm text-muted-foreground">You get a reference to put on an ACH or wire transfer. Our team confirms it, usually the same day.</p>}
          {f.provider === 'stripe' && <p className="text-sm text-muted-foreground">You go to Stripe’s secure page to pay by card, Apple Pay or Google Pay, then come back here.</p>}
          {f.amount && <p className="text-sm">You pay {money(toMinor(f.amount, f.currency), f.currency)}.</p>}
          <FormError error={error} />
          <Button type="submit" variant="ink" disabled={busy || !Number(f.amount)}>Continue</Button>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}

export { Code };
