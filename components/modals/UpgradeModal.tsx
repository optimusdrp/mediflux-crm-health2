'use client';

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Zap,
  ArrowRight,
  MessageCircle,
  Building2,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  const { subscription, clinic } = useAuth();
  const { success } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<'essencial' | 'profissional' | 'enterprise'>('enterprise');

  if (!isOpen) return null;

  const trialInfo = subscription?.trialInfo;

  const handleSimulateUpgrade = () => {
    success(
      'Solicitação Enviada',
      `O plano ${selectedPlan.toUpperCase()} foi selecionado para ${clinic?.name || 'sua clínica'}. Nossa equipe entrará em contato via WhatsApp!`
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-teal-600 via-sky-600 to-indigo-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Planos Definitivos MediFlux CRM Health</h2>
                <span className="px-2 py-0.5 rounded-full bg-white/25 text-[10px] font-bold">
                  {trialInfo?.daysRemaining ? `${trialInfo.daysRemaining} dias de trial restantes` : 'Trial 7 Dias'}
                </span>
              </div>
              <p className="text-xs text-teal-100 mt-0.5">
                Mantenha todas as automações com IA, prontuários no Firestore e integração de WhatsApp ativas sem interrupções.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Essencial */}
            <div
              onClick={() => setSelectedPlan('essencial')}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                selectedPlan === 'essencial'
                  ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/30 ring-2 ring-sky-500/30'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Essencial</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Para clínicas e consultórios individuais</p>
              <div className="my-3">
                <span className="text-xl font-black text-slate-900 dark:text-white">R$ 190</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">/mês</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span>100 atendimentos/mês</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span>Prontuário no Firestore</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span>Auditoria Básica LGPD</span>
                </li>
              </ul>
            </div>

            {/* Profissional */}
            <div
              onClick={() => setSelectedPlan('profissional')}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                selectedPlan === 'profissional'
                  ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/30 ring-2 ring-sky-500/30'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Profissional</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Clínicas de médio porte e policlínicas</p>
              <div className="my-3">
                <span className="text-xl font-black text-slate-900 dark:text-white">R$ 389</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">/mês</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span>500 atendimentos/mês</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span>Triagem Clínica IA (Manchester)</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span>WhatsApp 24/7 Automatizado</span>
                </li>
              </ul>
            </div>

            {/* Enterprise */}
            <div
              onClick={() => setSelectedPlan('enterprise')}
              className={`p-4 rounded-2xl border relative cursor-pointer transition-all ${
                selectedPlan === 'enterprise'
                  ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/30 ring-2 ring-teal-500/30'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-teal-600 text-white text-[9px] font-bold">
                Recomendado
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Enterprise Health</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Hospitais, redes e alta complexidade</p>
              <div className="my-3">
                <span className="text-xl font-black text-slate-900 dark:text-white">R$ 890</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">/mês</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span>Atendimentos Ilimitados</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span>Todos os Add-ons de IA inclusos</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span>Suporte Dedicado com SLA 1h</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Continuidade e Segurança de Dados
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Nenhum dado cadastrado durante o teste de 7 dias será perdido ao ativar o plano.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={handleSimulateUpgrade}
            className="px-5 py-2 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-xl transition-all shadow-xs flex items-center gap-1.5"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Confirmar Upgrade ({selectedPlan.toUpperCase()})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
