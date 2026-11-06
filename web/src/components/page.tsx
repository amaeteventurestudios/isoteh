import * as React from 'react';
import { cn } from '@/lib/utils';

export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-[1180px] px-4 pt-6 pb-40 sm:px-8 sm:pt-9', className)}>{children}</div>;
}
export function PageHeader({ title, actions, children }: { title: string; actions?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h1 className="text-[28px] font-semibold tracking-tight sm:text-[32px]">{title}</h1>{children}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
export function Section({ title, description, action, children, className }: { title?: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border bg-card p-5 shadow-xs sm:p-6', className)}>
      {(title || action) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><h2 className="text-base font-medium">{title}</h2>{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}</div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
/** The faint table that sits behind an empty state, like a sketch of what will be there. */
export function GhostRows({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div aria-hidden="true" className="pointer-events-none select-none">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border/60 px-4 py-4 opacity-60">
          <div className="h-3 w-16 rounded bg-muted" /><div className="size-4 rounded bg-muted" />
          <div className="grid flex-1 gap-1.5"><div className="h-3 rounded bg-muted" style={{ width: `${30 + ((i * 17) % 30)}%` }} /><div className="h-2 w-1/5 rounded bg-muted/70" /></div>
          {Array.from({ length: cols - 3 }, (_, j) => <div key={j} className="hidden h-3 w-14 rounded bg-muted sm:block" />)}
        </div>
      ))}
    </div>
  );
}
export function Empty({ title, text, action, children }: { title: string; text?: string; action?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-transparent via-background/70 to-transparent px-6 text-center">
        <p className="font-medium">{title}</p>
        {text && <p className="mt-1 max-w-md text-sm text-muted-foreground">{text}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}
