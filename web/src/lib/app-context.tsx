import * as React from 'react';
import { api, type Site, type Workspace } from './api';

type Mode = 'advertiser' | 'publisher';
type Ctx = { site: Site; ws: Workspace; reload: () => Promise<void>; mode: Mode; setMode: (m: Mode) => void; signOut: () => Promise<void> };
export const AppCtx = React.createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => React.useContext(AppCtx);
export const readMode = (): Mode => { try { return localStorage.getItem('isoteh-mode') === 'publisher' ? 'publisher' : 'advertiser'; } catch { return 'advertiser'; } };
export const saveMode = (m: Mode) => { try { localStorage.setItem('isoteh-mode', m); } catch { /* private mode */ } };
export { api };
