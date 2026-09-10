'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/services/api';
import { Unit } from '@/lib/types';
import {
  HeartPulse,
  ShieldCheck,
  Users,
  Building2,
  Menu,
  LogOut,
} from 'lucide-react';

interface HeaderProps {
  onOpenDuplicatesModal?: () => void;
  duplicatesCount?: number;
  onOpenUpgradeModal?: () => void;
  onOpenProfileModal?: () => void;
  /**
   * Abre/fecha o menu lateral em telas pequenas (mobile/tablet
   * retrato) — correção de responsividade: o Sidebar antes era
   * sempre visível e fixo em 256px, o que em telas estreitas
   * empurrava o conteúdo inteiro para fora da área visível.
   */
  onToggleSidebar?: () => void;
}

/**
 * Header reescrito — mudanças pedidas pelo usuário:
 *  1. Removido o botão "Landing Page" (link para a página pública).
 *  2. Removido o "Alternador de Perfil RBAC" (switchRole) — não era
 *     um seletor de conta, era um simulador de troca de papel que
 *     fazia login real como outro usuário usando uma senha hard-coded
 *     no código (mesmo backdoor já identificado e removido do texto
 *     de login numa auditoria anterior, aqui ainda funcional). Removido
 *     por completo, não só escondido.
 *  3. Nome da unidade principal, ao lado do nome da clínica (lado
 *     esquerdo). O seletor de unidades no lado direito (dropdown)
 *     foi removido depois: em telas estreitas (~320px) ele sobrepunha
 *     o badge "HEALTH CRM" e cortava o nome "MediFlux" — ver relato
 *     real do usuário com prints do DevTools em modo responsivo. A
 *     gestão/troca de unidade continua disponível em Configurações →
 *     Identidade & Unidades.
 *  4. Avatar do usuário agora abre a página de Perfil (onOpenProfileModal).
 *  5. Botão de duplicados só aparece para quem tem a permissão
 *     'visualizar_duplicados' (admin sempre tem, por padrão).
 */
export function Header({
  onOpenDuplicatesModal,
  duplicatesCount = 0,
  onOpenUpgradeModal,
  onOpenProfileModal,
  onToggleSidebar,
}: HeaderProps) {
  const { user, clinic, subscription, logout, hasActionPermission } = useAuth();
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    apiService
      .getUnits()
      .then((res) => {
        if (!isMounted) return;
        setUnits(res.units || []);
        const primary = res.units?.find((u) => u.isPrimary);
        setSelectedUnitId((prev) => prev || primary?.id || res.units?.[0]?.id || '');
      })
      .catch(() => {
        // Silencioso — a tela funciona normalmente sem o seletor populado;
        // o nome da clínica sozinho já é exibido.
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const selectedUnit = units.find((u) => u.id === selectedUnitId);
  const canViewDuplicates = user?.role === 'admin' || hasActionPermission('visualizar_duplicados');

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-4 lg:px-6 py-3 flex items-center justify-between shadow-xs gap-2">
      {/* Botão de menu (hambúrguer) — só em telas menores que lg */}
      {onToggleSidebar && (
        <button
          onClick={onToggleSidebar}
          className="lg:hidden shrink-0 p-2 -ml-1 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Abrir menu de navegação"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Brand & Clinic Info */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-teal-500 flex items-center justify-center text-white shadow-sm shadow-sky-500/20 shrink-0">
          <HeartPulse className="w-6 h-6" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 text-base tracking-tight">MediFlux</span>
            <span className="hidden sm:inline text-[11px] font-semibold tracking-wider text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
              HEALTH CRM
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <ShieldCheck className="w-3 h-3" /> LGPD Ativo
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5 min-w-0">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-medium text-slate-700 truncate max-w-[140px] sm:max-w-[220px] md:max-w-none">
              {clinic?.name || 'Minha Clínica'}
            </span>
            {selectedUnit && (
              <>
                <span className="text-slate-300 shrink-0">•</span>
                <span className="text-slate-500 hidden md:inline truncate max-w-[160px]">{selectedUnit.name}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right Controls: Duplicates alert, Plan badge, Unit selector, Profile */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* Duplicates notification shortcut — só para quem tem permissão */}
        {canViewDuplicates && duplicatesCount > 0 && onOpenDuplicatesModal && (
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
                {subscription?.currentPeriodAppointments || 0} / {subscription?.maxAppointmentsPerMonth || 1000} atends.
              </span>
            </>
          )}
        </div>

        {/* User Avatar & Info — clicar no avatar abre a página de Perfil */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <button
            onClick={onOpenProfileModal}
            className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shadow-xs hover:ring-2 hover:ring-sky-300 transition-all"
            title="Ver meu perfil"
          >
            {user?.name ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('') : 'DR'}
          </button>
          <button onClick={onOpenProfileModal} className="hidden xl:block text-left hover:opacity-70 transition-opacity">
            <div className="text-xs font-semibold text-slate-800 leading-tight truncate max-w-[140px]">{user?.name}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">{user?.role}</div>
          </button>
          <button
            onClick={() => logout()}
            title="Sair do Sistema"
            className="ml-1 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
