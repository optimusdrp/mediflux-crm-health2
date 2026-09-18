'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Patient, UrgencyLevel, Funnel, FunnelStage } from '@/lib/types';
import { FALLBACK_PATIENTS } from '@/lib/data/fallbackSeed';
import { apiService } from '@/lib/services/api';
import { useToast } from '@/contexts/ToastContext';
import {
  KanbanSquare,
  Plus,
  ArrowRight,
  ArrowLeft,
  Clock,
  Search,
  X,
  AlertTriangle,
  ChevronDown,
  Users,
  Phone,
  LayoutGrid,
  BarChart3,
} from 'lucide-react';

interface JornadasViewProps {
  onSelectPatient: (id: string) => void;
  onOpenNewPatientModal: () => void;
}

const URGENCY_BAR: Record<UrgencyLevel, string> = {
  critica: 'bg-red-500',
  alta: 'bg-orange-500',
  media: 'bg-amber-400',
  baixa: 'bg-emerald-500',
};

const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  critica: 'Crítica',
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

// Peso de urgência para ordenação — críticos e altos sempre no topo,
// sem precisar rolar a coluna para encontrá-los.
const URGENCY_WEIGHT: Record<UrgencyLevel, number> = { critica: 0, alta: 1, media: 2, baixa: 3 };

const REQUIRED_FIELD_LABELS: Record<string, string> = {
  cpf: 'CPF',
  healthInsurance: 'Convênio',
  planNumber: 'Nº do Plano',
  birthDate: 'Data de Nascimento',
  phone: 'Telefone',
  specialty: 'Especialidade',
};

type ViewMode = 'kanban' | 'executiva';
const VIEW_MODE_STORAGE_KEY = 'mediflux_jornadas_view_mode';

/**
 * Jornadas Clínicas & Funil de Pacientes — redesign com 3 formas de
 * visualizar o mesmo dado, cada uma respondendo a uma pergunta
 * diferente que a equipe faz no dia a dia:
 *
 *  - "Funil Real": onde estamos perdendo pacientes? Cada etapa vira
 *    uma faixa horizontal com largura proporcional ao volume
 *    (afunilando de verdade, não um Kanban de colunas iguais), com a
 *    taxa de conversão entre etapas escrita ao lado.
 *  - "Kanban": o que fazer agora? Visão operacional já existente,
 *    mantida, mas com os casos críticos sempre no topo de cada
 *    coluna (sem precisar rolar para achar quem precisa de atenção).
 *  - "Linha do Tempo": há quanto tempo cada paciente está parado?
 *    Uma linha por paciente, cor por etapa atual — leitura rápida de
 *    quem está enrolando no funil.
 *
 * A escolha do usuário é lembrada (localStorage) entre visitas.
 */
