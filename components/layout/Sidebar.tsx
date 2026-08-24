'use client';

import React from 'react';
import { TabId } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  MessageSquareText,
  KanbanSquare,
  ClockAlert,
  Zap,
  BarChart3,
  Settings,
  ShieldCheck,
  Sparkles,
  Lock,
  Globe,
} from 'lucide-react';

interface SidebarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  pendingCount?: number;
  unreadMessagesCount?: number;
}

export function Sidebar({
  activeTab,
  onSelectTab,
  pendingCount = 2,
  unreadMessagesCount = 1,
}: SidebarProps) {
  const { hasPermission, user } = useAuth();

  const menuItems: {
    id: TabId;
    label: string;
    icon: any;
    badge?: number | string;
    badgeColor?: string;
    description: string;
  }[] = [
    {
      id: 'landing_page',
      label: 'Landing Page (Site)',
      icon: Globe,
      badge: 'PRODUTO',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
      description: 'Página pública do MediFlux CRM',
    },
    {
      id: 'visao_geral',
      label: 'Visão Geral',
      icon: LayoutDashboard,
      description: 'KPIs e status operacional',
    },
    {
      id: 'atendimentos',
      label: 'Atendimentos',
      icon: MessageSquareText,
      badge: unreadMessagesCount,
      badgeColor: 'bg-sky-500 text-white',
      description: 'Chat multi-canal e triagem',
    },
    {
      id: 'jornadas',
      label: 'Jornadas & Funis',
      icon: KanbanSquare,
      description: 'Kanban e etapas clínicas',
    },
    {
      id: 'pendencias',
      label: 'Pendências & SLA',
      icon: ClockAlert,
      badge: pendingCount,
      badgeColor: 'bg-rose-500 text-white',
      description: 'Avisos e violações de SLA',
    },
    {
      id: 'automacoes',
      label: 'Automações',
      icon: Zap,
      description: 'Regras de disparo e Manchester',
    },
    {
      id: 'indicadores',
      label: 'Indicadores & Uso',
      icon: BarChart3,
      description: 'Métricas, IA e faturamento',
    },
    {
      id: 'configuracoes',
      label: 'Configurações',
      icon: Settings,
      description: '10 áreas de controle e PEP',
    },
    {
      id: 'auditoria_lgpd',
      label: 'Auditoria LGPD',
      icon: ShieldCheck,
      description: 'Trilha imutável e consentimento',
    },
    {
      id: 'analise_inteligente',
      label: 'IA Dual & Triage Lab',
      icon: Sparkles,
      badge: 'DUAL AI',
      badgeColor: 'bg-purple-100 text-purple-700 border border-purple-300',
      description: 'Bedrock + Gemini + Heurística',
    },
  ];

  return (
    <aside className="w-64 shrink-0 bg-slate-900 text-slate-300 flex flex-col justify-between border-r border-slate-800 select-none min-h-[calc(100vh-61px)]">
      {/* Navigation Links */}
      <div className="p-3 space-y-1">
        <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Módulos do Sistema
        </div>

        {menuItems.map((item) => {
          const isPermitted = hasPermission(item.id);
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group relative ${
                isActive
                  ? 'bg-sky-600 text-white font-semibold shadow-md shadow-sky-900/30'
                  : isPermitted
                  ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  : 'text-slate-500 hover:bg-slate-800/40 cursor-not-allowed opacity-60'
              }`}
              id={`nav-tab-${item.id}`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <item.icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-white' : isPermitted ? 'text-slate-400 group-hover:text-white' : 'text-slate-600'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>

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
            </button>
          );
        })}
      </div>

      {/* Footer Info / LGPD & Multi-tenancy status */}
      <div className="p-3 m-3 bg-slate-800/60 rounded-xl border border-slate-700/60 text-[11px]">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span>Isolamento Multi-Tenant</span>
          <span className="text-emerald-400 font-semibold">Ativo</span>
        </div>
        <div className="text-slate-500 leading-tight">
          Sessão segura vinculada ao ID da clínica: <span className="font-mono text-slate-400">{user?.clinicId}</span>
        </div>
      </div>
    </aside>
  );
}
