import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bot, Home as HomeIcon, LogOut, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { GlobalAIChatDialog } from "@/components/GlobalAIChatDialog";
import { APP_VERSION } from "@/lib/app-version";
import { NAV_ITEMS } from "./nav-items";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";

/**
 * Navegação mobile estilo "app nativo" (referência: PetICare).
 * Substitui, em telas < lg, o antigo header slim com hambúrguer +
 * drawer da Sidebar. No desktop continua valendo a `<Sidebar />`.
 *
 * Duas peças, ambas fixas e com safe-area do iOS:
 *   1. Header superior colorido (bg-primary): logo à esquerda,
 *      badge de versão + ações (conta/IA/logout) à direita.
 *   2. Tab bar inferior: os 4 destinos principais (NAV_ITEMS) com
 *      ícone + label, item ativo destacado na cor primária.
 *
 * "Adicionar imóvel" fica como botão no header (ação primária
 * frequente). "Consultor IA" e "Sair" ficam no dropdown da conta —
 * mantém a tab bar limpa com só os 4 destinos (igual referência).
 */
export function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    toast.success("Logout realizado");
    navigate("/auth");
  };

  const email = user?.email ?? "";
  const initial = email.trim().charAt(0).toUpperCase() || "U";

  return (
    <>
      {/* ─── Header superior colorido ───────────────────────────────
          `pt-safe-top` estende o bg-primary pra dentro da notch do
          iOS (Dynamic Island) — sem isso o logo fica coberto no PWA. */}
      <header className="sticky top-0 z-30 bg-primary text-primary-foreground pt-safe-top lg:hidden">
        <div className="flex h-14 items-center justify-between gap-2 px-4">
          <Link
            to="/"
            className="group flex min-w-0 items-center gap-2.5"
            aria-label="Início"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15 transition-transform group-active:scale-95">
              <HomeIcon className="h-4 w-4" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="font-display truncate text-base font-semibold leading-tight">
                My Home Collection
              </span>
              <span className="truncate text-meta text-primary-foreground/70 leading-tight">
                Gestão de Imóveis
              </span>
            </div>
          </Link>

          <div className="flex shrink-0 items-center gap-1.5">
            {/* Badge de versão — equivalente ao pill "vbe2bc2e" da
                referência. Confirma deploy num relance. */}
            <span className="rounded-full bg-primary-foreground/10 px-2 py-1 font-mono text-nano font-medium text-primary-foreground/80">
              {APP_VERSION}
            </span>

            {/* Ação primária: adicionar imóvel */}
            <Link
              to="/add"
              aria-label="Adicionar imóvel"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/15 transition-colors active:bg-primary-foreground/25"
            >
              <PlusCircle className="h-5 w-5" />
            </Link>

            {/* Conta — avatar com dropdown (IA, email, sair) */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="rounded-full outline-none ring-offset-0 focus-visible:ring-2 focus-visible:ring-primary-foreground/50"
                aria-label="Conta"
              >
                <Avatar className="h-9 w-9 border border-primary-foreground/25">
                  <AvatarFallback className="bg-primary-foreground/15 text-sm font-semibold text-primary-foreground">
                    {initial}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {email ? (
                  <>
                    <DropdownMenuLabel className="truncate text-label font-normal text-muted-foreground">
                      {email}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                  </>
                ) : null}
                <DropdownMenuItem onSelect={() => setChatOpen(true)}>
                  <Bot className="mr-2 h-4 w-4" />
                  Consultor IA
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={handleLogout}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* ─── Tab bar inferior ───────────────────────────────────────
          `pb-safe-bottom` compensa o home indicator do iPhone — sem
          isso a barra preta cobre os labels no PWA. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-safe-bottom lg:hidden"
        aria-label="Navegação principal"
      >
        <ul className="flex items-stretch">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.to);
            return (
              <li key={item.to} className="flex-1">
                <Link
                  to={item.to}
                  aria-label={item.label}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 py-2 transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground active:text-foreground",
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5 shrink-0",
                      isActive && "stroke-[2.5]",
                    )}
                  />
                  <span
                    className={cn(
                      "text-nano leading-none",
                      isActive ? "font-semibold" : "font-medium",
                    )}
                  >
                    {item.shortLabel}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <GlobalAIChatDialog open={chatOpen} onOpenChange={setChatOpen} />
    </>
  );
}
