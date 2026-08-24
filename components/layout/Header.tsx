'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Role } from '@/lib/types';
import {
  HeartPulse,
  ShieldCheck,
  Bell,
  Users,
  Sparkles,
  ChevronDown,
  Building2,
  Lock,
  Stethoscope,
  DollarSign,
  UserCheck,
  Headphones,
  ExternalLink,
  Globe,
  LogOut,
} from 'lucide-react';

interface HeaderProps {
  onOpenDuplicatesModal?: () => void;
  duplicatesCount?: number;
  onNavigateToLandingPage?: () => void;
  onOpenUpgradeModal?: () => void;
}

export function Header({
  onOpenDuplicatesModal,
  duplicatesCount = 0,
  onNavigateToLandingPage,
  onOpenUpgradeModal,
}: HeaderProps) {
  const { user, clinic, subscription, switchRole, logout } = useAuth();
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);

  const roles: { role: Role; label: string; icon: any; color: string }[] = [
    { role: 'admin', label: 'Administrador (Gestão Total)', icon: ShieldCheck, color: 'text-purple-600 bg-purple-50 border-purple-200' },
    { role: 'recepcao', label: 'Recepção (Atendimentos & Funil)', icon: Headphones, color: 'text-sky-600 bg-sky-50 border-sky-200' },
    { role: 'medico', label: 'Profissional de Saúde / Médico', icon: Stethoscope, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    { role: 'financeiro', label: 'Contador / Financeiro', icon: DollarSign, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    { role: 'terceirizado', label: 'Terceirizado (Apenas Pendências)', icon: UserCheck, color: 'text-slate-600 bg-slate-50 border-slate-200' },
  ];

  const currentRoleConfig = roles.find((r) => r.role === user?.role) || roles[0];

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 lg:px-6 py-3 flex items-center justify-between shadow-xs">
      {/* Brand & Clinic Info */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-teal-500 flex items-center justify-center text-white shadow-sm shadow-sky-500/20">
          <HeartPulse className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 text-base tracking-tight">MediFlux</span>
            <span className="text-[11px] font-semibold tracking-wider text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
              HEALTH CRM
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <ShieldCheck className="w-3 h-3" /> LGPD Ativo
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium text-slate-700 truncate max-w-[220px] md:max-w-none">
              {clinic?.name || 'Clínica CardioVida & Saúde Integrada'}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500 hidden md:inline">{clinic?.unit || 'Unidade Jardins'}</span>
          </div>
        </div>
      </div>

      {/* Right Controls: Plan badge, Duplicates alert, Role Switcher, Profile */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* Landing Page Link */}
        {onNavigateToLandingPage && (
          <button
            onClick={onNavigateToLandingPage}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors shadow-xs"
            title="Visualizar Landing Page pública do produto"
          >
            <Globe className="w-3.5 h-3.5 text-sky-600" />
            <span>Landing Page</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </button>
        )}

        {/* Duplicates notification shortcut */}
        {duplicatesCount > 0 && onOpenDuplicatesModal && (
          <button
            onClick={onOpenDuplicatesModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors shadow-xs"
            title="Pacientes duplicados detectados"
          >
            <Users className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
            <span className="hidden sm:inline">{duplicatesCount} Duplicado(s)</span>
            <span className="sm:hidden font-bold">{duplicatesCount}</span>
          </button>
        )}

        {/* Plan / Subscription Pill */}
        <div
          onClick={subscription?.billingStatus === 'em_trial' ? onOpenUpgradeModal : undefined}
          className={`hidden lg:flex items-center gap-2 px-3 py-1 border rounded-lg text-xs transition-colors ${
            subscription?.billingStatus === 'em_trial'
              ? subscription.trialInfo?.isExpiringSoon || (subscription.trialInfo?.daysRemaining ?? 7) <= 2
                ? 'bg-amber-50/80 border-amber-300 text-amber-900 cursor-pointer hover:bg-amber-100'
                : 'bg-teal-50/80 border-teal-200 text-teal-900 cursor-pointer hover:bg-teal-100'
              : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}
          title={subscription?.billingStatus === 'em_trial' ? 'Clique para ver detalhes do Trial de 7 Dias' : 'Plano da Clínica'}
        >
          {subscription?.billingStatus === 'em_trial' ? (
            <>
              <div
                className={`w-2 h-2 rounded-full ${
                  subscription.trialInfo?.isExpiringSoon || (subscription.trialInfo?.daysRemaining ?? 7) <= 2
                    ? 'bg-amber-500 animate-bounce'
                    : 'bg-teal-500 animate-pulse'
                }`}
              />
              <span
                className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                  subscription.trialInfo?.isExpiringSoon || (subscription.trialInfo?.daysRemaining ?? 7) <= 2
                    ? 'bg-amber-200 text-amber-900 border border-amber-300'
                    : 'bg-teal-100 text-teal-900 border border-teal-300'
                }`}
              >
                {subscription.trialInfo?.isExpiringSoon || (subscription.trialInfo?.daysRemaining ?? 7) <= 2
                  ? '⚠️ Trial < 2 Dias'
                  : 'Trial 7 Dias'}
              </span>
              <span className="font-semibold text-slate-900 capitalize">{subscription?.basePlan || 'Enterprise'}</span>
              <span className="text-slate-300">|</span>
              <span className="font-semibold text-[11px]">
                {subscription.trialInfo?.hoursRemaining !== undefined
                  ? subscription.trialInfo.hoursRemaining <= 48
                    ? `${subscription.trialInfo.hoursRemaining}h restantes`
                    : `${subscription.trialInfo.daysRemaining} dias restantes`
                  : '7 dias restantes'}
              </span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-slate-600">Plano:</span>
              <span className="font-semibold text-slate-900 capitalize">{subscription?.basePlan || 'Enterprise'}</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500">
                {subscription?.currentPeriodAppointments || 342} / {subscription?.maxAppointmentsPerMonth || 1000} atends.
              </span>
            </>
          )}
        </div>

        {/* Interactive RBAC Role Switcher (Crucial for verifying 2-layer permissions!) */}
        <div className="relative">
          <button
            onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all shadow-xs ${currentRoleConfig.color}`}
            id="role-switcher-button"
          >
            <currentRoleConfig.icon className="w-4 h-4" />
            <span className="font-semibold">{currentRoleConfig.label.split(' ')[0]}</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-70" />
          </button>

          {isRoleMenuOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Alternar Perfil RBAC (Simulação de Acesso)
              </div>
              {roles.map((r) => (
                <button
                  key={r.role}
                  onClick={() => {
                    switchRole(r.role);
                    setIsRoleMenuOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2.5 transition-colors ${
                    user?.role === r.role ? 'bg-slate-100 font-bold text-slate-900' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <r.icon className="w-4 h-4 shrink-0 text-slate-500" />
                  <div className="flex-1 truncate">
                    <div>{r.label}</div>
                  </div>
                  {user?.role === r.role && <div className="w-1.5 h-1.5 rounded-full bg-sky-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User Avatar & Info */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shadow-xs">
            {user?.name ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('') : 'DR'}
          </div>
          <div className="hidden xl:block text-left">
            <div className="text-xs font-semibold text-slate-800 leading-tight truncate max-w-[140px]">{user?.name}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">{user?.role}</div>
          </div>
          <button
            onClick={() => {
              logout();
              if (onNavigateToLandingPage) {
                onNavigateToLandingPage();
              }
            }}
            title="Sair do Sistema e Voltar à Landing Page"
            className="ml-1 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
