import * as React from 'react';

type Theme = 'light' | 'dark' | 'system';
const Ctx = React.createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({ theme: 'system', setTheme: () => {} });
const read = (): Theme => { try { return (localStorage.getItem('isoteh-theme') as Theme) || 'system'; } catch { return 'system'; } };

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, set] = React.useState<Theme>(read);
  React.useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && mq.matches));
    apply(); mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
  const setTheme = (t: Theme) => { try { localStorage.setItem('isoteh-theme', t); } catch { /* private mode */ } set(t); };
  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}
export const useTheme = () => React.useContext(Ctx);
