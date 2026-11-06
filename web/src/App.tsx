import * as React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { AppSidebar } from '@/components/app-sidebar';
import { OnboardingWidget } from '@/components/onboarding-widget';
import { Mark } from '@/components/mark';
import { AppCtx, readMode, saveMode } from '@/lib/app-context';
import { api, type Site, type Workspace } from '@/lib/api';
import { SignIn } from '@/pages/sign-in';
import { Dashboard } from '@/pages/dashboard';
import { Campaigns } from '@/pages/campaigns';
import { Events } from '@/pages/events';
import { Audiences } from '@/pages/audiences';
import { Settings } from '@/pages/settings';
import { FindSpace, Places, Bookings, Earnings, Reports, Review, PayPage } from '@/pages/publisher';

export function App() {
  const [site, setSite] = React.useState<Site | null>(null);
  const [ws, setWs] = React.useState<Workspace | null | undefined>(undefined);
  const [mode, setModeState] = React.useState(readMode);
  const loc = useLocation();
  const reload = React.useCallback(async () => {
    try { setWs(await api<Workspace>('/v1/workspace')); } catch (e: any) { if (e.status === 401) setWs(null); else throw e; }
  }, []);
  React.useEffect(() => { api('/v1/me').then((r) => { setSite(r); document.title = r.brand; }).catch(() => setSite({ brand: 'Isoteh' } as Site)); reload(); }, [reload]);
  React.useEffect(() => { const m = loc.pathname.match(/^\/app\/(places|bookings|earnings|reports)/); if (m && mode !== 'publisher') { setModeState('publisher'); saveMode('publisher'); } }, [loc.pathname, mode]);
  const setMode = (m: 'advertiser' | 'publisher') => { setModeState(m); saveMode(m); };
  const signOut = async () => { await api('/v1/auth/logout', {}).catch(() => {}); setWs(null); };

  if (!site || ws === undefined) return <div className="flex min-h-svh items-center justify-center"><Mark className="size-8 animate-pulse" /></div>;
  if (!ws) return <><SignIn site={site} onDone={reload} /><Toaster /></>;
  const sidebarOpen = (() => { try { return localStorage.getItem('sidebar_state') !== 'false'; } catch { return true; } })();
  return (
    <AppCtx.Provider value={{ site, ws, reload, mode, setMode, signOut }}>
      <TooltipProvider delayDuration={300}>
        <SidebarProvider defaultOpen={sidebarOpen}>
          <AppSidebar />
          <SidebarInset className="min-w-0">
            <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur md:hidden">
              <SidebarTrigger aria-label="Open menu" />
              <span className="flex items-center gap-2 font-semibold"><Mark className="size-5" />{site.brand}</span>
              <span className="ml-auto truncate text-xs text-muted-foreground">{ws.org.name}</span>
            </header>
            <main id="main" className="min-w-0 flex-1">
              <Routes>
                <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />
                <Route path="/app/dashboard" element={<Dashboard />} />
                <Route path="/app/campaigns" element={<Campaigns />} />
                <Route path="/app/events" element={<Events />} />
                <Route path="/app/audiences" element={<Audiences />} />
                <Route path="/app/settings" element={<Settings />} />
                <Route path="/app/find" element={<FindSpace />} />
                <Route path="/app/places" element={<Places />} />
                <Route path="/app/bookings" element={<Bookings />} />
                <Route path="/app/earnings" element={<Earnings />} />
                <Route path="/app/reports" element={<Reports />} />
                <Route path="/app/review" element={<Review />} />
                <Route path="/app/pay/:ref" element={<PayPage />} />
                <Route path="/app/money" element={<Navigate to="/app/earnings" replace />} />
                <Route path="/app/ads" element={<Navigate to="/app/campaigns" replace />} />
                <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
              </Routes>
            </main>
          </SidebarInset>
          <OnboardingWidget />
        </SidebarProvider>
        <Toaster position="top-center" />
      </TooltipProvider>
    </AppCtx.Provider>
  );
}
