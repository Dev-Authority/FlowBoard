'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';

const links = [
  { href: '/',          label: 'Board'     },
  { href: '/calendar',  label: 'Calendar'  },
  { href: '/plan',      label: 'Plan'      },
  { href: '/review',    label: 'Review'    },
  { href: '/recurring', label: 'Recurring' },
  { href: '/stats',     label: 'Stats'     },
  { href: '/display',   label: 'Display'   },
];

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { theme, toggle } = useTheme();

  if (pathname === '/display') return null;

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 h-12 flex items-center px-4 gap-0.5"
      style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-line)',
      }}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-1.5 mr-5 shrink-0 group">
        <span className="text-base font-bold tracking-tight" style={{ color: 'var(--color-ink)' }}>
          Flow
        </span>
        <span
          className="text-base font-bold tracking-tight px-1 rounded"
          style={{ background: 'var(--color-accent)', color: '#fff' }}
        >
          Board
        </span>
      </Link>

      {/* Nav links */}
      <div className="flex items-center gap-0.5 flex-1 overflow-x-auto scrollbar-hide">
        {links.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="relative px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all duration-150"
              style={{
                color: active ? 'var(--color-accent)' : 'var(--color-muted)',
                background: active ? 'rgba(59,130,246,0.1)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--color-ink)';
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)';
              }}
            >
              {label}
              {active && (
                <span
                  className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                  style={{ background: 'var(--color-accent)' }}
                />
              )}
            </Link>
          );
        })}
      </div>

      {/* Theme toggle */}
      <button
        onClick={toggle}
        className="ml-2 shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150"
        style={{
          background: 'var(--color-raised)',
          color: 'var(--color-muted)',
          border: '1px solid var(--color-line)',
        }}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-ink)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)'; }}
      >
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="ml-1 shrink-0 px-2.5 h-8 rounded-lg text-xs font-medium transition-all duration-150"
        style={{
          background: 'var(--color-raised)',
          color: 'var(--color-muted)',
          border: '1px solid var(--color-line)',
        }}
        title="Sign out"
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#f87171'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)'; }}
      >
        Sign out
      </button>
    </nav>
  );
}
