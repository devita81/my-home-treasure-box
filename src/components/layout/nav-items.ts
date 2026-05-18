import {
  BarChart3,
  Home as HomeIcon,
  Wallet,
  Search,
} from "lucide-react";

export interface NavItem {
  to: string;
  /** Label longo — usado na Sidebar do desktop. */
  label: string;
  /** Label curto — usado na tab bar do mobile (cabe embaixo do ícone). */
  shortLabel: string;
  icon: typeof HomeIcon;
  description: string;
}

/**
 * Itens de navegação principais — fonte única, consumida pela
 * `Sidebar` (desktop) e pela `MobileNav` (tab bar inferior). Ordem
 * importa: é a ordem de exibição nos dois lugares.
 *
 * São só os DESTINOS (rotas). Ações (Adicionar imóvel, Consultor IA,
 * conta/logout) ficam fora — vivem no rodapé da Sidebar e no header
 * mobile, não na tab bar.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    to: "/",
    label: "Carteira",
    shortLabel: "Carteira",
    icon: HomeIcon,
    description: "Seus imóveis cadastrados",
  },
  {
    to: "/balancete",
    label: "Balancete",
    shortLabel: "Balancete",
    icon: Wallet,
    description: "Receitas e despesas mês a mês",
  },
  {
    to: "/analytics",
    label: "Analytics",
    shortLabel: "Analytics",
    icon: BarChart3,
    description: "Métricas e visões agregadas",
  },
  {
    to: "/itbi-search",
    label: "Pesquisa de preço",
    shortLabel: "Pesquisa",
    icon: Search,
    description: "Análise pontual ITBI + ZAP + IA",
  },
];
