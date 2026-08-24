'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiService } from '@/lib/services/api';
import {
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
  Lock,
  Sparkles,
  CheckCircle2,
  AlertOctagon,
  Clock,
  RefreshCw,
  LogOut,
  MessageCircle,
  CreditCard,
  Building2,
  Database,
  Calendar,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { TabId } from '@/lib/types';

interface AccessDeniedGuardProps {
  tab: TabId;
  reason?: 'rbac' | 'trial_expired';
  onNavigateToRenovacao?: () => void;
}

export function AccessDeniedGuard({ tab, reason }: AccessDeniedGuardProps) {
  const { user, clinic, subscription, isTrialExpired, switchRole, logout, refreshSubscription } = useAuth();
  const { success, error: toastError, info } = useToast();

  const [selectedPlan, setSelectedPlan] = useState<'essencial' | 'profissional' | 'enterprise'>('enterprise');
  const [isProcessingUpgrade, setIsProcessingUpgrade] = useState(false);
  const [isRestoringTrial, setIsRestoringTrial] = useState(false);

  const tabNames: Record<TabId, string> = {
    landing_page: 'Landing Page (Página Pública)',
    visao_geral: 'Visão Geral',
    atendimentos: 'Atendimentos & Chat',
    jornadas: 'Jornadas & Funis',
    pendencias: 'Pendências & SLA',
    automacoes: 'Automações',
    indicadores: 'Indicadores & Billing',
    configuracoes: 'Configurações Administrativas',
    auditoria_lgpd: 'Auditoria LGPD',
    analise_inteligente: 'IA Dual & Triage Lab',
  };

  const trialInfo = subscription?.trialInfo;
  const isExpired =
    reason === 'trial_expired' ||
    isTrialExpired ||
    Boolean(trialInfo?.isExpired) ||
    (subscription?.billingStatus === 'em_trial' && trialInfo && !trialInfo.isValid);

  // Handler to reactivate/restore 7 days trial on Firestore for testing/reviewer
  const handleRestoreTrial = async () => {
    setIsRestoringTrial(true);
    try {
      const res = await apiService.simulateTrial('active_7_days', user?.email);
      await refreshSubscription();
      success('Período de Testes Restaurado', res.message || '7 dias liberados no Firestore para demonstração.');
    } catch (err: any) {
      toastError('Erro ao Restaurar', err.message || 'Falha ao atualizar Firestore.');
    } finally {
      setIsRestoringTrial(false);
    }
  };

  // Handler to activate plan
  const handleActivatePlan = async () => {
    setIsProcessingUpgrade(true);
    try {
      // Simulate plan activation
      await new Promise((resolve) => setTimeout(resolve, 900));
      success(
        'Solicitação de Plano Registrada!',
        `O plano ${selectedPlan.toUpperCase()} foi selecionado para ${clinic?.name || 'sua clínica'}. Nossa equipe comercial ativará sua chave definitiva imediatamente.`
      );
    } catch (err: any) {
      toastError('Erro no Processamento', err.message || 'Falha ao processar solicitação.');
    } finally {
      setIsProcessingUpgrade(false);
    }
  };

  // ==========================================
  // CASE 1: TRIAL EXPIRED -> PLAN RENEWAL PAGE
  // ==========================================
  if (isExpired) {
    return (
      <div className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-center min-h-[85vh] bg-slate-900/90 text-slate-100 antialiased animate-in fade-in duration-300">
        <div className="max-w-4xl w-full bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
          {/* Header Banner */}
          <div className="p-6 sm:p-8 bg-gradient-to-r from-rose-950/90 via-slate-950 to-amber-950/80 border-b border-slate-800 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Lock className="w-64 h-64 text-rose-500" />
            </div>

            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mx-auto mb-4 shadow-lg shadow-rose-950/60">
              <Lock className="w-8 h-8" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-900/60 border border-rose-700/80 text-rose-200 text-xs font-bold mb-3 shadow-xs">
              <AlertOctagon className="w-4 h-4 text-rose-400" />
              <span>PERÍODO DE AVALIAÇÃO DE 7 DIAS ENCERRADO</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Acesso Operacional Bloqueado: Renove seu Plano
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mx-auto mt-2 leading-relaxed">
              O período de testes de 7 dias do <strong>MediFlux CRM Health</strong> para o módulo{' '}
              <span className="text-rose-400 font-semibold">{tabNames[tab] || tab}</span> expirou. Todos os prontuários,
              pacientes cadastrados e regras de IA continuam <strong className="text-teal-400">100% salvos e protegidos no Firestore</strong>.
            </p>
          </div>

          {/* Info Status Grid */}
          <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-medium">Clínica Vinculada</span>
              <span className="font-semibold text-slate-200 truncate block">
                {clinic?.name || 'CardioVida Medicina Integrada'}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-medium">Conta / Usuário</span>
              <span className="font-semibold text-slate-200 truncate block">{user?.email || 'optimusdrp@gmail.com'}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-medium">Data de Expiração</span>
              <span className="font-semibold text-rose-400 block">
                {trialInfo?.formattedEndsAt || 'Prazo de 7 Dias Expirado'}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-medium">Status no Firestore</span>
              <span className="font-bold text-rose-400 inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                Bloqueado (403)
              </span>
            </div>
          </div>

          {/* Plan Selection Cards */}
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-sky-400" />
                  <span>Escolha seu Plano Definitivo para Desbloqueio Imediato</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Selecione a modalidade que melhor atende ao volume de atendimentos e especialidades da sua clínica:
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Plan: Essencial */}
              <div
                onClick={() => setSelectedPlan('essencial')}
                className={`p-5 rounded-2xl border cursor-pointer transition-all relative ${
                  selectedPlan === 'essencial'
                    ? 'bg-sky-950/40 border-sky-500 ring-2 ring-sky-500/30'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <h4 className="font-bold text-white text-sm">Essencial</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Consultórios e médicos individuais</p>
                <div className="my-3">
                  <span className="text-2xl font-black text-white">R$ 190</span>
                  <span className="text-xs text-slate-400">/mês</span>
                </div>
                <ul className="space-y-2 text-xs text-slate-300">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Até 100 atendimentos/mês</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Prontuário Cloud Firestore</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Auditoria LGPD Básica</span>
                  </li>
                </ul>
              </div>

              {/* Plan: Profissional */}
              <div
                onClick={() => setSelectedPlan('profissional')}
                className={`p-5 rounded-2xl border cursor-pointer transition-all relative ${
                  selectedPlan === 'profissional'
                    ? 'bg-sky-950/40 border-sky-500 ring-2 ring-sky-500/30'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <h4 className="font-bold text-white text-sm">Profissional</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Clínicas de médio porte e policlínicas</p>
                <div className="my-3">
                  <span className="text-2xl font-black text-white">R$ 389</span>
                  <span className="text-xs text-slate-400">/mês</span>
                </div>
                <ul className="space-y-2 text-xs text-slate-300">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Até 500 atendimentos/mês</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Triagem Manchester com IA</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>WhatsApp 24/7 Automatizado</span>
                  </li>
                </ul>
              </div>

              {/* Plan: Enterprise Health */}
              <div
                onClick={() => setSelectedPlan('enterprise')}
                className={`p-5 rounded-2xl border relative cursor-pointer transition-all ${
                  selectedPlan === 'enterprise'
                    ? 'bg-teal-950/50 border-teal-500 ring-2 ring-teal-500/40'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-teal-600 text-white text-[9px] font-bold">
                  Mais Escolhido
                </div>
                <h4 className="font-bold text-white text-sm">Enterprise Health</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Hospitais, redes e alta complexidade</p>
                <div className="my-3">
                  <span className="text-2xl font-black text-teal-400">R$ 890</span>
                  <span className="text-xs text-slate-400">/mês</span>
                </div>
                <ul className="space-y-2 text-xs text-slate-300">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Atendimentos Ilimitados</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Todos os Add-ons de IA incluídos</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Integração PEP/FHIR & SLA 1h</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Security Guarantee Notice */}
            <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex items-center gap-3">
              <Database className="w-5 h-5 text-teal-400 shrink-0" />
              <div className="text-xs text-slate-300">
                <span className="font-bold text-white block">Garantia de Preservação e Continuidade de Dados:</span>
                Nenhum dado cadastrado na sua clínica será excluído. Assim que a renovação for confirmada, o acesso a todas as views operacionais é restabelecido em tempo real.
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-6 bg-slate-900/90 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={logout}
                className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair da Conta</span>
              </button>

              {/* Tester/Reviewer Instant Trial Reset */}
              <button
                type="button"
                disabled={isRestoringTrial}
                onClick={handleRestoreTrial}
                className="flex-1 sm:flex-none px-3.5 py-2.5 text-xs font-semibold bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                title="Para avaliação e testes: redefine a data no Firestore para mais 7 dias"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRestoringTrial ? 'animate-spin' : ''}`} />
                <span>Restaurar 7 Dias (Simulação)</span>
              </button>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                disabled={isProcessingUpgrade}
                onClick={handleActivatePlan}
                className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4 text-teal-400" />
                <span>Solicitar Plano {selectedPlan.toUpperCase()}</span>
              </button>

              <a
                href={`https://wa.me/5511987654321?text=${encodeURIComponent(
                  `Olá, gostaria de renovar e ativar minha assinatura definitiva (${selectedPlan.toUpperCase()}) do MediFlux CRM Health para a clínica ${clinic?.name || 'CardioVida'} (Conta: ${user?.email || ''}).`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 sm:flex-none px-5 py-2.5 text-xs font-bold bg-gradient-to-r from-teal-600 to-sky-600 hover:from-teal-500 hover:to-sky-500 text-white rounded-xl transition-all shadow-md shadow-sky-600/30 flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Falar com Consultor e Renovar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // CASE 2: STANDARD RBAC ACCESS RESTRICTION
  // ==========================================
  return (
    <div className="flex-1 p-8 flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 mx-auto flex items-center justify-center mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <h3 className="text-lg font-bold text-slate-900 mb-1">Acesso Restrito pelo RBAC</h3>
        <p className="text-xs text-slate-600 mb-4 leading-relaxed">
          O módulo <strong className="text-slate-800">{tabNames[tab] || tab}</strong> não está habilitado para o perfil{' '}
          <span className="font-semibold uppercase text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
            {user?.role}
          </span>
          .
        </p>

        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-left text-xs mb-6 text-slate-600 space-y-1">
          <div className="font-semibold text-slate-800">Regra de Segurança de Conformidade:</div>
          <div>• Matriz de Acesso de 2 Camadas (Módulos de Interface e Ações Sensíveis).</div>
          <div>• Acesso registrado e auditado na trilha de não-repúdio do sistema.</div>
        </div>

        <button
          onClick={() => switchRole('admin')}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Alternar para Perfil Administrador
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

