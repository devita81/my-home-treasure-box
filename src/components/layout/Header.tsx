import { Home, BarChart3, PlusCircle, LogOut, MessageSquare } from 'lucide-react';
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
    { path: '/', label: 'Coleção', icon: Home },
    { path: '/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/add', label: 'Adicionar', icon: PlusCircle },
  ];

  const handleLogout = async () => {
    await signOut();
    toast.success('Logout realizado com sucesso');
    navigate('/auth');
  };

  return (
    <>
      <header className="sticky top-0 z-50 glass-effect border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform group-hover:scale-105">
                <Home className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-display text-xl font-semibold text-foreground">
                  My Home Collection
                </span>
                <span className="text-xs text-muted-foreground">
                  Gestão de Imóveis
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-4">
              <nav className="flex items-center gap-1">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setChatOpen(true)}
                className="text-muted-foreground hover:text-foreground"
                title="Assistente IA"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">IA</span>
              </Button>

              {user && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Sair</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <GlobalAIChatDialog open={chatOpen} onOpenChange={setChatOpen} />
    </>
  );
}
