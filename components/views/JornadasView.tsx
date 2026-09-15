'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';

interface JornadasViewProps {
  onSelectPatient: (id: string) => void;
  onOpenNewPatientModal: () => void;
}

const URGENCY_DOT: Record<UrgencyLevel, string> = {
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

const REQUIRED_FIELD_LABELS: Record<string, string> = {
  cpf: 'CPF',
  healthInsurance: 'Convênio',
  planNumber: 'Nº do Plano',
  birthDate: 'Data de Nascimento',
  phone: 'Telefone',
  specialty: 'Especialidade',
};

/**
 * Jornadas Clínicas & Funil de Pacientes — reescrita completa.
 *
 * Antes: 5 etapas FIXAS, hard-coded no componente, sem nenhuma
 * relação com os funis reais que a clínica configura em
 * Configurações → Gestão de Funis & Etapas (nome, cor, ordem, campos
 * obrigatórios por etapa — todos esses dados já existiam e já
 * persistiam, só esta tela nunca os usava). Um admin podia criar um
 * funil customizado inteiro e esta tela continuava mostrando as
 * mesmas 5 colunas de sempre.
 *
 * Agora: busca os funis reais (ClinicSettings.funnels), com seletor
 * quando há mais de um; monta as colunas a partir das FunnelStage de
 * cada funil; respeita requiredFields/lockAdvanceWithoutRequiredFields
 * ao tentar avançar; permite avançar E retroceder; drag-and-drop real
 * entre colunas; pede motivo ao mover para a última etapa de um funil
 * "de saída" (perdido/desistência — identificado pelo nome da etapa,
 * já que o schema não tem um campo dedicado "isLossStage"); mostra há
 * quanto tempo o paciente está parado na etapa atual; filtro de
 * urgência; resumo no topo; e um preview rápido ao clicar no card,
 * sem precisar navegar para Atendimentos.
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

  // Conversas arquivadas somem da fila de Atendimentos — faz sentido
  // que também não poluam o funil, que é sobre atendimento ativo.
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

  // Etapa "de saída" — identificada pelo nome conter "perdid" ou
  // "desist", já que o schema de FunnelStage não tem um campo
  // dedicado para marcar isso. Cobre o caso do funil padrão
  // ("Perdido / Desistência") e qualquer funil customizado que use
  // nomenclatura parecida; funis que não tiverem uma etapa assim
  // simplesmente nunca pedem o motivo.
  const isLossStage = (stage: FunnelStage): boolean => {
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
    // Motivo de perda registrado nas notas do paciente — o schema de
    // Patient não tem um campo dedicado para isso; notes já é onde o
    // resto do sistema guarda observações de texto livre sobre o
    // paciente, então é o lugar consistente para isso também.
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

  // Resumo: pacientes parados há mais de 3 dias na etapa atual —
  // sinal simples de possível gargalo, sem introduzir uma métrica
  // nova complexa.
  const stalledCount = funnelPatients.filter((p) => daysSince(p.lastInteractionAt) > 3).length;

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto flex flex-col h-[calc(100vh-61px)]">
      {/* Header & Filters */}
      <div className="flex flex-col gap-3 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <KanbanSquare className="w-5 h-5 text-sky-600" />
              <h2 className="text-lg font-bold text-slate-900">Jornadas Clínicas & Funil de Pacientes</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Acompanhamento visual do fluxo de atendimento, desde a entrada até a consulta e pós-atendimento.
            </p>
          </div>

          <button
            onClick={onOpenNewPatientModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Novo Paciente
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seletor de funil — só aparece de fato como escolha quando há mais de um configurado */}
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

          {/* Resumo rápido */}
          <div className="flex items-center gap-3 ml-auto text-[11px] text-slate-500">
            <span className="font-semibold text-slate-700">{funnelPatients.length} paciente(s)</span>
            {stalledCount > 0 && (
              <span className="flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                <AlertTriangle className="w-3 h-3" /> {stalledCount} parado(s) há +3 dias
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Kanban Board Container */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">Carregando funil...</div>
      ) : stages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
          <KanbanSquare className="w-8 h-8 opacity-40" />
          <p>Nenhum funil configurado ainda.</p>
          <p className="text-[11px]">Configure um funil em Configurações → Gestão de Funis & Etapas.</p>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-4 items-start">
          {stages.map((stage, stageIndex) => {
            const stagePatients = funnelPatients.filter((p) => p.funnelStage === stage.id);
            const isDragOver = dragOverStageId === stage.id;

            return (
              <div
                key={stage.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverStageId(stage.id);
                }}
                onDragLeave={() => setDragOverStageId((prev) => (prev === stage.id ? null : prev))}
                onDrop={() => handleDrop(stage)}
                className={`bg-slate-100/80 rounded-2xl border flex flex-col max-h-full overflow-hidden border-t-4 transition-colors ${
                  isDragOver ? 'border-sky-400 bg-sky-50/60' : 'border-slate-200'
                }`}
                style={{ borderTopColor: stage.color }}
              >
                {/* Column Header */}
                <div className="p-3.5 bg-white border-b border-slate-200/80 flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800 truncate">{stage.name}</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">{stagePatients.length}</span>
                </div>

                {/* Cards Scrollable */}
                <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1 min-h-[300px]">
                  {stagePatients.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-xs italic">Nenhum paciente nesta etapa.</div>
                  ) : (
                    stagePatients.map((p) => {
                      const daysInStage = daysSince(p.lastInteractionAt);
                      const isStalled = daysInStage > 3;

                      return (
                        <div
                          key={p.id}
                          draggable
                          onDragStart={() => setDraggedPatientId(p.id)}
                          onDragEnd={() => setDraggedPatientId(null)}
                          onClick={() => setPreviewPatient(p)}
                          className={`bg-white p-3.5 rounded-xl border shadow-2xs hover:shadow-xs transition-all space-y-2 group cursor-grab active:cursor-grabbing ${
                            isStalled ? 'border-amber-200' : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <span className="font-bold text-xs text-slate-900 group-hover:text-sky-600 transition-colors">{p.name}</span>
                            <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${URGENCY_DOT[p.urgency]}`} title={`Urgência: ${URGENCY_LABELS[p.urgency]}`} />
                          </div>

                          <div className="text-[11px] text-slate-500 space-y-0.5">
                            <div>
                              {p.specialty} • <span className="font-medium text-slate-700">{p.healthInsurance}</span>
                            </div>
                            <div className={`text-[10px] flex items-center gap-1 ${isStalled ? 'text-amber-700 font-semibold' : 'text-slate-400'}`}>
                              <Clock className="w-3 h-3" />
                              <span>{daysInStage === 0 ? 'Hoje' : `há ${daysInStage} dia${daysInStage > 1 ? 's' : ''} nesta etapa`}</span>
                            </div>
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
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
