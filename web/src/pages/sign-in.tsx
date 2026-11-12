import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FormError, useAction } from '@/components/form';
import { Mark } from '@/components/mark';
import { api, type Site } from '@/lib/api';

type Step = 'start' | 'code' | 'profile' | '2fa' | 'password';

// Read what the Google round trip left in the address: #onyx=profile:<ticket>, #onyx=2fa:<ticket> or #onyx=failed[:why]
function fromHash(): { step?: Step; ticket?: string; error?: string } {
  const m = /^#onyx=([a-z0-9]+)(?::(.*))?$/.exec(location.hash);
  if (!m) return {};
  history.replaceState(null, '', location.pathname + location.search);
  const rest = m[2] ? decodeURIComponent(m[2]) : '';
  if (m[1] === 'profile') return { step: 'profile', ticket: rest };
  if (m[1] === '2fa') return { step: '2fa', ticket: rest };
  return { error: rest || 'Google sign-in did not finish. Please try again.' };
}

export function SignIn({ site, onDone }: { site: Site; onDone: () => Promise<void> }) {
  const [mode, setMode] = React.useState<'login' | 'signup'>(() => (location.hash === '#signup' ? 'signup' : 'login'));
  const [needCode, setNeedCode] = React.useState(false);
  const [f, setF] = React.useState({ name: '', email: '', password: '', code: '', handle: '' });
  const first = React.useMemo(fromHash, []);
  const [onyx, setOnyx] = React.useState<boolean | null>(first.step ? true : null);
  const [step, setStep] = React.useState<Step>(first.step ?? 'start');
  const [ticket, setTicket] = React.useState(first.ticket ?? '');
  const [masked, setMasked] = React.useState('');
  const { busy, error, setError, run } = useAction();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  React.useEffect(() => { if (first.error) setError(first.error); }, []);
  React.useEffect(() => {
    if (onyx !== null) return;
    api<{ on: boolean }>('/v1/auth/onyx/config').then((r) => { setOnyx(!!r.on); if (!r.on) setStep('password'); }).catch(() => { setOnyx(false); setStep('password'); });
  }, []);
  // Every Onyx answer is one of: signed in, pick a name, or the authenticator code
  const next = async (r: any) => {
    if (r.needs_profile) { setTicket(r.ticket); setF((x) => ({ ...x, name: x.name || r.suggest || '', code: '' })); setStep('profile'); return; }
    if (r.need_code) { setTicket(r.ticket); setF((x) => ({ ...x, code: '' })); setStep('2fa'); return; }
    await onDone();
  };
  const go = (s: Step) => { setError(null); setF((x) => ({ ...x, code: '' })); setStep(s); };
  const title = step === 'profile' ? 'One last thing' : step === '2fa' ? 'Check your authenticator' : step === 'code' ? 'Check your email'
    : step === 'password' && mode === 'signup' ? 'Make your account' : 'Welcome back';
  const sub = step === 'profile' ? 'Pick the name people see on your ads and your space.' : step === '2fa' ? 'Enter the six-digit code from your authenticator app.'
    : step === 'code' ? `We sent a six-digit code to ${masked || f.email}.` : step === 'password' && mode === 'signup' ? 'Free. Run ads, sell your own space, or both.'
    : 'Sign in to run your ads and your ad space.';
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <a href="/" className="flex items-center gap-2 text-lg font-semibold"><Mark className="size-6" />{site.brand}</a>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{sub}</p>

          {onyx === null && step === 'start' && <p className="mt-8 text-sm text-muted-foreground">One moment…</p>}

          {onyx && step === 'start' && <>
            <div className="mt-8 grid gap-4">
              <Button asChild variant="outline" size="lg"><a href="/v1/auth/onyx/google"><GoogleG />Continue with Google</a></Button>
              <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
            </div>
            <form className="mt-4 grid gap-4" onSubmit={async (e) => {
              e.preventDefault();
              await run(async () => { const r = await api('/v1/auth/onyx/email-start', { email: f.email }); setMasked(r.masked ?? ''); go('code'); });
            }}>
              <Field label="Email" htmlFor="ox-email"><Input id="ox-email" type="email" autoComplete="email" value={f.email} onChange={set('email')} required /></Field>
              <FormError error={error} />
              <Button type="submit" variant="ink" size="lg" disabled={busy}>{busy ? 'One moment…' : 'Email me a code'}</Button>
            </form>
            <p className="mt-6 text-sm text-muted-foreground">
              Made your account with a password?{' '}
              <button type="button" className="font-medium text-foreground underline underline-offset-4" onClick={() => { setMode('login'); go('password'); }}>Use your password</button>
            </p>
          </>}

          {step === 'code' && <form className="mt-8 grid gap-4" onSubmit={async (e) => {
            e.preventDefault();
            await run(async () => next(await api('/v1/auth/onyx/email-verify', { email: f.email, code: f.code })));
          }}>
            <Field label="Six-digit code" htmlFor="ox-code"><Input id="ox-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={f.code} onChange={set('code')} required autoFocus /></Field>
            <FormError error={error} />
            <Button type="submit" variant="ink" size="lg" disabled={busy}>{busy ? 'One moment…' : 'Sign in'}</Button>
            <button type="button" className="text-sm text-muted-foreground underline underline-offset-4" onClick={() => go('start')}>Use a different email</button>
          </form>}

          {step === 'profile' && <form className="mt-8 grid gap-4" onSubmit={async (e) => {
            e.preventDefault();
            await run(async () => next(await api('/v1/auth/onyx/profile', { ticket, name: f.name, handle: f.handle })));
          }}>
            <Field label="Your name or business" htmlFor="ox-name"><Input id="ox-name" autoComplete="name" value={f.name} onChange={set('name')} required autoFocus /></Field>
            <Field label="Username" htmlFor="ox-handle" hint="Letters, numbers and underscores"><Input id="ox-handle" autoCapitalize="none" value={f.handle} onChange={set('handle')} placeholder="@yourname" /></Field>
            <FormError error={error} />
            <Button type="submit" variant="ink" size="lg" disabled={busy}>{busy ? 'One moment…' : 'Continue'}</Button>
          </form>}

          {step === '2fa' && <form className="mt-8 grid gap-4" onSubmit={async (e) => {
            e.preventDefault();
            await run(async () => next(await api('/v1/auth/onyx/2fa', { ticket, code: f.code })));
          }}>
            <Field label="Code from your authenticator app" htmlFor="ox-totp"><Input id="ox-totp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={f.code} onChange={set('code')} required autoFocus /></Field>
            <FormError error={error} />
            <Button type="submit" variant="ink" size="lg" disabled={busy}>{busy ? 'One moment…' : 'Sign in'}</Button>
          </form>}

          {step === 'password' && <>
            <form className="mt-8 grid gap-4" onSubmit={async (e) => {
              e.preventDefault();
              await run(async () => {
                try {
                  await api(`/v1/auth/${mode}`, mode === 'signup' ? { name: f.name, email: f.email, password: f.password } : { email: f.email, password: f.password, code: f.code || undefined });
                } catch (x: any) { if (x.data?.need_code) { setNeedCode(true); throw new Error('Enter the six-digit code from your authenticator app'); } throw x; }
                await onDone();
              });
            }}>
              {mode === 'signup' && <Field label="Your name or business" htmlFor="si-name"><Input id="si-name" autoComplete="name" value={f.name} onChange={set('name')} required /></Field>}
              <Field label="Email" htmlFor="si-email"><Input id="si-email" type="email" autoComplete="email" value={f.email} onChange={set('email')} required /></Field>
              <Field label="Password" htmlFor="si-pw" hint={mode === 'signup' ? '10 characters or more' : undefined}>
                <Input id="si-pw" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={f.password} onChange={set('password')} required minLength={mode === 'signup' ? 10 : 1} />
              </Field>
              {needCode && mode === 'login' && <Field label="Code from your authenticator app" htmlFor="si-code"><Input id="si-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={f.code} onChange={set('code')} autoFocus /></Field>}
              <FormError error={error} />
              <Button type="submit" variant="ink" size="lg" disabled={busy}>{busy ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Make my account'}</Button>
            </form>
            <p className="mt-6 text-sm text-muted-foreground">
              {onyx ? <button type="button" className="font-medium text-foreground underline underline-offset-4" onClick={() => go('start')}>Sign in with Google or an email code</button> : <>
                {mode === 'login' ? 'New here? ' : 'Have an account? '}
                <button type="button" className="font-medium text-foreground underline underline-offset-4" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setNeedCode(false); }}>{mode === 'login' ? 'Make an account' : 'Sign in'}</button>
              </>}
            </p>
          </>}
        </div>
        <p className="text-xs text-muted-foreground">No cookies on your readers. Ads are always marked Sponsored.</p>
      </div>
      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <div className="absolute inset-0 grid place-items-center p-16">
          <div className="max-w-md text-ink-foreground">
            <Mark className="mb-8 size-12" />
            <p className="text-4xl leading-tight font-semibold tracking-tight">Ads that fit where they run.</p>
            <p className="mt-4 text-ink-foreground/70">Blogs, newsletters, games, chat and creators. You set the price, approve every ad, and keep 85%. We measure the ad, not the person.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
    </svg>
  );
}
