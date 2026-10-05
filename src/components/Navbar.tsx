import { Compass, Home, Info, LayoutDashboard, LogIn, Moon, Search, Sun, User as UserIcon } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useUi } from '../context/UiContext'
import { cn } from '../lib/utils'
import Logo from './Logo'

const links = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/discover', label: 'Discover', icon: Compass },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/about', label: 'About', icon: Info },
]

export default function Navbar() {
  const { theme, toggleTheme } = useUi()
  const { user, isAdmin } = useAuth()

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/85 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/85">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'rounded-full px-4 py-2 text-sm font-medium transition',
                    isActive ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white',
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button className="btn-ghost p-2" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            {isAdmin && (
              <Link to="/admin" className="btn-outline hidden px-3 sm:inline-flex">
                <LayoutDashboard className="size-4" /> Admin
              </Link>
            )}
            {user ? (
              <Link to="/account" className="btn-dark px-3" aria-label="My account">
                <UserIcon className="size-4" />
                <span className="hidden max-w-28 truncate sm:inline">{user.name.split(' ')[0]}</span>
              </Link>
            ) : (
              <Link to="/login" className="btn-dark px-3">
                <LogIn className="size-4" /> Login
              </Link>
            )}
          </div>
        </div>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden dark:border-neutral-800 dark:bg-neutral-950"
        aria-label="Mobile"
      >
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            className={({ isActive }) =>
              cn('flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold uppercase tracking-wide', isActive ? 'text-neutral-900 dark:text-white' : 'text-neutral-400')
            }
          >
            <l.icon className="size-5" />
            {l.label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
