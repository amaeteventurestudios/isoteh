import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FormError, useAction } from '@/components/form';
import { Mark } from '@/components/mark';
import { api, type Site } from '@/lib/api';

export function SignIn({ site, onDone }: { site: Site; onDone: () => Promise<void> }) {
  const [mode, setMode] = React.useState<'login' | 'signup'>(() => (location.hash === '#signup' ? 'signup' : 'login'));
  const [needCode, setNeedCode] = React.useState(false);
  const [f, setF] = React.useState({ name: '', email: '', password: '', code: '' });
  const { busy, error, setError, run } = useAction();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <a href="/" className="flex items-center gap-2 text-lg font-semibold"><Mark className="size-6" />{site.brand}</a>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-semibold tracking-tight">{mode === 'login' ? 'Welcome back' : 'Make your account'}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{mode === 'login' ? 'Sign in to run your ads and your ad space.' : 'Free. Run ads, sell your own space, or both.'}</p>
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
            {mode === 'login' ? 'New here? ' : 'Have an account? '}
            <button type="button" className="font-medium text-foreground underline underline-offset-4" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setNeedCode(false); }}>{mode === 'login' ? 'Make an account' : 'Sign in'}</button>
          </p>
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
