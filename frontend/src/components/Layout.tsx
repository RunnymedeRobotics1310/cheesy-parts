import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Settings, LogOut, FolderKanban, Package, Users, ShoppingCart, Sun, Moon, Monitor } from 'lucide-react';
import { Button } from '@/components/shared';
import { authApi, getAuthSession } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = getAuthSession();
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  const handleLogout = () => {
    authApi.logout();
    navigate('/login');
  };

  const navItems = [
    { href: '/projects', label: 'Projects', icon: FolderKanban },
    { href: '/dashboards', label: 'Dashboards', icon: Package },
    { href: '/orders', label: 'Orders', icon: ShoppingCart },
  ];

  // Add Users link for admins
  if (session?.user?.permission === 'admin') {
    navItems.push({ href: '/users', label: 'Users', icon: Users });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <Link to="/" className="mr-6 flex items-center space-x-2">
            <Package className="h-6 w-6" />
            <span className="font-bold">Cheesy Parts</span>
          </Link>

          <nav className="flex items-center space-x-6 text-sm font-medium flex-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-center space-x-1 transition-colors hover:text-foreground/80',
                  location.pathname.startsWith(item.href)
                    ? 'text-foreground'
                    : 'text-foreground/60'
                )}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">
              {session?.user?.firstName} {session?.user?.lastName}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={cycleTheme}
              title={`Theme: ${theme}`}
            >
              <ThemeIcon className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <Link to="/change-password">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container py-6">
        <Outlet />
      </main>
    </div>
  );
}
