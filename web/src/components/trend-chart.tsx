import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { cn } from '@/lib/utils';

/** A soft wave shown behind an empty chart, so the page shows what will be there. */
export function GhostWave({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1000 220" preserveAspectRatio="none" className={cn('h-full w-full', className)} aria-hidden="true">
      <path d="M0 190 C120 170 200 120 330 135 S520 190 640 120 S820 40 900 70 S980 20 1000 5 V220 H0Z" fill="var(--muted)" opacity="0.8" />
      <path d="M0 190 C120 170 200 120 330 135 S520 190 640 120 S820 40 900 70 S980 20 1000 5" fill="none" stroke="var(--border)" strokeWidth="2" />
    </svg>
  );
}

export function TrendChart({ data, keys, format, height = 260, hourly }: {
  data: Record<string, any>[]; keys: { key: string; label: string; color?: string }[]; format?: (v: number) => string; height?: number; hourly?: boolean;
}) {
  const config = Object.fromEntries(keys.map((k, i) => [k.key, { label: k.label, color: k.color ?? `var(--chart-${i + 1})` }])) satisfies ChartConfig;
  const tick = (v: string) => hourly ? `${v.slice(11, 13)}:00` : new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <AreaChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <defs>
          {keys.map((k) => (
            <linearGradient key={k.key} id={`fill-${k.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={`var(--color-${k.key})`} stopOpacity={0.22} />
              <stop offset="95%" stopColor={`var(--color-${k.key})`} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="k" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} tickFormatter={tick} />
        <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v) => (format ? format(v) : new Intl.NumberFormat(undefined, { notation: 'compact' }).format(v))} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(v) => tick(String(v))} formatter={(v, n) => (
          <div className="flex w-full justify-between gap-4"><span className="text-muted-foreground">{config[String(n)]?.label}</span><span className="font-medium tabular">{format ? format(Number(v)) : new Intl.NumberFormat().format(Number(v))}</span></div>
        )} />} />
        {keys.map((k) => <Area key={k.key} dataKey={k.key} type="monotone" stroke={`var(--color-${k.key})`} strokeWidth={2} fill={`url(#fill-${k.key})`} />)}
      </AreaChart>
    </ChartContainer>
  );
}
