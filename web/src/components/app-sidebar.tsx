import * as React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  IconLayoutDashboard, IconSpeakerphone, IconActivityHeartbeat, IconUsersGroup, IconSettings, IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand, IconLifebuoy, IconBrandSlack, IconSelector, IconCheck, IconPlus, IconCalendarEvent, IconBuildingStore,
  IconCalendarCheck, IconCash, IconChartBar, IconShieldCheck, IconLogout, IconSun, IconMoon, IconDeviceDesktop, IconUser, IconWorldSearch,
} from '@tabler/icons-react';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarSeparator, useSidebar,
} from '@/components/ui/sidebar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useApp } from '@/lib/app-context';
import { useTheme } from '@/lib/theme';
import { api } from '@/lib/api';
import { SupportDialog } from './support-dialog';
import { SlackDialog } from './slack-dialog';
import { CreateOrgDialog } from './create-org-dialog';
import { Mark } from './mark';
import { toast } from 'sonner';

export const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';

const ADVERTISER = [
  { to: '/app/dashboard', label: 'Dashboard', icon: IconLayoutDashboard },
  { to: '/app/campaigns', label: 'Campaigns', icon: IconSpeakerphone },
  { to: '/app/events', label: 'Events Manager', icon: IconActivityHeartbeat },
  { to: '/app/audiences', label: 'Audiences', icon: IconUsersGroup },
  { to: '/app/find', label: 'Find ad space', icon: IconWorldSearch },
];
const PUBLISHER = [
  { to: '/app/dashboard', label: 'Dashboard', icon: IconLayoutDashboard },
  { to: '/app/places', label: 'Places', icon: IconBuildingStore },
  { to: '/app/bookings', label: 'Bookings', icon: IconCalendarCheck },
  { to: '/app/earnings', label: 'Earnings', icon: IconCash },
  { to: '/app/reports', label: 'Reports', icon: IconChartBar },
];

