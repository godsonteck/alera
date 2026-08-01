import { Link, Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeSelector } from '@/components/ThemeSelector';
import { useState } from 'react';

type LinkItem = {
  label: string;
  href: string;
};

const navLinks: LinkItem[] = [
  { label: 'Home', href: '/' },
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Trust', href: '/trust' },
];

const MainLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="alera-care-backdrop flex min-h-screen flex-col text-[var(--text-high)]">
      <header className="sticky top-0 z-50 border-b border-slate-700/40 bg-[var(--surface-elevated)]/90 backdrop-blur-md transition-colors">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="alera-focus-ring flex items-center gap-3">
            <img src="/sad.jpg" alt="Alera logo" className="h-8 w-8 rounded-md border border-white/10 bg-white/70 object-cover shadow-[0_2px_10px_rgba(0,0,0,0.15)]" />
            <div>
              <p className="text-sm font-semibold text-[var(--text-high)]">Alera</p>
              <p className="text-[10px] text-[var(--text-medium)]">Care coordination</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-5 lg:flex" aria-label="Primary navigation">
            {navLinks.map((item) => {
              const isActive = location.pathname === item.href || (item.href === '/' && location.pathname === '/');
              return (
                <Link
                  key={item.label}
                  to={item.href}
                  className={`alera-focus-ring border-b-2 px-0 py-2 text-sm transition-colors ${
                    isActive ? 'border-[var(--brand-secondary)] font-semibold text-[var(--brand-secondary)]' : 'border-transparent text-[var(--text-medium)] hover:border-slate-500 hover:text-[var(--text-high)]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <ThemeSelector variant="dropdown" />
            <Button asChild variant="ghost" className="hidden rounded-md px-3 text-sm text-[#4f6154] hover:bg-slate-100 hover:text-[#223127] sm:inline-flex">
              <Link to="/login">Log In</Link>
            </Button>
            <Button asChild className="rounded-md bg-[var(--brand-primary)] px-4 text-sm text-white transition-colors hover:bg-[var(--brand-primary-hover)]">
              <Link to="/signup">Create Account</Link>
            </Button>
            <button onClick={() => setMobileOpen(!mobileOpen)} className="alera-focus-ring ml-1 rounded-md p-2 text-[#4f6154] hover:bg-slate-100 lg:hidden" aria-label="Toggle menu" aria-expanded={mobileOpen}>
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-slate-200 bg-white px-4 py-3 lg:hidden">
            <nav className="flex flex-col gap-1.5">
              {navLinks.map((item) => (
                <Link
                  key={item.label}
                  to={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`alera-focus-ring block px-3 py-2.5 text-sm transition-colors ${
                    location.pathname === item.href ? 'border-l-2 border-[#0b3d62] bg-slate-50 font-semibold text-[#0b3d62]' : 'border-l-2 border-transparent text-[#4f6154] hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <Link to="/login" onClick={() => setMobileOpen(false)} className="alera-focus-ring px-3 py-2.5 text-sm text-[#4f6154] hover:bg-slate-50">Log In</Link>
              <Link to="/signup" onClick={() => setMobileOpen(false)} className="alera-focus-ring px-3 py-2.5 text-sm font-semibold text-[#0b3d62] hover:bg-slate-50">Create Account</Link>
            </nav>
          </div>
        )}
      </header>

      <main className="relative flex-1">
        <Outlet />
      </main>

      <footer className="relative overflow-hidden border-t border-[#23354c] bg-[#102238] text-[#eaf1f7]">
        <div className="relative mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 text-sm sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5 text-[#c7d4df]">
            <img src="/sad.jpg" alt="Alera logo" className="h-4 w-4 rounded-sm object-cover shadow-[0_2px_10px_rgba(0,0,0,0.2)]" />
            <span className="font-semibold tracking-[0.16em] text-white">ALERA</span>
            <span className="hidden text-[#72859a] sm:inline">•</span>
            <span>© 2026 Alera Healthcare Systems Inc.</span>
          </div>
          <div className="flex flex-col gap-3 border-t border-white/15 pt-3 md:flex-row md:items-center md:justify-between">
            <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-1.5 text-[#c7d4df]">
              <Link to="/privacy-policy" className="alera-focus-ring hover:text-white">Privacy</Link>
              <Link to="/terms" className="alera-focus-ring hover:text-white">Terms</Link>
            </nav>
            <div className="flex flex-col gap-1.5 self-start text-xs text-[#c7d4df] md:self-auto md:items-end">
              <div className="inline-flex items-center gap-2">
                <img src="/sad.jpg" alt="Alera logo" className="h-3.5 w-3.5 rounded-sm object-cover" />
                <span className="text-[#72859a]">Powered by</span>
                <span className="font-semibold text-white">Success Above Dreams</span>
              </div>
              <span>Built for clearer care coordination.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;
