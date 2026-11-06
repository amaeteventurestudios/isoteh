import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Field, FormError, useAction } from './form';
import { api } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { toast } from 'sonner';

export function CreateOrgDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { reload } = useApp();
  const nav = useNavigate();
  const [name, setName] = React.useState('');
  const [website, setWebsite] = React.useState('');
  const { busy, error, setError, run } = useAction();
  React.useEffect(() => { if (open) { setName(''); setWebsite(''); setError(null); } }, [open, setError]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Create an organization</DialogTitle><DialogDescription>A shared space for a brand or a company. Invite your team once it is made.</DialogDescription></DialogHeader>
        <form className="grid gap-4" onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => api('/v1/orgs', { name, website }))) { await reload(); toast.success(`${name} is ready`); onOpenChange(false); nav('/app/dashboard'); }
        }}>
          <Field label="Name" htmlFor="org-name"><Input id="org-name" autoFocus placeholder="Juniper Coffee" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Field>
          <Field label="Website" htmlFor="org-web" hint="Optional"><Input id="org-web" placeholder="https://juniper.coffee" value={website} onChange={(e) => setWebsite(e.target.value)} /></Field>
          <FormError error={error} />
          <Button type="submit" variant="ink" disabled={busy || name.trim().length < 2}>{busy ? 'Creating…' : 'Create organization'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
