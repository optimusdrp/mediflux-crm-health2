'use client';

import React, { useState, useEffect } from 'react';
import { Patient, PriorityRule } from '@/lib/types';
import { FALLBACK_PATIENTS } from '@/lib/data/fallbackSeed';
import { apiService } from '@/lib/services/api';
import { useToast } from '@/contexts/ToastContext';
import {
  ClockAlert,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Phone,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface PendenciasViewProps {
  onSelectPatient: (id: string) => void;
}

export function PendenciasView({ onSelectPatient }: PendenciasViewProps) {
  const { success, error, info } = useToast();
  const [patients, setPatients] = useState<Patient[]>(FALLBACK_PATIENTS);
  const [rules, setRules] = useState<PriorityRule[]>([]);
  const [filterType, setFilterType] = useState<'todos' | 'sla' | 'revisao' | 'docs'>('todos');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const [pRes, rRes] = await Promise.allSettled([
          apiService.getPatients(),
          apiService.getPriorityRules(),
        ]);
        if (isMounted) {
          if (pRes.status === 'fulfilled' && pRes.value?.patients?.length) {
            setPatients(pRes.value.patients);
          }
          if (rRes.status === 'fulfilled' && rRes.value?.rules?.length) {
            setRules(rRes.value.rules);
          }
        }
      } catch {
        // Fallback silencioso
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

  // Filter patients with pending issues
  const pendingPatients = patients.filter((p) => {
    const hasMissingDocs = !p.checklist.doc_enviado || !p.checklist.convenio_validado || !p.checklist.termo_assinado;
    const needsReview = p.requiresHumanReview;
    const isCriticalOrHigh = p.urgency === 'critica' || p.urgency === 'alta';

    if (filterType === 'sla') return isCriticalOrHigh;
    if (filterType === 'revisao') return needsReview;
    if (filterType === 'docs') return hasMissingDocs;

    return hasMissingDocs || needsReview || isCriticalOrHigh;
  });

  const handleResolveReview = async (patientId: string) => {
    try {
      const res = await apiService.updatePatient(patientId, { requiresHumanReview: false });
      setPatients((prev) => prev.map((p) => (p.id === patientId ? res.patient : p)));
      success('Revisão Concluída', `Caso liberado para ${res.patient.name}.`);
    } catch (err: any) {
      error('Erro ao atualizar', err.message);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ClockAlert className="w-5 h-5 text-rose-600" />
            <h2 className="text-lg font-bold text-slate-900">Central de Pendências & Controle de SLA</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitoramento de casos críticos, tempos de resposta Manchester e pendências cadastrais/LGPD.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
          <button
            onClick={() => setFilterType('todos')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filterType === 'todos' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
            }`}
          >
            Todas ({pendingPatients.length})
          </button>
          <button
            onClick={() => setFilterType('sla')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filterType === 'sla' ? 'bg-white text-rose-700 shadow-2xs' : 'hover:text-slate-900'
            }`}
          >
            SLA Crítico
          </button>
          <button
            onClick={() => setFilterType('revisao')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filterType === 'revisao' ? 'bg-white text-purple-700 shadow-2xs' : 'hover:text-slate-900'
            }`}
          >
            Revisão IA
          </button>
          <button
            onClick={() => setFilterType('docs')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filterType === 'docs' ? 'bg-white text-amber-700 shadow-2xs' : 'hover:text-slate-900'
            }`}
          >
            Docs / LGPD
          </button>
        </div>
      </div>

      {/* Main Grid: Pending List & SLA Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Table / Cards (2 Cols) */}
        <div className="lg:col-span-2 space-y-3">
          {pendingPatients.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-xs">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="font-bold text-sm text-slate-800">Nenhuma pendência ativa no momento</h3>
              <p className="text-xs text-slate-500 mt-1">Todos os atendimentos estão dentro do prazo de SLA e com documentação em dia.</p>
            </div>
          ) : (
            pendingPatients.map((p) => {
              const isUrgent = p.urgency === 'critica' || p.urgency === 'alta';

              return (
                <div
                  key={p.id}
                  className={`bg-white p-4 rounded-xl border transition-all ${
                    isUrgent ? 'border-rose-300 shadow-xs bg-rose-50/20' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          isUrgent ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {p.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-xs text-slate-900">{p.name}</h4>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                              p.urgency === 'critica'
                                ? 'bg-red-600 text-white'
                                : p.urgency === 'alta'
                                ? 'bg-orange-500 text-white'
                                : 'bg-amber-400 text-slate-950'
                            }`}
                          >
                            {p.urgency}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {p.specialty} • {p.healthInsurance} • Tel: {p.phone}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onSelectPatient(p.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors shrink-0 shadow-2xs"
                    >
                      <span>Atender</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Pending badges row */}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-[10px]">
                    {p.requiresHumanReview && (
                      <div className="flex items-center gap-1.5 bg-purple-50 text-purple-800 border border-purple-200 px-2 py-1 rounded-md font-semibold">
                        <Sparkles className="w-3 h-3 text-purple-600" />
                        <span>Revisão Humana de IA Obrigatória</span>
                        <button
                          onClick={() => handleResolveReview(p.id)}
                          className="ml-1 text-purple-950 font-bold hover:underline"
                        >
                          [Resolver]
                        </button>
                      </div>
                    )}

                    {!p.checklist.termo_assinado && (
                      <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-1 rounded-md font-semibold">
                        Falta Termo de Consentimento LGPD
                      </span>
                    )}

                    {!p.checklist.doc_enviado && (
                      <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-md font-medium">
                        Falta Doc com Foto (RG)
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* SLA & Priority Rules Sidebar (1 Col) */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="font-bold text-xs text-slate-900 mb-1 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-sky-600" /> Regras de SLA & Manchester
            </h3>
            <p className="text-[11px] text-slate-500 mb-3">
              Tempos máximos de resposta clínica configurados na clínica:
            </p>

            <div className="space-y-2 text-xs">
              {rules.map((r) => {
                const colorMap: Record<string, string> = {
                  vermelho: 'border-l-red-500 bg-red-50/50 text-red-950',
                  laranja: 'border-l-orange-500 bg-orange-50/50 text-orange-950',
                  amarelo: 'border-l-amber-400 bg-amber-50/50 text-amber-950',
                  verde: 'border-l-emerald-500 bg-emerald-50/50 text-emerald-950',
                  azul: 'border-l-blue-500 bg-blue-50/50 text-blue-950',
                };
                const colorClass = colorMap[r.manchesterColor] || colorMap.verde;

                return (
                  <div key={r.id} className={`p-2.5 rounded-lg border border-l-4 ${colorClass}`}>
                    <div className="flex items-center justify-between font-bold">
                      <span>{r.name}</span>
                      <span className="text-[11px] font-mono">{r.slaMinutes} min</span>
                    </div>
                    <div className="text-[10px] opacity-80 mt-0.5">Condição: {r.condition}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
