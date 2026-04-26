import { Home, BarChart3, PlusCircle, LogOut, Sparkles, Database, Wallet } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useState } from 'react';
import { GlobalAIChatDialog } from '@/components/GlobalAIChatDialog';

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);

  const navItems = [
    { path: '/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/balancete', label: 'Balancete', icon: Wallet },
    { path: '/itbi-search', label: 'ITBI', icon: Database },
  ];

  const handleLogout = async () => {
    await signOut();
    toast.success('Logout realizado com sucesso');
    navigate('/auth');
  };

  return (
    <>
      <header
        className="sticky top-0 z-50 isolate border-b border-border bg-background shadow-sm"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
      >
        <div className="container mx-auto px-3 sm:px-4">
          <div className="flex h-12 sm:h-16 items-center gap-2">
            <Link to="/" className="flex items-center gap-2 sm:gap-3 group min-w-0 shrink-0" title="Início" aria-label="Início">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform group-hover:scale-105 shrink-0">
                <Home className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="flex-col min-w-0 hidden lg:flex">
                <span className="font-display text-base sm:text-xl font-semibold text-foreground truncate">
                  My Home Collection
                </span>
                <span className="text-[10px] sm:text-xs text-muted-foreground">
                  Gestão de Imóveis
                </span>
              </div>
            </Link>

            <div className="flex flex-1 items-center justify-end gap-1 sm:gap-2 min-w-0">
              <nav className="flex flex-1 sm:flex-none items-center justify-around sm:justify-end gap-1 min-w-0">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  const isHighlighted = item.path === '/analytics' || item.path === '/itbi-search' || item.path === '/balancete';
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        'flex items-center justify-center flex-1 sm:flex-none h-9 sm:w-auto sm:gap-2 sm:px-4 rounded-lg text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : isHighlighted
                            ? 'bg-primary/10 text-primary hover:bg-primary/20 ring-1 ring-primary/30'
                            : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                      )}
                      title={item.label}
                      aria-label={item.label}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{item.label}</span>
                    </Link>
                  );
                })}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setChatOpen(true)}
                  className="bg-gradient-to-br from-primary/15 to-primary/5 text-primary hover:from-primary/25 hover:to-primary/10 ring-1 ring-primary/30 flex-1 sm:flex-none h-9 sm:w-auto sm:px-3 p-0 sm:p-2"
                  title="Assistente IA"
                  aria-label="Assistente IA"
                >
                  <Sparkles className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">IA</span>
                </Button>

                <Link to="/add" title="Adicionar Imóvel" aria-label="Adicionar Imóvel" className="flex-1 sm:flex-none">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="bg-primary/10 text-primary hover:bg-primary/20 ring-1 ring-primary/30 w-full sm:w-auto sm:px-3 h-9 p-0 sm:p-2"
                  >
                    <PlusCircle className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Adicionar</span>
                  </Button>
                </Link>

                {user && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="text-muted-foreground hover:text-foreground hover:bg-destructive/10 hover:text-destructive flex-1 sm:flex-none h-9 sm:w-auto sm:px-3 p-0 sm:p-2"
                    title="Sair"
                    aria-label="Sair"
                  >
                    <LogOut className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Sair</span>
                  </Button>
                )}
              </nav>
            </div>
          </div>
        </div>
      </header>

      <GlobalAIChatDialog open={chatOpen} onOpenChange={setChatOpen} />
    </>
  );
}
