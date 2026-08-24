'use client';

import React, { useState, useEffect } from 'react';
import { Patient, UrgencyLevel } from '@/lib/types';
import { FALLBACK_PATIENTS } from '@/lib/data/fallbackSeed';
import { apiService } from '@/lib/services/api';
import { useToast } from '@/contexts/ToastContext';
import {
  KanbanSquare,
  Plus,
  ArrowRight,
  User,
  Phone,
  Clock,
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
} from 'lucide-react';

interface JornadasViewProps {
  onSelectPatient: (id: string) => void;
  onOpenNewPatientModal: () => void;
}

export function JornadasView({ onSelectPatient, onOpenNewPatientModal }: JornadasViewProps) {
  const { success, error, info } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('todas');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const stages: { key: string; title: string; color: string; badgeBg: string }[] = [
    { key: 'novo', title: 'Novos Contatos', color: 'border-t-sky-500', badgeBg: 'bg-sky-50 text-sky-700' },
    { key: 'em_atendimento', title: 'Em Triagem / Atendimento', color: 'border-t-amber-500', badgeBg: 'bg-amber-50 text-amber-700' },
    { key: 'agendado', title: 'Consulta Agendada', color: 'border-t-emerald-500', badgeBg: 'bg-emerald-50 text-emerald-700' },
    { key: 'concluido', title: 'Atendimento Concluído', color: 'border-t-indigo-500', badgeBg: 'bg-indigo-50 text-indigo-700' },
    { key: 'perdido', title: 'Perdido / Desistência', color: 'border-t-slate-400', badgeBg: 'bg-slate-100 text-slate-600' },
  ];

  useEffect(() => {
    let isMounted = true;
    const fetchPatients = async () => {
      try {
        const res = await apiService.getPatients({
          search: searchTerm,
          specialty: selectedSpecialty,
        });
        if (isMounted) {
          setPatients(res.patients && res.patients.length > 0 ? res.patients : FALLBACK_PATIENTS);
        }
      } catch {
        if (isMounted && patients.length === 0) {
          setPatients(FALLBACK_PATIENTS);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    fetchPatients();
    return () => {
      isMounted = false;
    };
  }, [searchTerm, selectedSpecialty, patients.length]);

  const moveStage = async (patientId: string, nextStage: string) => {
    try {
      const res = await apiService.updatePatient(patientId, { funnelStage: nextStage });
      setPatients((prev) => prev.map((p) => (p.id === patientId ? res.patient : p)));
      success('Etapa Atualizada', `${res.patient.name} movido para ${nextStage.replace('_', ' ')}.`);
    } catch (err: any) {
      error('Erro ao mover etapa', err.message);
    }
  };

  const urgencyDot: Record<UrgencyLevel, string> = {
    critica: 'bg-red-500',
    alta: 'bg-orange-500',
    media: 'bg-amber-400',
    baixa: 'bg-emerald-500',
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto flex flex-col h-[calc(100vh-61px)]">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <KanbanSquare className="w-5 h-5 text-sky-600" />
            <h2 className="text-lg font-bold text-slate-900">Jornadas Clínicas & Funil de Pacientes</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Acompanhamento visual do fluxo de atendimento, desde a entrada até a consulta e pós-atendimento.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Filtrar por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <select
            value={selectedSpecialty}
            onChange={(e) => setSelectedSpecialty(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
          >
            <option value="todas">Todas as Especialidades</option>
            <option value="Cardiologia">Cardiologia</option>
            <option value="Dermatologia">Dermatologia</option>
            <option value="Ortopedia">Ortopedia</option>
            <option value="Clínica Geral">Clínica Geral</option>
          </select>

          <button
            onClick={onOpenNewPatientModal}
            className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Novo Paciente
          </button>
        </div>
      </div>

      {/* Kanban Board Container */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-4 items-start">
        {stages.map((stage) => {
          const stagePatients = patients.filter((p) => p.funnelStage === stage.key);

          return (
            <div
              key={stage.key}
              className={`bg-slate-100/80 rounded-2xl border border-slate-200 flex flex-col max-h-full overflow-hidden border-t-4 ${stage.color}`}
            >
              {/* Column Header */}
              <div className="p-3.5 bg-white border-b border-slate-200/80 flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800 truncate">{stage.title}</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${stage.badgeBg}`}>
                  {stagePatients.length}
                </span>
              </div>

              {/* Cards Scrollable */}
              <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1 min-h-[300px]">
                {stagePatients.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs italic">Nenhum paciente nesta etapa.</div>
                ) : (
                  stagePatients.map((p) => (
                    <div
                      key={p.id}
                      className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition-all space-y-2 group"
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div
                          onClick={() => onSelectPatient(p.id)}
                          className="cursor-pointer font-bold text-xs text-slate-900 hover:text-sky-600 transition-colors"
                        >
                          {p.name}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className={`w-2 h-2 rounded-full ${urgencyDot[p.urgency]}`}
                            title={`Urgência: ${p.urgency}`}
                          />
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-500 space-y-0.5">
                        <div>
                          {p.specialty} • <span className="font-medium text-slate-700">{p.healthInsurance}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(p.lastInteractionAt).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>

                      {/* Action Stage Movers */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                        <button
                          onClick={() => onSelectPatient(p.id)}
                          className="text-sky-600 hover:text-sky-800 font-semibold"
                        >
                          Abrir Atendimento
                        </button>

                        <div className="flex items-center gap-1">
                          {stage.key !== 'concluido' && stage.key !== 'perdido' && (
                            <button
                              onClick={() => {
                                const nextIndex = stages.findIndex((s) => s.key === stage.key) + 1;
                                if (nextIndex < stages.length) {
                                  moveStage(p.id, stages[nextIndex].key);
                                }
                              }}
                              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium flex items-center gap-0.5"
                              title="Avançar para próxima etapa"
                            >
                              <span>Avançar</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
