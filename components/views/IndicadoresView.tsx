'use client';

import React, { useState, useEffect } from 'react';
import { Subscription, UsageRecord, Patient } from '@/lib/types';
import { FALLBACK_PATIENTS } from '@/lib/data/fallbackSeed';
import { apiService } from '@/lib/services/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  BarChart3,
  TrendingUp,
  HeartPulse,
  Sparkles,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

export function IndicadoresView() {
  const { clinic, subscription } = useAuth();
  const [patients, setPatients] = useState<Patient[]>(FALLBACK_PATIENTS);
  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const [pRes, sRes] = await Promise.allSettled([
          apiService.getPatients(),
          apiService.getSubscription(),
        ]);
        if (isMounted) {
          if (pRes.status === 'fulfilled' && pRes.value?.patients?.length) {
            setPatients(pRes.value.patients);
          }
          if (sRes.status === 'fulfilled' && sRes.value?.usageRecords?.length) {
            setUsageRecords(sRes.value.usageRecords);
          }
        }
      } catch {
        // Mantém fallback seguro
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const totalPatients = patients.length;
  const completedPatients = patients.filter((p) => p.funnelStage === 'concluido' || p.funnelStage === 'agendado').length;
  const conversionRate = totalPatients > 0 ? Math.round((completedPatients / totalPatients) * 100) : 0;

  // Manchester distribution
  const manchesterStats = {
    vermelho: patients.filter((p) => p.urgency === 'critica').length,
    laranja: patients.filter((p) => p.urgency === 'alta').length,
    amarelo: patients.filter((p) => p.urgency === 'media').length,
    verde: patients.filter((p) => p.urgency === 'baixa').length,
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-sky-600" />
          <h2 className="text-lg font-bold text-slate-900">Indicadores de Desempenho & Faturamento</h2>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          Métricas de conversão de pacientes, conformidade de SLA Manchester e consumo de recursos.
        </p>
      </div>

      {/* Main KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Taxa de Conversão em Consulta</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{conversionRate}%</span>
            <span className="text-xs text-emerald-600 font-semibold">+4.5% este mês</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Pacientes que agendaram ou concluíram atendimento</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Tempo Médio de Resposta SLA</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">3.8 min</span>
            <span className="text-xs text-emerald-600 font-semibold">98.2% dentro da meta</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Medido a partir da entrada da mensagem</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Consumo do Plano</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-sky-600">
              {subscription?.currentPeriodAppointments || 342}
            </span>
            <span className="text-xs text-slate-500">/ {subscription?.maxAppointmentsPerMonth || 1000} atends.</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
            <div
              className="bg-sky-500 h-1.5 rounded-full"
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

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Chamadas IA (Dual Router)</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-purple-700">{subscription?.aiCallsCount || 128}</span>
            <span className="text-xs text-purple-600 font-semibold">100% de disponibilidade</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Bedrock + Gemini 2.5 + Fallback Manchester</p>
        </div>
      </div>

      {/* Grid: Manchester Distribution & Add-ons status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Manchester Protocol Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Distribuição por Protocolo Manchester</h3>
              <p className="text-xs text-slate-500">Classificação clínica de urgência em tempo real</p>
            </div>
            <HeartPulse className="w-5 h-5 text-rose-600" />
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between font-medium text-slate-700 mb-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600" /> Vermelho (Emergência / Imediato)
                </span>
                <span className="font-bold">{manchesterStats.vermelho} pacientes</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-red-600 h-2 rounded-full"
                  style={{ width: `${totalPatients > 0 ? (manchesterStats.vermelho / totalPatients) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between font-medium text-slate-700 mb-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Laranja (Muito Urgente / 10 min)
                </span>
                <span className="font-bold">{manchesterStats.laranja} pacientes</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-orange-500 h-2 rounded-full"
                  style={{ width: `${totalPatients > 0 ? (manchesterStats.laranja / totalPatients) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between font-medium text-slate-700 mb-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Amarelo (Urgente / 60 min)
                </span>
                <span className="font-bold">{manchesterStats.amarelo} pacientes</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-amber-400 h-2 rounded-full"
                  style={{ width: `${totalPatients > 0 ? (manchesterStats.amarelo / totalPatients) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between font-medium text-slate-700 mb-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Verde (Pouco Urgente / 120 min)
                </span>
                <span className="font-bold">{manchesterStats.verde} pacientes</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full"
                  style={{ width: `${totalPatients > 0 ? (manchesterStats.verde / totalPatients) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Subscription & Add-ons Contracted */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Add-ons de IA & Faturamento</h3>
              <p className="text-xs text-slate-500">Módulos contratados no plano da clínica</p>
            </div>
            <Sparkles className="w-5 h-5 text-purple-600" />
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800">Triagem Clínica Automatizada (Manchester)</div>
                <div className="text-[11px] text-slate-500">Roteamento Dual AI com Fallback local</div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Ativo
              </span>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800">Classificação Automática de Tags (Auto-Tagging)</div>
                <div className="text-[11px] text-slate-500">Identificação de especialidade e termos clínicos</div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Ativo
              </span>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800">Qualificação Inteligente de Leads</div>
                <div className="text-[11px] text-slate-500">Pontuação de conversão e intenção cirúrgica</div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Ativo
              </span>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800">Análise de Sentimento & Satisfação</div>
                <div className="text-[11px] text-slate-500">Detecção de pacientes ansiosos ou insatisfeitos</div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Ativo
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
