'use client';

import React, { useState, useEffect, useRef } from 'react';
import { TabId } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  MessageSquareText,
  KanbanSquare,
  Calendar,
  ClockAlert,
  Zap,
  BarChart3,
  Settings,
  ShieldCheck,
  Sparkles,
  Lock,
  Users,
  Users2,
  Archive,
  ChevronsRight,
  ChevronsLeft,
} from "lucide-react";

interface SidebarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  pendingCount?: number;
  unreadMessagesCount?: number;
  /**
   * Controle de exibição em telas pequenas — correção de
   * responsividade (o menu ficava sempre visível em 256px fixos,
   * sobrepondo/empurrando todo o conteúdo em telas de celular). Em
   * telas grandes (lg: e acima) o Sidebar ignora esses props e
   * permanece sempre visível, como antes.
   */
  isOpenOnMobile?: boolean;
  onCloseMobile?: () => void;
}

const COLLAPSE_STORAGE_KEY = 'mediflux_sidebar_collapsed';
// Tempo de toque prolongado para mostrar o tooltip em telas sensíveis
// ao toque, quando não há "hover" de mouse disponível — pedido
// explícito do usuário: 2 segundos.
const LONG_PRESS_MS = 2000;

export function Sidebar({
  activeTab,
  onSelectTab,
  pendingCount = 2,
  unreadMessagesCount = 1,
  isOpenOnMobile = false,
  onCloseMobile,
}: SidebarProps) {
  const { hasPermission, user } = useAuth();

  /**
   * Menu recolhido (só ícones) — preferência persistida em
   * localStorage para não voltar ao estado expandido a cada
   * navegação/recarregamento de página. Em mobile (isOpenOnMobile),
   * o recolhido é ignorado de propósito: numa tela pequena, um menu
   * de só-ícones sobreposto não ganha espaço útil e complica a
   * experiência de toque — o Sidebar mobile continua sempre expandido.
   */
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(COLLAPSE_STORAGE_KEY) : null;
    if (stored === 'true') setIsCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));
      return next;
    });
  };

  // Tooltip ativo (por hover de mouse OU por toque prolongado de 2s) —
  // guarda o id do item cujo tooltip deve aparecer, ou null se nenhum.
  const [tooltipItemId, setTooltipItemId] = useState<TabId | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = (id: TabId) => {
    longPressTimerRef.current = setTimeout(() => setTooltipItemId(id), LONG_PRESS_MS);
  };
  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setTooltipItemId(null);
  };

  const menuItems: {
    id: TabId;
    label: string;
    icon: any;
    badge?: number | string;
    badgeColor?: string;
    description: string;
  }[] = [
    {
      id: "visao_geral",
      label: "Visão Geral",
      icon: LayoutDashboard,
      description: "KPIs e status operacional",
    },
    {
      id: "atendimentos",
      label: "Atendimentos",
      icon: MessageSquareText,
      badge: unreadMessagesCount,
      badgeColor: "bg-sky-500 text-white",
      description: "Chat multi-canal e triagem",
    },
    {
      id: "conversas_arquivadas",
      label: "Conversas Arquivadas",
      icon: Archive, // importar de 'lucide-react'
      description: "Histórico de atendimentos finalizados",
    },
    {
      id: "jornadas",
      label: "Jornadas & Funis",
      icon: KanbanSquare,
      description: "Kanban e etapas clínicas",
    },
    {
      id: "agenda",
      label: "Agenda",
      icon: Calendar,
      description: "Calendário de consultas",
    },
    {
      id: "contatos",
      label: "Contatos",
      icon: Users2,
      description: "Pacientes, leads e outros contatos",
    },
    {
      id: "pendencias",
      label: "Pendências & SLA",
      icon: ClockAlert,
      badge: pendingCount,
      badgeColor: "bg-rose-500 text-white",
      description: "Avisos e violações de SLA",
    },
    {
      id: "automacoes",
      label: "Automações",
      icon: Zap,
      description: "Regras de disparo e Manchester",
    },
    {
      id: "indicadores",
      label: "Indicadores & Uso",
      icon: BarChart3,
      description: "Métricas, IA e faturamento",
    },
    {
      id: "configuracoes",
      label: "Configurações",
      icon: Settings,
      description: "10 áreas de controle e PEP",
    },
    {
      id: "usuarios",
      label: "Usuários",
      icon: Users,
      description: "Gestão de contas e permissões",
    },
    {
      id: "auditoria_lgpd",
      label: "Auditoria LGPD",
      icon: ShieldCheck,
      description: "Trilha imutável e consentimento",
    },
    {
      id: "analise_inteligente",
      label: "IA Dual & Triage Lab",
      icon: Sparkles,
      badge: "DUAL AI",
      badgeColor: "bg-purple-100 text-purple-700 border border-purple-300",
      description: "Bedrock + Gemini + Heurística",
    },
  ];

  // Em mobile, o recolhido nunca se aplica (ver comentário acima) —
  // isCollapsed só tem efeito visual quando isOpenOnMobile é false.
  const effectivelyCollapsed = isCollapsed && !isOpenOnMobile;

  return (
    <>
      {/* Overlay escuro atrás do menu, só em mobile quando aberto — toca para fechar */}
      {isOpenOnMobile && (
        <div
          className="lg:hidden fixed inset-0 bg-slate-900/50 z-40"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          ${effectivelyCollapsed ? 'w-16' : 'w-64'} shrink-0 bg-slate-900 text-slate-300 flex flex-col justify-between border-r border-slate-800 select-none
          fixed lg:static inset-y-0 left-0 z-50 lg:z-auto
          transform transition-[transform,width] duration-200 ease-in-out
          ${isOpenOnMobile ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
          min-h-screen lg:min-h-[calc(100vh-61px)]
          overflow-y-auto overflow-x-hidden
        `}
      >
        {/* Navigation Links */}
        <div className="p-3 space-y-1">
          {!effectivelyCollapsed && (
            <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Módulos do Sistema
            </div>
          )}

          {menuItems.map((item) => {
            const isPermitted = hasPermission(item.id);
            const isActive = activeTab === item.id;
            const showTooltip = effectivelyCollapsed && tooltipItemId === item.id;

            return (
              <div key={item.id} className="relative">
                <button
                  onClick={() => {
                    onSelectTab(item.id);
                    onCloseMobile?.();
                  }}
                  onMouseEnter={() => effectivelyCollapsed && setTooltipItemId(item.id)}
                  onMouseLeave={() => effectivelyCollapsed && setTooltipItemId(null)}
                  onTouchStart={() => effectivelyCollapsed && handleTouchStart(item.id)}
                  onTouchEnd={clearLongPress}
                  onTouchCancel={clearLongPress}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group relative ${
                    effectivelyCollapsed ? 'justify-center px-0' : ''
                  } ${
                    isActive
                      ? 'bg-sky-600 text-white font-semibold shadow-md shadow-sky-900/30'
                      : isPermitted
                      ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      : 'text-slate-500 hover:bg-slate-800/40 cursor-not-allowed opacity-60'
                  }`}
                  id={`nav-tab-${item.id}`}
                >
                  <div className={`flex items-center gap-2.5 truncate ${effectivelyCollapsed ? 'relative' : ''}`}>
                    <item.icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-white' : isPermitted ? 'text-slate-400 group-hover:text-white' : 'text-slate-600'
                      }`}
                    />
                    {!effectivelyCollapsed && <span className="truncate">{item.label}</span>}
                    {/* Recolhido: badge vira um pontinho colorido no canto do ícone, sem número (não cabe legível) */}
                    {effectivelyCollapsed && item.badge !== undefined && isPermitted && (
                      <span
                        className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                          item.badgeColor?.includes('rose') ? 'bg-rose-500' : item.badgeColor?.includes('purple') ? 'bg-purple-400' : 'bg-sky-500'
                        }`}
                      />
                    )}
                  </div>

                  {!effectivelyCollapsed && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isPermitted && <Lock className="w-3.5 h-3.5 text-slate-500" />}
                      {item.badge !== undefined && isPermitted && (
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md leading-none ${
                            item.badgeColor || 'bg-slate-700 text-slate-200'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}
                </button>

                {/* Tooltip — só existe quando o menu está recolhido */}
                {showTooltip && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 px-2.5 py-1.5 bg-slate-800 text-white text-[11px] font-semibold rounded-lg shadow-lg whitespace-nowrap pointer-events-none">
                    {item.label}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-800" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer: botão de recolher/expandir + status multi-tenant */}
        <div className="p-3 space-y-3">
          {/* Botão de recolher/expandir — só faz sentido em telas grandes, onde o Sidebar fixo ocupa espaço permanente */}
          <button
            onClick={toggleCollapsed}
            className={`hidden lg:flex w-full items-center rounded-xl text-slate-400 hover:bg-slate-800/60 hover:text-white transition-colors py-2 ${
              effectivelyCollapsed ? 'justify-center' : 'justify-between px-3'
            }`}
            title={effectivelyCollapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {!effectivelyCollapsed && <span className="text-[11px] font-semibold">Recolher menu</span>}
            {effectivelyCollapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
          </button>

          {!effectivelyCollapsed && (
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/60 text-[11px] p-3">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span>Isolamento Multi-Tenant</span>
                <span className="text-emerald-400 font-semibold">Ativo</span>
              </div>
              <div className="text-slate-500 leading-tight">
                Sessão segura vinculada ao ID da clínica: <span className="font-mono text-slate-400">{user?.clinicId}</span>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
