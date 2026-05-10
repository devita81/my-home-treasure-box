import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Home as HomeIcon,
  LogOut,
  PlusCircle,
  Sparkles,
  Wallet,
  Search,
  ChevronLeft,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { GlobalAIChatDialog } from "@/components/GlobalAIChatDialog";
import { toast } from "sonner";

interface NavItem {
  to: string;
  label: string;
  icon: typeof HomeIcon;
  description: string;
}

/** Itens de navegação principais. Ordem importa — primeiro no topo. */
const NAV_ITEMS: NavItem[] = [
  {
    to: "/",
    label: "Carteira",
    icon: HomeIcon,
    description: "Seus imóveis cadastrados",
  },
  {
    to: "/balancete",
    label: "Balancete",
    icon: Wallet,
    description: "Receitas e despesas mês a mês",
  },
  {
    to: "/analytics",
    label: "Analytics",
    icon: BarChart3,
    description: "Métricas e visões agregadas",
  },
  {
    to: "/itbi-search",
    label: "Pesquisa de preço",
    icon: Search,
    description: "Análise pontual ITBI + ZAP + IA",
  },
];

interface SidebarProps {
  /** Quando true, sidebar fica visível (mobile drawer aberto). */
  open: boolean;
  onClose: () => void;
}

/**
 * Navegação principal do app — sidebar fixo à esquerda no desktop,
 * drawer no mobile. Substitui o `<Header />` antigo que tinha tudo
 * empilhado horizontalmente.
 *
 * Estrutura:
 *   • Topo: logo + título
 *   • Meio: nav vertical com labels descritivos (não só ícones)
 *   • Rodapé: botão primário "+ Imóvel", chat IA, menu de conta
 *
 * Cor primária roxa mantida na identidade. Item ativo destacado com
 * background sólido roxo.
 */
export function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    toast.success("Logout realizado");
    navigate("/auth");
  };

  return (
    <>
      {/* Backdrop no mobile quando drawer aberto */}
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card shadow-sm transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Topo: logo + título */}
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3.5">
          <Link
            to="/"
            className="group flex min-w-0 items-center gap-2.5"
            onClick={onClose}
            aria-label="Início"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform group-hover:scale-105">
              <HomeIcon className="h-4 w-4" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="font-display truncate text-[15px] font-semibold text-foreground">
                My Home Collection
              </span>
              <span className="truncate text-[11px] text-muted-foreground">
                Gestão de Imóveis
              </span>
            </div>
          </Link>
          {/* Botão pra fechar no mobile */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-7 w-7 shrink-0 p-0 lg:hidden"
            aria-label="Fechar menu"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Nav principal — ocupa espaço disponível */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.to === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.to);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onClose}
                    title={item.description}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-foreground/80 hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Separador + IA (ação leve, separada da nav principal) */}
          <div className="my-3 border-t border-border/60" />
          <button
            type="button"
            onClick={() => {
              setChatOpen(true);
              onClose();
            }}
            className="flex w-full items-center gap-2.5 rounded-md bg-gradient-to-r from-primary/10 to-primary/5 px-2.5 py-2 text-sm font-medium text-primary ring-1 ring-primary/20 transition-colors hover:from-primary/20 hover:to-primary/10"
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>Assistente IA</span>
          </button>
        </nav>

        {/* Rodapé: ação primária + menu de conta */}
        <div className="border-t border-border/60 p-3 space-y-2">
          <Link to="/add" onClick={onClose}>
            <Button className="w-full justify-start gap-2" size="sm">
              <PlusCircle className="h-4 w-4" />
              Adicionar imóvel
            </Button>
          </Link>
          {user ? (
            <div className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[12px] text-muted-foreground">
              <span className="truncate" title={user.email ?? ""}>
                {user.email ?? "—"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title="Sair"
                aria-label="Sair"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null}
        </div>
      </aside>

      <GlobalAIChatDialog open={chatOpen} onOpenChange={setChatOpen} />
    </>
  );
}

interface SidebarTriggerProps {
  onClick: () => void;
}

/**
 * Botão de hambúrguer pra abrir o sidebar no mobile. Renderizado no
 * topo de cada página dentro do `<AppLayout>` apenas em telas pequenas
 * (sidebar fica sempre visível no desktop).
 */
export function SidebarTrigger({ onClick }: SidebarTriggerProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="h-9 w-9 shrink-0 p-0 lg:hidden"
      aria-label="Abrir menu"
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
}
