import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconChevronDown, IconChevronRight, IconSpeakerphone, IconActivity, IconCreditCard, IconRocket, IconCheck, IconX } from '@tabler/icons-react';
import { useApp } from '@/lib/app-context';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

const KEY = 'isoteh-onboarding';
/** The card in the corner: four steps to a first campaign. It folds away, and goes when every step is done. */
export function OnboardingWidget() {
  const { ws, mode } = useApp();
  const nav = useNavigate();
  const mobile = useIsMobile();
  const [open, setOpen] = React.useState(() => { try { return localStorage.getItem(KEY) !== 'closed'; } catch { return true; } });
  const [gone, setGone] = React.useState(() => { try { return localStorage.getItem(`${KEY}-gone-${ws.org.id}`) === '1'; } catch { return false; } });
  React.useEffect(() => { if (mobile) setOpen(false); }, [mobile]);
  const s = ws.setup;
  const steps = [
    { done: s.campaign, icon: IconSpeakerphone, label: 'Create your first campaign', go: () => nav('/app/campaigns?create=campaign') },
    { done: s.tracking, icon: IconActivity, label: 'Set up tracking', go: () => nav('/app/events?setup=1') },
    { done: s.payment, icon: IconCreditCard, label: 'Add a payment method', go: () => nav('/app/settings?tab=billing') },
    { done: s.launched, icon: IconRocket, label: 'Launch your first campaign', note: 'Create a campaign and add a card first.', locked: !(s.campaign && s.payment), go: () => nav('/app/campaigns') },
  ];
  const n = steps.filter((x) => x.done).length;
  if (mode !== 'advertiser' || gone || n === 4) return null;
  const toggle = () => { const o = !open; setOpen(o); try { localStorage.setItem(KEY, o ? 'open' : 'closed'); } catch { /* private mode */ } };
  return (
    <aside aria-label="Getting started" className={cn('fixed right-3 bottom-3 z-30 w-[calc(100vw-24px)] max-w-[360px] rounded-xl border bg-popover text-popover-foreground shadow-lg sm:right-5 sm:bottom-5')}>
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-3">
        <button type="button" onClick={toggle} aria-expanded={open} className="flex flex-1 items-center gap-2 rounded-md text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <span className="flex-1 text-[15px] font-medium">Get ready for your first campaign</span>
          <span className="text-xs text-muted-foreground tabular">{n}/4</span>
          <IconChevronDown className={cn('size-4 text-muted-foreground transition-transform', !open && '-rotate-90')} />
        </button>
        <button type="button" aria-label="Hide for this organization" onClick={() => { setGone(true); try { localStorage.setItem(`${KEY}-gone-${ws.org.id}`, '1'); } catch { /* */ } }}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"><IconX className="size-3.5" /></button>
      </div>
      <div className="flex gap-1 px-4 pb-3" aria-hidden="true">{steps.map((x, i) => <span key={i} className={cn('h-1 flex-1 rounded-full', x.done ? 'bg-brand' : 'bg-muted')} />)}</div>
      {open && (
        <ul className="px-2 pb-2">
          {steps.map((x) => (
            <li key={x.label} className="border-t first:border-t-0">
              <button type="button" disabled={x.locked && !x.done} onClick={x.go}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:hover:bg-transparent">
                <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full border', x.done && 'border-brand bg-brand text-white')}>{x.done && <IconCheck className="size-3" />}</span>
                <x.icon className={cn('size-4 shrink-0', x.locked && !x.done ? 'text-muted-foreground/60' : 'text-muted-foreground')} />
                <span className="grid flex-1">
                  <span className={cn('text-sm font-medium', x.done && 'text-muted-foreground line-through', x.locked && !x.done && 'text-muted-foreground/70 font-normal')}>{x.label}</span>
                  {x.locked && !x.done && <span className="text-xs text-muted-foreground/70">{x.note}</span>}
                </span>
                {!(x.locked && !x.done) && <IconChevronRight className="size-4 text-muted-foreground" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
