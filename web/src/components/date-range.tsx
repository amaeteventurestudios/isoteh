import * as React from 'react';
import { IconCalendar } from '@tabler/icons-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { iso } from '@/lib/api';
import { cn } from '@/lib/utils';

export type Range = { from: string; to: string; label: string };
const DAY = 86_400_000;
const today = () => new Date(new Date().toISOString().slice(0, 10)).getTime();
export const PRESETS: { label: string; make: () => [number, number] }[] = [
  { label: 'Today', make: () => [today(), today()] },
  { label: 'Last 7 days', make: () => [today() - 6 * DAY, today()] },
  { label: 'Last 14 days', make: () => [today() - 13 * DAY, today()] },
  { label: 'Last 30 days', make: () => [today() - 29 * DAY, today()] },
  { label: 'This month', make: () => { const d = new Date(today()); return [Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1), today()]; } },
  { label: 'Last month', make: () => { const d = new Date(today()); return [Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1), Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0)]; } },
  { label: 'Last 90 days', make: () => [today() - 89 * DAY, today()] },
  { label: 'This year', make: () => { const d = new Date(today()); return [Date.UTC(d.getUTCFullYear(), 0, 1), today()]; } },
];
export const preset = (label: string): Range => { const p = PRESETS.find((x) => x.label === label) ?? PRESETS[3]; const [a, b] = p.make(); return { from: iso(a), to: iso(b), label: p.label }; };

export function DateRange({ value, onChange, className }: { value: Range; onChange: (r: Range) => void; className?: string }) {
  const [open, setOpen] = React.useState(false);
  const [from, setFrom] = React.useState(value.from);
  const [to, setTo] = React.useState(value.to);
  React.useEffect(() => { setFrom(value.from); setTo(value.to); }, [value]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('gap-2', className)}><IconCalendar className="size-4" />{value.label}</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <div className="grid">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" onClick={() => { onChange(preset(p.label)); setOpen(false); }}
              className={cn('rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none', value.label === p.label && 'bg-accent font-medium')}>{p.label}</button>
          ))}
        </div>
        <div className="mt-2 grid gap-2 border-t p-2 pt-3">
          <p className="text-xs font-medium text-muted-foreground">Custom</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1"><Label htmlFor="dr-from" className="text-xs">From</Label><Input id="dr-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="grid gap-1"><Label htmlFor="dr-to" className="text-xs">To</Label><Input id="dr-to" type="date" value={to} min={from} max={iso(Date.now())} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
          <Button size="sm" variant="ink" disabled={!from || !to || from > to} onClick={() => { onChange({ from, to, label: `${new Date(from).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })} – ${new Date(to).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}` }); setOpen(false); }}>Apply</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
