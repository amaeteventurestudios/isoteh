import * as React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, FormError, useAction } from './form';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const CATEGORIES = ['Billing', 'Campaigns', 'Tracking', 'Account', 'Selling ad space', 'Book a call', 'Something else'];

export function SupportDialog({ open, onOpenChange, category }: { open: boolean; onOpenChange: (o: boolean) => void; category?: string }) {
  const [subject, setSubject] = React.useState('');
  const [cat, setCat] = React.useState('');
  const [body, setBody] = React.useState('');
  const { busy, error, setError, run } = useAction();
  React.useEffect(() => {
    if (!open) return;
    setError(null); setCat(category ?? '');
    setSubject(category === 'Book a call' ? 'I would like a 20-minute call' : '');
    setBody(category === 'Book a call' ? 'Good days and times for me (and my time zone):\n\nWhat I would like to talk about:\n' : '');
  }, [open, category, setError]);
  const ok = subject.trim().length >= 3 && cat && body.trim().length >= 5;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category === 'Book a call' ? 'Book a call' : 'Contact support'}</DialogTitle>
          <DialogDescription>We usually reply within a few hours, by email. {category === 'Book a call' ? 'Tell us when suits you and we will send an invite.' : ''}</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => api('/v1/support', { subject, category: cat, body }))) { toast.success('Sent. We will reply by email.'); onOpenChange(false); }
        }}>
          <Field label="Subject" htmlFor="sp-subject"><Input id="sp-subject" autoFocus placeholder="Summary of the issue" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} /></Field>
          <Field label="Category">
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger className="w-full" aria-label="Category"><SelectValue placeholder="Select a category" /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Describe the issue" htmlFor="sp-body"><Textarea id="sp-body" rows={4} placeholder="What happened?" value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} /></Field>
          <FormError error={error} />
          <Button type="submit" variant="ink" className="w-full" disabled={!ok || busy}>{busy ? 'Sending…' : category === 'Book a call' ? 'Ask for a call' : 'Create ticket'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
