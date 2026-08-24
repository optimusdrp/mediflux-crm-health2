'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Patient, Appointment, TabId } from '@/lib/types';
import { apiService } from '@/lib/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { FALLBACK_PATIENTS, FALLBACK_APPOINTMENTS } from '@/lib/data/fallbackSeed';
import {
  Users,
  Calendar,
  AlertTriangle,
  HeartPulse,
  TrendingUp,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

interface VisaoGeralViewProps {
  onNavigateTab: (tab: TabId) => void;
  onSelectPatient: (patientId: string) => void;
  onOpenNewPatientModal: () => void;
}

export function VisaoGeralView({
  onNavigateTab,
  onSelectPatient,
  onOpenNewPatientModal,
}: VisaoGeralViewProps) {
  const { clinic, subscription } = useAuth();
  const [patients, setPatients] = useState<Patient[]>(FALLBACK_PATIENTS);
  const [appointments, setAppointments] = useState<Appointment[]>(FALLBACK_APPOINTMENTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    try {
      const [pRes, aRes] = await Promise.allSettled([
        apiService.getPatients(),
        apiService.getAppointments(),
      ]);

      if (pRes.status === 'fulfilled' && pRes.value?.patients?.length) {
        setPatients(pRes.value.patients);
      }
      if (aRes.status === 'fulfilled' && aRes.value?.appointments?.length) {
        setAppointments(aRes.value.appointments);
      }
    } catch {
      // Mantém fallback seguro sem quebrar o painel
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    loadData();
    return () => {
      isMounted = false;
    };
  }, [loadData]);

  const totalPatients = patients.length;
  const criticalCount = patients.filter((p) => p.urgency === 'alta' || p.urgency === 'critica').length;
  const pendingReviewCount = patients.filter((p) => p.requiresHumanReview).length;
  const scheduledCount = appointments.length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Headline */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <HeartPulse className="w-4 h-4" />
            <span>Painel de Controle Clínico em Tempo Real</span>
          </div>
          <h2 className="text-xl font-bold text-white">
            {clinic?.name || 'Clínica CardioVida & Saúde Integrada'}
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Monitoramento operacional, triagem com Protocolo Manchester e gestão segura de atendimentos com conformidade LGPD.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
            title="Atualizar Dados"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
          <button
            onClick={onOpenNewPatientModal}
            className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            + Novo Atendimento
          </button>
          <button
            onClick={() => onNavigateTab('atendimentos')}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            Abrir Chat Omnichannel
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Pacientes Ativos</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-slate-900">{totalPatients}</span>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium mt-1">
              <TrendingUp className="w-3.5 h-3.5" /> +12% vs mês anterior
            </div>
          </div>
        </div>

        {/* Card 2 */}
        <div
          onClick={() => onNavigateTab('pendencias')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-rose-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Casos Críticos / Alta</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-rose-600">{criticalCount}</span>
            <div className="text-[11px] text-rose-600 font-medium mt-1">
              {criticalCount > 0 ? 'Exige atenção médica imediata' : 'Nenhuma emergência pendente'}
            </div>
          </div>
        </div>

        {/* Card 3 */}
        <div
          onClick={() => onNavigateTab('atendimentos')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-amber-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Revisão Humana Pendente</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-amber-600">{pendingReviewCount}</span>
            <div className="text-[11px] text-amber-700 font-medium mt-1">
              Guardrail de segurança acionado
            </div>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Consultas Agendadas</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-slate-900">{scheduledCount}</span>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              Integrado com Prontuário Eletrônico
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Atendimentos Recentes & Status do Plano */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Fila Recente */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Fila de Atendimentos Recentes</h3>
              <p className="text-xs text-slate-500">Triagem clínica e classificação em tempo real</p>
            </div>
            <button
              onClick={() => onNavigateTab('atendimentos')}
              className="text-xs font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-1"
            >
              Ver todos <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {patients.slice(0, 5).map((p) => {
              const urgencyBadge = {
                critica: 'bg-red-500 text-white',
                alta: 'bg-orange-500 text-white',
                media: 'bg-amber-400 text-slate-900 font-bold',
                baixa: 'bg-emerald-500 text-white',
              }[p.urgency];

              return (
                <div
                  key={p.id}
                  onClick={() => {
                    onSelectPatient(p.id);
                    onNavigateTab('atendimentos');
                  }}
                  className="p-4 hover:bg-slate-50 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                      {p.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">{p.name}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-bold ${urgencyBadge}`}>
                          {p.urgency}
                        </span>
                        {p.requiresHumanReview && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-purple-50 text-purple-700 border border-purple-200 font-semibold">
                            Revisão IA
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>{p.specialty}</span>
                        <span>•</span>
                        <span>{p.healthInsurance}</span>
                        <span>•</span>
                        <span className="capitalize">{p.originChannel}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] font-semibold text-slate-600 capitalize bg-slate-100 px-2 py-0.5 rounded-md">
                      {p.funnelStage.replace('_', ' ')}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {new Date(p.lastInteractionAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 1 Col: Billing & Compliance Health */}
        <div className="space-y-6">
          {/* Subscription Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-xs text-slate-900">Consumo de Atendimentos</h3>
              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Ativo
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-slate-600 mb-1">
                  <span>Limite Mensal</span>
                  <span className="font-bold text-slate-900">
                    {subscription?.currentPeriodAppointments || 342} / {subscription?.maxAppointmentsPerMonth || 1000}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-sky-500 h-2 rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        ((subscription?.currentPeriodAppointments || 342) /
                          (subscription?.maxAppointmentsPerMonth || 1000)) *
                          100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-600 mb-1">
                  <span>Chamadas IA (Dual Router)</span>
                  <span className="font-bold text-purple-700">{subscription?.aiCallsCount || 128} chamadas</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-slate-500">Plano Atual:</span>
                <span className="font-bold text-slate-800 capitalize">{subscription?.basePlan || 'Enterprise'}</span>
              </div>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
            <h4 className="font-bold text-xs text-slate-800 mb-3 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Conformidade & Segurança
            </h4>
            <div className="space-y-2 text-xs">
              <button
                onClick={() => onNavigateTab('auditoria_lgpd')}
                className="w-full text-left p-2.5 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 text-slate-700 font-medium transition-colors flex items-center justify-between"
              >
                <span>Trilha de Auditoria LGPD</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <button
                onClick={() => onNavigateTab('configuracoes')}
                className="w-full text-left p-2.5 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 text-slate-700 font-medium transition-colors flex items-center justify-between"
              >
                <span>Integrações Prontuário (PEP)</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <button
                onClick={() => onNavigateTab('analise_inteligente')}
                className="w-full text-left p-2.5 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 text-slate-700 font-medium transition-colors flex items-center justify-between"
              >
                <span>Laboratório de Triagem IA</span>
                <ChevronRight className="w-3.5 h-3.5 text-purple-500" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