export function JornadasView({ onSelectPatient, onOpenNewPatientModal }: JornadasViewProps) {
  const { success, error } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('todas');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('todas');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const [draggedPatientId, setDraggedPatientId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  const [lossModalPatient, setLossModalPatient] = useState<Patient | null>(null);
  const [lossModalTargetStage, setLossModalTargetStage] = useState<string>('');
  const [lossReason, setLossReason] = useState('');
  const [isSavingLoss, setIsSavingLoss] = useState(false);

  const [previewPatient, setPreviewPatient] = useState<Patient | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('kanban');

  /**
   * Visão Executiva — métricas reais calculadas a partir do histórico
   * de transições (não do volume atual): conversão real por etapa,
   * tempo médio até avançar, comparação com a meta configurada, e
   * motivos de perda mais comuns. Buscado sob demanda, só quando o
   * usuário troca para este modo (evita uma chamada extra em toda
   * visita à tela quando ele só quer o Kanban).
   */
  const [analytics, setAnalytics] = useState<{
    stages: {
      stageId: string;
      stageName: string;
      enteredCount: number;
      leftCount: number;
      conversionPercent: number | null;
      avgDurationDays: number | null;
      goal: { minConversionPercent?: number; maxDaysInStage?: number } | null;
      meetsConversionGoal: boolean | null;
      meetsDurationGoal: boolean | null;
    }[];
    topLossReasons: { count: number; example: string }[];
  } | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  useEffect(() => {
    if (viewMode !== 'executiva' || !selectedFunnelId) return;
    setIsLoadingAnalytics(true);
    apiService
      .getFunnelAnalytics(selectedFunnelId)
      .then((res) => setAnalytics(res))
      .catch(() => setAnalytics(null))
      .finally(() => setIsLoadingAnalytics(false));
  }, [viewMode, selectedFunnelId]);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(VIEW_MODE_STORAGE_KEY) : null;
    if (stored === 'kanban' || stored === 'executiva') setViewMode(stored);
  }, []);

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [patientsRes, settingsRes] = await Promise.allSettled([
        apiService.getPatients({ search: searchTerm, specialty: selectedSpecialty !== 'todas' ? selectedSpecialty : undefined }),
        apiService.getClinicSettings(),
      ]);

      if (patientsRes.status === 'fulfilled') {
        setPatients(patientsRes.value.patients && patientsRes.value.patients.length > 0 ? patientsRes.value.patients : FALLBACK_PATIENTS);
      }

      if (settingsRes.status === 'fulfilled') {
        const loadedFunnels = settingsRes.value.settings?.funnels || [];
        setFunnels(loadedFunnels);
        if (loadedFunnels.length > 0 && !selectedFunnelId) {
          const defaultFunnel = loadedFunnels.find((f) => f.isDefault) || loadedFunnels[0];
          setSelectedFunnelId(defaultFunnel.id);
        }
      }
    } catch {
      if (patients.length === 0) setPatients(FALLBACK_PATIENTS);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, selectedSpecialty]);

  const activeFunnel = funnels.find((f) => f.id === selectedFunnelId);
  const stages: FunnelStage[] = useMemo(
    () => (activeFunnel ? [...activeFunnel.stages].sort((a, b) => a.order - b.order) : []),
    [activeFunnel]
  );

  const funnelPatients = useMemo(
    () =>
      patients.filter(
        (p) =>
          p.funnelId === selectedFunnelId &&
          (p.conversationStatus || 'active') === 'active' &&
          (selectedUrgency === 'todas' || p.urgency === selectedUrgency)
      ),
    [patients, selectedFunnelId, selectedUrgency]
  );

  const daysSince = (dateStr: string): number => {
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const isLossStage = (stage: FunnelStage): boolean => {
    if (stage.isExitStage !== undefined) return stage.isExitStage;
    const name = stage.name.toLowerCase();
    return name.includes('perdid') || name.includes('desist');
  };

  const getMissingRequiredFields = (patient: Patient, stage: FunnelStage): string[] => {
    if (!stage.requiredFields || stage.requiredFields.length === 0) return [];
    return stage.requiredFields.filter((field) => {
      const value = (patient as any)[field];
      return value === undefined || value === null || value === '';
    });
  };

  const attemptMoveStage = async (patient: Patient, targetStage: FunnelStage) => {
    const missing = getMissingRequiredFields(patient, targetStage);
    if (targetStage.lockAdvanceWithoutRequiredFields && missing.length > 0) {
      error(
        'Campos obrigatórios pendentes',
        `Para mover para "${targetStage.name}", preencha antes: ${missing.map((f) => REQUIRED_FIELD_LABELS[f] || f).join(', ')}.`
      );
      return;
    }

    if (isLossStage(targetStage)) {
      setLossModalPatient(patient);
      setLossModalTargetStage(targetStage.id);
      setLossReason('');
      return;
    }

    await moveStage(patient.id, targetStage.id, targetStage.name);
  };

  const moveStage = async (patientId: string, stageId: string, stageName: string, extraNote?: string) => {
    try {
      const updates: Partial<Patient> = { funnelStage: stageId };
      if (extraNote) updates.notes = extraNote;
      const res = await apiService.updatePatient(patientId, updates);
      setPatients((prev) => prev.map((p) => (p.id === patientId ? res.patient : p)));
      success('Etapa Atualizada', `${res.patient.name} movido para "${stageName}".`);
    } catch (err: any) {
      error('Erro ao mover etapa', err.message);
    }
  };

  const handleConfirmLoss = async () => {
    if (!lossModalPatient || !lossReason.trim()) return;
    setIsSavingLoss(true);
    const targetStage = stages.find((s) => s.id === lossModalTargetStage);
    const notePrefix = `[Motivo de perda/desistência — ${new Date().toLocaleDateString('pt-BR')}]: ${lossReason.trim()}`;
    await moveStage(lossModalPatient.id, lossModalTargetStage, targetStage?.name || 'etapa de saída', notePrefix);
    setIsSavingLoss(false);
    setLossModalPatient(null);
    setLossReason('');
  };

  const handleDrop = (stage: FunnelStage) => {
    setDragOverStageId(null);
    if (!draggedPatientId) return;
    const patient = funnelPatients.find((p) => p.id === draggedPatientId);
    setDraggedPatientId(null);
    if (!patient || patient.funnelStage === stage.id) return;
    attemptMoveStage(patient, stage);
  };

  const stalledCount = funnelPatients.filter((p) => daysSince(p.lastInteractionAt) > 3).length;
  const criticalCount = funnelPatients.filter((p) => p.urgency === 'critica' || p.urgency === 'alta').length;
  const healthyCount = funnelPatients.length - stalledCount - criticalCount > 0 ? funnelPatients.length - stalledCount - criticalCount : funnelPatients.length - Math.max(stalledCount, criticalCount);

  const maxStageVolume = Math.max(1, ...stages.map((s) => funnelPatients.filter((p) => p.funnelStage === s.id).length));

  const initials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  /**
   * Semáforo do Dia — 3 números grandes e clicáveis que já filtram o
   * funil ao clicar (em vez de mini-cards estáticos que só informam).
   */
  const applySemaphoreFilter = (kind: 'critical' | 'stalled' | 'all') => {
    if (kind === 'all') {
      setSelectedUrgency('todas');
      return;
    }
    if (kind === 'critical') {
      setSelectedUrgency(selectedUrgency === 'alta' ? 'todas' : 'alta');
    }
    // "stalled" (parado +3 dias) não tem filtro de urgência equivalente —
    // no Kanban e na Linha do Tempo o destaque amarelo já sinaliza
    // visualmente quem está parado, sem precisar de um filtro à parte.
  };

  return (
    <div className="flex flex-col h-[calc(100vh-61px)] bg-slate-50">
      {/* Header & Filters */}
      <div className="p-5 pb-4 space-y-4 shrink-0 bg-white border-b border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
              <KanbanSquare className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">Jornadas Clínicas & Funil de Pacientes</h2>
              <p className="text-[11px] text-slate-500">Da entrada até a consulta e pós-atendimento, tudo num fluxo visual.</p>
            </div>
          </div>

          <button
            onClick={onOpenNewPatientModal}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Novo Paciente
          </button>
        </div>

        {/* Alternador de visualização */}
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
          {(
            [
              { id: 'kanban' as ViewMode, label: 'Kanban', icon: LayoutGrid },
              { id: 'executiva' as ViewMode, label: 'Visão Executiva', icon: BarChart3 },
            ]
          ).map((v) => (
            <button
              key={v.id}
              onClick={() => changeViewMode(v.id)}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                viewMode === v.id ? 'text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {viewMode === v.id && (
                <motion.span layoutId="jornadas-view-pill" className="absolute inset-0 bg-sky-600 rounded-lg" transition={{ type: 'spring', duration: 0.4 }} />
              )}
              <v.icon className="w-3.5 h-3.5 relative z-10" />
              <span className="relative z-10">{v.label}</span>
            </button>
          ))}
        </div>

        {/* Semáforo do Dia — clicável, filtra o funil */}
        <div className="grid grid-cols-3 gap-2.5 max-w-xl">
          <button
            onClick={() => applySemaphoreFilter('all')}
            className={`p-2.5 rounded-xl border text-left transition-all ${
              selectedUrgency === 'todas' ? 'bg-slate-50 border-slate-300 ring-1 ring-slate-300' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">🟢 Fluindo</div>
            <div className="text-lg font-bold text-slate-900 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-slate-400" /> {funnelPatients.length}
            </div>
          </button>
          <div className={`p-2.5 rounded-xl border ${stalledCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
            <div className={`text-[10px] font-semibold uppercase tracking-wide ${stalledCount > 0 ? 'text-amber-700' : 'text-slate-500'}`}>🟡 Parados +3d</div>
            <div className={`text-lg font-bold flex items-center gap-1 ${stalledCount > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
              <AlertTriangle className="w-3.5 h-3.5" /> {stalledCount}
            </div>
          </div>
          <button
            onClick={() => applySemaphoreFilter('critical')}
            className={`p-2.5 rounded-xl border text-left transition-all ${
              selectedUrgency === 'alta' ? 'bg-red-100 border-red-300 ring-1 ring-red-300' : criticalCount > 0 ? 'bg-red-50 border-red-200 hover:border-red-300' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className={`text-[10px] font-semibold uppercase tracking-wide ${criticalCount > 0 ? 'text-red-700' : 'text-slate-500'}`}>🔴 Alta/Crítica</div>
            <div className={`text-lg font-bold flex items-center gap-1 ${criticalCount > 0 ? 'text-red-700' : 'text-slate-900'}`}>
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> {criticalCount}
            </div>
          </button>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          {funnels.length > 1 && (
            <div className="relative">
              <select
                value={selectedFunnelId}
                onChange={(e) => setSelectedFunnelId(e.target.value)}
                className="pl-3 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 appearance-none"
              >
                {funnels.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2 pointer-events-none" />
            </div>
          )}

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

          <select
            value={selectedUrgency}
            onChange={(e) => setSelectedUrgency(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
          >
            <option value="todas">Toda Urgência</option>
            {(['critica', 'alta', 'media', 'baixa'] as UrgencyLevel[]).map((u) => (
              <option key={u} value={u}>
                {URGENCY_LABELS[u]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Área de conteúdo — alterna entre as 3 visualizações */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">Carregando funil...</div>
      ) : stages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
          <KanbanSquare className="w-8 h-8 opacity-40" />
          <p>Nenhum funil configurado ainda.</p>
          <p className="text-[11px]">Configure um funil em Configurações → Gestão de Funis & Etapas.</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {viewMode === 'kanban' && (
            <motion.div key="kanban" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex-1 flex gap-4 overflow-x-auto p-5">
              {stages.map((stage, stageIndex) => {
                const stagePatients = funnelPatients
                  .filter((p) => p.funnelStage === stage.id)
                  // Críticos e altos sempre no topo — não é preciso
                  // rolar a coluna para achar quem precisa de atenção.
                  .sort((a, b) => URGENCY_WEIGHT[a.urgency] - URGENCY_WEIGHT[b.urgency]);
                const isDragOver = dragOverStageId === stage.id;
                const volumePercent = Math.round((stagePatients.length / maxStageVolume) * 100);

                return (
                  <div
                    key={stage.id}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverStageId(stage.id);
                    }}
                    onDragLeave={() => setDragOverStageId((prev) => (prev === stage.id ? null : prev))}
                    onDrop={() => handleDrop(stage)}
                    className={`w-[85vw] sm:w-72 shrink-0 bg-white rounded-2xl border flex flex-col max-h-full overflow-hidden shadow-2xs transition-all ${
                      isDragOver ? 'border-sky-400 ring-2 ring-sky-200 bg-sky-50/40' : 'border-slate-200'
                    }`}
                  >
                    <div className="p-3.5 border-b border-slate-100 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs text-slate-800 truncate flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stage.color || '#64748b' }} />
                          {stage.name}
                        </span>
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">{stagePatients.length}</span>
                      </div>
                      <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${volumePercent}%`, backgroundColor: stage.color || '#64748b' }} />
                      </div>
                    </div>

                    <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1 min-h-[200px]">
                      {stagePatients.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-xs italic">Nenhum paciente nesta etapa.</div>
                      ) : (
                        stagePatients.map((p) => {
                          const daysInStage = daysSince(p.lastInteractionAt);
                          const isStalled = daysInStage > 3;
                          const isCriticalOrHigh = p.urgency === 'critica' || p.urgency === 'alta';

                          return (
                            <motion.div
                              key={p.id}
                              layout
                              draggable
                              onDragStart={() => setDraggedPatientId(p.id)}
                              onDragEnd={() => setDraggedPatientId(null)}
                              onClick={() => setPreviewPatient(p)}
                              animate={isCriticalOrHigh ? { boxShadow: ['0 0 0 0 rgba(239,68,68,0)', '0 0 0 4px rgba(239,68,68,0.08)', '0 0 0 0 rgba(239,68,68,0)'] } : {}}
                              transition={isCriticalOrHigh ? { duration: 2.5, repeat: Infinity, ease: 'easeInOut' } : {}}
                              className={`relative overflow-hidden bg-white rounded-xl border hover:shadow-md transition-shadow group cursor-grab active:cursor-grabbing ${
                                isStalled ? 'border-amber-200' : 'border-slate-200'
                              } ${draggedPatientId === p.id ? 'opacity-40' : ''}`}
                            >
                              <div className={`absolute left-0 top-0 bottom-0 w-1 ${URGENCY_BAR[p.urgency]}`} />

                              <div className="p-3 pl-3.5 space-y-2">
                                <div className="flex items-start gap-2">
                                  {p.photoUrl ? (
                                    <img src={p.photoUrl} alt={p.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                                  ) : (
                                    <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                                      {initials(p.name)}
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="font-bold text-xs text-slate-900 group-hover:text-sky-600 transition-colors truncate">{p.name}</div>
                                    <div className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
                                      <Phone className="w-2.5 h-2.5 shrink-0" /> {p.phone}
                                    </div>
                                  </div>
                                </div>

                                <div className="text-[11px] text-slate-500">
                                  {p.specialty} • <span className="font-medium text-slate-700">{p.healthInsurance}</span>
                                </div>

                                <div className={`text-[10px] flex items-center gap-1 ${isStalled ? 'text-amber-700 font-semibold' : 'text-slate-400'}`}>
                                  <Clock className="w-3 h-3" />
                                  <span>{daysInStage === 0 ? 'Hoje' : `há ${daysInStage} dia${daysInStage > 1 ? 's' : ''} nesta etapa`}</span>
                                </div>

                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]" onClick={(e) => e.stopPropagation()}>
                                  <button onClick={() => onSelectPatient(p.id)} className="text-sky-600 hover:text-sky-800 font-semibold">
                                    Abrir Atendimento
                                  </button>

                                  <div className="flex items-center gap-1">
                                    {stageIndex > 0 && (
                                      <button
                                        onClick={() => attemptMoveStage(p, stages[stageIndex - 1])}
                                        className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                                        title={`Retroceder para "${stages[stageIndex - 1].name}"`}
                                      >
                                        <ArrowLeft className="w-3 h-3" />
                                      </button>
                                    )}
                                    {stageIndex < stages.length - 1 && (
                                      <button
                                        onClick={() => attemptMoveStage(p, stages[stageIndex + 1])}
                                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium flex items-center gap-0.5"
                                        title={`Avançar para "${stages[stageIndex + 1].name}"`}
                                      >
                                        <span>Avançar</span>
                                        <ArrowRight className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}

          {viewMode === 'executiva' && (
            <motion.div key="executiva" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex-1 overflow-y-auto p-5">
              {/* Visão Executiva — dado real do histórico de transições,
                  comparado contra as metas configuradas em Configurações.
                  Sem meta configurada numa etapa, ela só mostra o número,
                  sem julgamento visual (não inventamos uma meta padrão). */}
              {isLoadingAnalytics ? (
                <div className="text-center py-16 text-slate-400 text-xs">Calculando métricas do funil...</div>
              ) : !analytics || analytics.stages.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs">
                  Ainda não há histórico de movimentações suficiente neste funil para calcular métricas.
                </div>
              ) : (
                <div className="max-w-3xl mx-auto space-y-4">
                  {analytics.stages.map((s) => (
                    <div key={s.stageId} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-900">{s.stageName}</span>
                        <span className="text-[11px] text-slate-500">
                          {s.enteredCount} entraram • {s.leftCount} avançaram
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* Conversão real — só avaliada contra a meta se uma meta existir */}
                        <div
                          className={`p-2.5 rounded-xl border ${
                            s.meetsConversionGoal === true
                              ? 'bg-emerald-50 border-emerald-200'
                              : s.meetsConversionGoal === false
                              ? 'bg-rose-50 border-rose-200'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Conversão Real</div>
                          <div
                            className={`text-lg font-bold ${
                              s.meetsConversionGoal === true ? 'text-emerald-700' : s.meetsConversionGoal === false ? 'text-rose-700' : 'text-slate-900'
                            }`}
                          >
                            {s.conversionPercent !== null ? `${s.conversionPercent}%` : '—'}
                          </div>
                          {s.goal?.minConversionPercent !== undefined && (
                            <div className="text-[10px] text-slate-400">Meta: ≥{s.goal.minConversionPercent}%</div>
                          )}
                        </div>

                        {/* Tempo médio na etapa — idem, só avaliado com meta configurada */}
                        <div
                          className={`p-2.5 rounded-xl border ${
                            s.meetsDurationGoal === true
                              ? 'bg-emerald-50 border-emerald-200'
                              : s.meetsDurationGoal === false
                              ? 'bg-rose-50 border-rose-200'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Tempo Médio</div>
                          <div
                            className={`text-lg font-bold ${
                              s.meetsDurationGoal === true ? 'text-emerald-700' : s.meetsDurationGoal === false ? 'text-rose-700' : 'text-slate-900'
                            }`}
                          >
                            {s.avgDurationDays !== null ? `${s.avgDurationDays}d` : '—'}
                          </div>
                          {s.goal?.maxDaysInStage !== undefined && <div className="text-[10px] text-slate-400">Meta: ≤{s.goal.maxDaysInStage}d</div>}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Motivos de perda agregados — só aparece se houver dado real */}
                  {analytics.topLossReasons.length > 0 && (
                    <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
                      <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-500" /> Motivos de Perda Mais Comuns
                      </span>
                      <div className="space-y-1.5">
                        {analytics.topLossReasons.map((r, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded-lg">
                            <span className="text-slate-700">{r.example}</span>
                            <span className="font-bold text-slate-500 shrink-0 ml-2">{r.count}×</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      )}

      {/* Modal de motivo — ao mover para etapa de perda/desistência */}
      {lossModalPatient && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => !isSavingLoss && setLossModalPatient(null)}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-bold text-slate-900 text-sm">Mover {lossModalPatient.name} para esta etapa?</h4>
            <p className="text-slate-500 text-xs">Registre o motivo — ajuda a entender por que os atendimentos se perdem ao longo do funil.</p>
            <textarea
              autoFocus
              rows={3}
              value={lossReason}
              onChange={(e) => setLossReason(e.target.value)}
              placeholder="Ex.: Paciente não retornou contato após 3 tentativas."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs resize-none"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setLossModalPatient(null)} disabled={isSavingLoss} className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold text-xs disabled:opacity-50">
                Cancelar
              </button>
              <button
                onClick={handleConfirmLoss}
                disabled={isSavingLoss || !lossReason.trim()}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs disabled:opacity-40 transition-colors"
              >
                {isSavingLoss ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview rápido do card, sem navegar para Atendimentos */}
      {previewPatient && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => setPreviewPatient(null)}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-sm">{previewPatient.name}</h4>
              <button onClick={() => setPreviewPatient(null)} className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-slate-600 space-y-1.5">
              <div>
                <span className="font-semibold text-slate-500">Telefone:</span> {previewPatient.phone}
              </div>
              <div>
                <span className="font-semibold text-slate-500">Especialidade:</span> {previewPatient.specialty}
              </div>
              <div>
                <span className="font-semibold text-slate-500">Convênio:</span> {previewPatient.healthInsurance || 'Não informado'}
              </div>
              <div>
                <span className="font-semibold text-slate-500">Urgência:</span> {URGENCY_LABELS[previewPatient.urgency]}
              </div>
              {previewPatient.notes && (
                <div>
                  <span className="font-semibold text-slate-500">Notas:</span> {previewPatient.notes}
                </div>
              )}
            </div>
            <button
              onClick={() => {
                onSelectPatient(previewPatient.id);
                setPreviewPatient(null);
              }}
              className="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition-colors"
            >
              Abrir Atendimento Completo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
