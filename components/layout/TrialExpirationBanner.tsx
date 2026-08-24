'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  FlaskConical,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiService } from '@/lib/services/api';

interface TrialExpirationBannerProps {
  onOpenUpgradeModal?: () => void;
}

export function TrialExpirationBanner({ onOpenUpgradeModal }: TrialExpirationBannerProps) {
  const { user, subscription, refreshSubscription } = useAuth();
  const { info, success, error: toastError } = useToast();
  const [isSimulating, setIsSimulating] = useState(false);
  const [showSimPanel, setShowSimPanel] = useState(false);

  const trialInfo = subscription?.trialInfo;

  // Render only if this is a trial account
  if (!subscription || subscription.billingStatus !== 'em_trial' || !trialInfo?.isTrial) {
    return null;
  }

  const isExpiringSoon = trialInfo.isExpiringSoon || (trialInfo.daysRemaining <= 2 && !trialInfo.isExpired);
  const hours = trialInfo.hoursRemaining;
  const days = trialInfo.daysRemaining;

  const handleSimulate = async (mode: 'active_7_days' | 'expiring_soon_36h' | 'expiring_soon_12h' | 'expired') => {
    setIsSimulating(true);
    try {
      const res = await apiService.simulateTrial(mode, user?.email);
      await refreshSubscription();
      success('Simulação de Trial Aplicada', res.message);
    } catch (err: any) {
      toastError('Erro na Simulação', err.message || 'Falha ao atualizar Firestore.');
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div
      className={`relative z-20 border-b transition-colors ${
        isExpiringSoon
          ? 'bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-amber-500/15 border-amber-400/40 text-amber-950'
          : 'bg-gradient-to-r from-teal-500/10 via-sky-500/10 to-teal-500/10 border-teal-300/40 text-slate-800'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        {/* Left: Status Message */}
        <div className="flex items-center gap-2.5 text-center sm:text-left flex-wrap justify-center sm:justify-start">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-xs ${
              isExpiringSoon
                ? 'bg-amber-500 text-white animate-bounce'
                : 'bg-teal-600 text-white'
            }`}
          >
            {isExpiringSoon ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <span
              className={`font-extrabold px-2 py-0.5 rounded-full text-[10px] tracking-wide inline-flex items-center gap-1 ${
                isExpiringSoon
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                  : 'bg-teal-100 text-teal-900 border border-teal-300 font-bold'
              }`}
            >
              {isExpiringSoon ? '⚠️ EXPIRA EM MENOS DE 2 DIAS' : '✨ PERÍODO DE AVALIAÇÃO DE 7 DIAS'}
            </span>

            <span className="font-semibold text-slate-900">
              {isExpiringSoon ? (
                <>
                  Faltam apenas{' '}
                  <strong className="text-amber-800 font-extrabold underline decoration-amber-400">
                    {hours > 0 ? `${hours} horas (${days} ${days === 1 ? 'dia' : 'dias'})` : `${days} dias`}
                  </strong>{' '}
                  para encerrar seu teste gratuito.
                </>
              ) : (
                <>
                  Sua conta de testes está ativa com{' '}
                  <strong className="text-teal-800 font-bold">{days} dias restantes</strong> (Válida até{' '}
                  {trialInfo.formattedEndsAt || '7 dias'}).
                </>
              )}
            </span>

            <span className="hidden xl:inline text-slate-600">
              {isExpiringSoon
                ? 'Faça o upgrade para manter suas automações de WhatsApp e prontuários ativos.'
                : 'Acesso Enterprise liberado no Google Cloud Firestore.'}
            </span>
          </div>
        </div>

        {/* Right: Actions & Simulation Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Quick Simulation Trigger for testing */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSimPanel(!showSimPanel)}
              className="px-2.5 py-1 text-[11px] font-semibold bg-white/80 hover:bg-white text-slate-700 border border-slate-300 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
              title="Testar validação de expiração e prazos"
            >
              <FlaskConical className="w-3.5 h-3.5 text-indigo-600" />
              <span>Simular Firestore</span>
            </button>

            {showSimPanel && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-3 z-50 text-white space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                  <span className="text-[11px] font-bold text-slate-200">Simulador de Validade Firestore</span>
                  <button
                    type="button"
                    onClick={() => setShowSimPanel(false)}
                    className="text-[10px] text-slate-400 hover:text-white"
                  >
                    Fechar
                  </button>
                </div>

                <p className="text-[10px] text-slate-400">
                  Altere a data no Firestore para validar as regras dos 7 dias e aviso de menos de 2 dias:
                </p>

                <div className="space-y-1.5 pt-1">
                  <button
                    type="button"
                    disabled={isSimulating}
                    onClick={() => {
                      handleSimulate('active_7_days');
                      setShowSimPanel(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] bg-slate-800 hover:bg-slate-700 flex items-center justify-between transition-colors"
                  >
                    <span>🟢 7 Dias Completos</span>
                    <span className="text-[9px] text-teal-400">Normal</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSimulating}
                    onClick={() => {
                      handleSimulate('expiring_soon_36h');
                      setShowSimPanel(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] bg-amber-950/80 hover:bg-amber-900/80 border border-amber-700/50 flex items-center justify-between transition-colors"
                  >
                    <span>🟡 36 Horas Restantes</span>
                    <span className="text-[9px] text-amber-300 font-bold">&lt; 2 Dias (Aviso)</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSimulating}
                    onClick={() => {
                      handleSimulate('expiring_soon_12h');
                      setShowSimPanel(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] bg-orange-950/80 hover:bg-orange-900/80 border border-orange-700/50 flex items-center justify-between transition-colors"
                  >
                    <span>🟠 12 Horas Restantes</span>
                    <span className="text-[9px] text-orange-300 font-bold">&lt; 2 Dias</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSimulating}
                    onClick={() => {
                      handleSimulate('expired');
                      setShowSimPanel(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] bg-rose-950/80 hover:bg-rose-900/80 border border-rose-700/50 flex items-center justify-between transition-colors"
                  >
                    <span>🔴 Expirado (Bloqueio)</span>
                    <span className="text-[9px] text-rose-300 font-bold">Bloquear</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Upgrade CTA */}
          <button
            type="button"
            onClick={onOpenUpgradeModal}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-xs ${
              isExpiringSoon
                ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                : 'bg-teal-700 hover:bg-teal-800 text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isExpiringSoon ? 'Fazer Upgrade Imediato' : 'Ver Planos Definitivos'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
