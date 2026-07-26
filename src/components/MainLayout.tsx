import { Link, Outlet, useLocation } from 'react-router-dom';
import { HeartPulse, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeSelector } from '@/components/ThemeSelector';
import { useState } from 'react';

type LinkItem = {
  label: string;
  href: string;
};

const navLinks: LinkItem[] = [
  { label: 'About', href: '/about' },
  { label: 'Features', href: '/features' },
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Who we help', href: '/who-we-serve' },
  { label: 'Trust', href: '/trust' },
];

const MainLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="alera-care-backdrop flex min-h-screen flex-col text-[#223127]">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/92 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="alera-focus-ring flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#0b3d62] text-white">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#223127]">Alera</p>
              <p className="text-[10px] text-[#6e7d71]">Care coordination</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-5 lg:flex" aria-label="Primary navigation">
            {navLinks.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.label}
                  to={item.href}
                  className={`alera-focus-ring border-b-2 px-0 py-2 text-sm transition-colors ${
                    isActive ? 'border-[#0b3d62] font-semibold text-[#0b3d62]' : 'border-transparent text-[#4f6154] hover:border-slate-300 hover:text-[#223127]'
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
              <Link to="/login">Log in</Link>
            </Button>
            <Button asChild className="rounded-md bg-[#0b3d62] px-4 text-sm text-white transition-colors hover:bg-[#082f4c]">
              <Link to="/signup">Create account</Link>
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
              <Link to="/login" onClick={() => setMobileOpen(false)} className="alera-focus-ring px-3 py-2.5 text-sm text-[#4f6154] hover:bg-slate-50">Log in</Link>
            </nav>
          </div>
        )}
      </header>

      <main className="relative flex-1">
        <Outlet />
      </main>

      <footer className="relative overflow-hidden border-t border-[#23354c] bg-[#102238] text-[#eaf1f7]">
        <div className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.16] mix-blend-screen" style={{ backgroundImage: 'url("/images/hero_medical_team.png")' }} />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 text-sm sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5 text-[#c7d4df]">
            <HeartPulse className="h-4 w-4 text-[#8fd0af]" aria-hidden="true" />
            <span className="font-semibold tracking-[0.16em] text-white">ALERA</span>
            <span className="hidden text-[#72859a] sm:inline">•</span>
            <span>© 2026 Alera Healthcare Systems Inc.</span>
          </div>
          <div className="flex flex-col gap-3 border-t border-white/15 pt-3 md:flex-row md:items-center md:justify-between">
            <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-1.5 text-[#c7d4df]">
              <Link to="/about" className="alera-focus-ring hover:text-white">About</Link>
              <Link to="/how-it-works" className="alera-focus-ring hover:text-white">How it works</Link>
              <Link to="/privacy-policy" className="alera-focus-ring hover:text-white">Privacy</Link>
              <Link to="/terms" className="alera-focus-ring hover:text-white">Terms</Link>
            </nav>
            <div className="inline-flex items-center gap-2 self-start text-xs text-[#c7d4df] md:self-auto">
              <img src="/sad.jpg" alt="Success Above Dreams" className="h-5 w-5 rounded-full object-cover" />
              <span>Powered by Success Above Dreams</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;
