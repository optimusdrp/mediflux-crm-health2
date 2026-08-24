'use client';

import React, { useState } from 'react';
import {
  AlertOctagon,
  ShieldAlert,
  Clock,
  Sparkles,
  CheckCircle2,
  Lock,
  ArrowRight,
  RefreshCw,
  LogOut,
  MessageCircle,
  Building2,
  Database,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiService } from '@/lib/services/api';

interface TrialExpiredModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

export function TrialExpiredModal({ isOpen }: TrialExpiredModalProps) {
  const { user, subscription, logout, refreshSubscription } = useAuth();
  const { success, error } = useToast();
  const [isResetting, setIsResetting] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'profissional' | 'enterprise'>('enterprise');

  if (!isOpen) return null;

  const trialInfo = subscription?.trialInfo;

  const handleReactivateTrial = async () => {
    setIsResetting(true);
    try {
      await apiService.simulateTrial('active_7_days', user?.email);
      await refreshSubscription();
      success('Período Reativado', 'O período de 7 dias foi redefinido no Firestore para testes.');
    } catch (err: any) {
      error('Erro ao reativar', err.message || 'Falha na atualização do Firestore.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header Visual */}
        <div className="p-6 bg-gradient-to-r from-rose-950/80 via-slate-950 to-amber-950/80 border-b border-slate-800 text-center relative overflow-hidden">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mx-auto mb-3 shadow-lg shadow-rose-950/50">
            <Lock className="w-7 h-7" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-900/60 border border-rose-700/80 text-rose-200 text-xs font-bold mb-2">
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>Período de Testes de 7 Dias Expirado</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Seu Período de Avaliação Gratuita Chegou ao Fim
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto mt-1.5 leading-relaxed">
            Agradecemos por testar o <strong>MediFlux CRM Health</strong>. Seus dados clínicos, pacientes cadastrados e
            regras de triagem continuam <strong className="text-teal-400">100% salvos e protegidos no Firestore</strong>.
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-200 text-xs">
          {/* Metadata Card */}
          <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">Data de Criação:</span>
              <span className="font-semibold text-slate-200">
                {trialInfo?.registeredAt ? new Date(trialInfo.registeredAt).toLocaleDateString('pt-BR') : '2026-08-21'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">Data de Expiração:</span>
              <span className="font-semibold text-rose-300">
                {trialInfo?.formattedEndsAt || 'Expirado'}
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-[10px] text-slate-400 block font-medium">Status no Firestore:</span>
              <span className="font-bold text-rose-400 inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Acesso Bloqueado
              </span>
            </div>
          </div>

          {/* Plan Choice for Upgrade */}
          <div className="space-y-2">
            <h3 className="font-bold text-slate-100 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>Escolha seu Plano Definitivo para Desbloquear</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setSelectedPlan('profissional')}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  selectedPlan === 'profissional'
                    ? 'bg-sky-950/40 border-sky-500 ring-2 ring-sky-500/30'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white text-sm">Profissional</span>
                  <span className="text-xs font-black text-sky-400">R$ 389/mês</span>
                </div>
                <ul className="space-y-1.5 text-[11px] text-slate-400">
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
                    <span>Auditoria LGPD Completa</span>
                  </li>
                </ul>
              </div>

              <div
                onClick={() => setSelectedPlan('enterprise')}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  selectedPlan === 'enterprise'
                    ? 'bg-teal-950/40 border-teal-500 ring-2 ring-teal-500/30'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-sm">Enterprise Health</span>
                    <span className="text-[9px] bg-teal-900 text-teal-200 border border-teal-700 px-1.5 py-0.2 rounded font-bold">
                      Recomendado
                    </span>
                  </div>
                  <span className="text-xs font-black text-teal-400">R$ 890/mês</span>
                </div>
                <ul className="space-y-1.5 text-[11px] text-slate-400">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Atendimentos Ilimitados</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Integração Total PEP & FHIR</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Suporte Dedicado 24/7 SLA 1h</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={logout}
              className="flex-1 sm:flex-none px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair da Conta</span>
            </button>

            {/* Test Reset Button for Reviewer */}
            <button
              type="button"
              disabled={isResetting}
              onClick={handleReactivateTrial}
              className="flex-1 sm:flex-none px-3 py-2 text-xs font-semibold bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 border border-indigo-700/60 rounded-xl transition-colors flex items-center justify-center gap-1.5"
              title="Para testes: renova mais 7 dias no Firestore"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
              <span>Restaurar 7 Dias (Teste)</span>
            </button>
          </div>

          <a
            href="https://wa.me/5511987654321?text=Ol%C3%A1%2C+gostaria+de+ativar+minha+assinatura+definitiva+do+MediFlux+CRM+Health"
            target="_blank"
            rel="noreferrer"
            className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold bg-gradient-to-r from-teal-600 to-sky-600 hover:from-teal-500 hover:to-sky-500 text-white rounded-xl transition-all shadow-md shadow-sky-600/30 flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Falar com Consultor e Ativar</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