export function AppSidebar() {
  const { ws, mode, setMode, reload, site, signOut } = useApp();
  const { pathname } = useLocation();
  const nav = useNavigate();
  const { toggleSidebar, state, isMobile, setOpenMobile } = useSidebar();
  const { theme, setTheme } = useTheme();
  const [support, setSupport] = React.useState<false | string>(false);
  const [slack, setSlack] = React.useState(false);
  const [newOrg, setNewOrg] = React.useState(false);
  const items = mode === 'publisher' ? PUBLISHER : ADVERTISER;
  const staff = ['staff', 'admin'].includes(ws.me.role);
  const close = () => { if (isMobile) setOpenMobile(false); };
  const active = (to: string) => pathname === to || pathname.startsWith(`${to}/`);

  async function switchOrg(id: string) {
    if (id === ws.org.id) return;
    try { await api('/v1/orgs/switch', { id }); await reload(); nav('/app/dashboard'); toast.success('Switched organization'); } catch (e: any) { toast.error(e.message); }
  }

  const link = (it: { to: string; label: string; icon: React.ComponentType<{ className?: string }> }) => (
    <SidebarMenuItem key={it.to}>
      <SidebarMenuButton asChild isActive={active(it.to)} tooltip={it.label}
        className="h-9 data-[active=true]:shadow-[inset_0_0_0_1px_var(--sidebar-border)] data-[active=true]:bg-background dark:data-[active=true]:bg-sidebar-accent data-[active=true]:[&>svg]:text-brand">
        <Link to={it.to} onClick={close}><it.icon /><span>{it.label}</span></Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 pt-4">
        <Link to="/app/dashboard" onClick={close} className="flex items-center gap-2 px-2 text-[19px] font-semibold tracking-tight group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center">
          <Mark className="size-6 shrink-0" /><span className="group-data-[collapsible=icon]:hidden">{site.brand}</span>
        </Link>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="border bg-background shadow-xs data-[state=open]:bg-sidebar-accent dark:bg-sidebar-accent/40" aria-label="Switch organization">
                  <Avatar className="size-7 rounded-md"><AvatarFallback className="rounded-md bg-brand-soft text-[11px] font-semibold text-brand">{initials(ws.org.name)}</AvatarFallback></Avatar>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate font-medium">{ws.org.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{mode === 'publisher' ? 'Publisher' : 'Advertiser'}</span>
                  </div>
                  <IconSelector className="ml-auto text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-60" align="start" side={isMobile ? 'bottom' : 'right'} sideOffset={6}>
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Organizations</DropdownMenuLabel>
                {ws.orgs.map((o) => (
                  <DropdownMenuItem key={o.id} onSelect={() => switchOrg(o.id)} className="gap-2 py-2">
                    <Avatar className="size-6 rounded-md"><AvatarFallback className="rounded-md text-[10px]">{initials(o.name)}</AvatarFallback></Avatar>
                    <div className="grid flex-1 leading-tight"><span className="truncate">{o.name}</span><span className="text-xs text-muted-foreground">{o.own ? 'Your own account' : o.role === 'admin' ? 'Admin' : 'Member'}</span></div>
                    {o.id === ws.org.id && <IconCheck className="size-4" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem onSelect={() => setNewOrg(true)} className="gap-2 py-2"><IconPlus className="size-4" />Create Organization</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Use {site.brand} as</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={mode} onValueChange={(v) => { setMode(v as 'advertiser' | 'publisher'); nav('/app/dashboard'); close(); }}>
                  <DropdownMenuRadioItem value="advertiser">Advertiser: buy ads</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="publisher">Publisher: sell ad space</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
        <button type="button" onClick={() => setSupport('Book a call')}
          className="rounded-lg border bg-background p-3 text-left shadow-xs transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none group-data-[collapsible=icon]:hidden dark:bg-sidebar-accent/40">
          <span className="mb-2 flex size-7 items-center justify-center rounded-full bg-brand-soft text-brand"><IconCalendarEvent className="size-4" /></span>
          <span className="block text-sm font-medium">Book a call</span>
          <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">20 min with our team</span>
        </button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="pt-1">
          <SidebarMenu className="gap-1">{items.map(link)}</SidebarMenu>
        </SidebarGroup>
        <SidebarSeparator className="mx-4 w-auto" />
        <SidebarGroup>
          <SidebarMenu className="gap-1">
            {staff && link({ to: '/app/review', label: 'Staff review', icon: IconShieldCheck })}
            {link({ to: '/app/settings', label: 'Settings', icon: IconSettings })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="pb-3">
        <SidebarMenu className="gap-1">
          {!isMobile && (
            <SidebarMenuItem>
              <SidebarMenuButton onClick={toggleSidebar} tooltip={state === 'collapsed' ? 'Expand' : 'Collapse'} className="h-9">
                {state === 'collapsed' ? <IconLayoutSidebarLeftExpand /> : <IconLayoutSidebarLeftCollapse />}<span>Collapse</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem><SidebarMenuButton onClick={() => setSupport('')} tooltip="Support" className="h-9"><IconLifebuoy /><span>Support</span></SidebarMenuButton></SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => setSlack(true)} tooltip="Slack" className="h-9">
              <IconBrandSlack className={ws.org.slack ? 'text-brand' : ''} /><span>{ws.org.slack ? 'Slack connected' : 'Connect to Slack'}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator className="mx-2 w-auto" />
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent" aria-label="Your account">
                  <Avatar className="size-8 rounded-full"><AvatarFallback className="rounded-full bg-muted text-xs font-medium">{initials(ws.me.name)}</AvatarFallback></Avatar>
                  <div className="grid flex-1 text-left leading-tight"><span className="truncate font-medium">{ws.me.name}</span><span className="truncate text-xs text-muted-foreground">{ws.me.email}</span></div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="min-w-56" side={isMobile ? 'top' : 'right'} align="end" sideOffset={6}>
                <DropdownMenuLabel className="font-normal"><div className="font-medium">{ws.me.name}</div><div className="text-xs text-muted-foreground">{ws.me.email}</div></DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => { nav('/app/settings'); close(); }}><IconUser />Account settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Theme</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}>
                  <DropdownMenuRadioItem value="light"><IconSun className="size-4" />Light</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark"><IconMoon className="size-4" />Dark</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system"><IconDeviceDesktop className="size-4" />Same as device</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={signOut}><IconLogout />Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SupportDialog open={support !== false} category={support || undefined} onOpenChange={(o) => !o && setSupport(false)} />
      <SlackDialog open={slack} onOpenChange={setSlack} />
      <CreateOrgDialog open={newOrg} onOpenChange={setNewOrg} />
    </Sidebar>
  );
}
