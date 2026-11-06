import * as React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Field, FormError, useAction } from './form';
import { api } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { toast } from 'sonner';

export function SlackDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { ws, reload } = useApp();
  const [url, setUrl] = React.useState('');
  const { busy, error, setError, run } = useAction();
  React.useEffect(() => { if (open) { setUrl(''); setError(null); } }, [open, setError]);
  const admin = ws.org.role === 'admin';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{ws.org.slack ? 'Slack is connected' : 'Connect to Slack'}</DialogTitle>
          <DialogDescription>Get a note in a Slack channel when someone books your space, when an ad is approved and when a campaign runs low.</DialogDescription>
        </DialogHeader>
        {ws.org.slack ? (
          <div className="grid gap-4">
            <p className="text-sm">Notes go to the channel you picked. To change the channel, disconnect and connect again with a new address.</p>
            <FormError error={error} />
            {admin && <Button variant="outline" disabled={busy} onClick={async () => { if (await run(() => api('/v1/org/slack', { url: '' }))) { await reload(); toast.success('Slack disconnected'); onOpenChange(false); } }}>Disconnect Slack</Button>}
          </div>
        ) : (
          <form className="grid gap-4" onSubmit={async (e) => { e.preventDefault(); if (await run(() => api('/v1/org/slack', { url }))) { await reload(); toast.success('Connected. Check your channel for a hello.'); onOpenChange(false); } }}>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>In Slack, open <a className="text-foreground underline underline-offset-2" href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noopener noreferrer">Incoming Webhooks</a> and add one to the channel you want.</li>
              <li>Copy the address it gives you (it starts with https://hooks.slack.com/services/).</li>
              <li>Paste it here.</li>
            </ol>
            <Field label="Webhook address" htmlFor="slack-url"><Input id="slack-url" placeholder="https://hooks.slack.com/services/…" value={url} onChange={(e) => setUrl(e.target.value)} disabled={!admin} /></Field>
            {!admin && <p className="text-sm text-muted-foreground">Ask an admin of {ws.org.name} to connect Slack.</p>}
            <FormError error={error} />
            <Button type="submit" variant="ink" disabled={!admin || busy || !url}>{busy ? 'Connecting…' : 'Connect'}</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
