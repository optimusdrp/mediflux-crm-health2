'use client';

import React, { useState } from 'react';
import { DuplicateMatch, Patient } from '@/lib/types';
import { apiService } from '@/lib/services/api';
import { useToast } from '@/contexts/ToastContext';
import {
  Users,
  X,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  Merge,
  ShieldAlert,
} from 'lucide-react';

interface DuplicateMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicates: DuplicateMatch[];
  onMergeComplete: () => void;
}

export function DuplicateMergeModal({
  isOpen,
  onClose,
  duplicates,
  onMergeComplete,
}: DuplicateMergeModalProps) {
  const { success, error, warning } = useToast();
  const [selectedMatchIndex, setSelectedMatchIndex] = useState<number>(0);
  const [chosenPrimaryId, setChosenPrimaryId] = useState<string>('');
  const [isMerging, setIsMerging] = useState(false);

  if (!isOpen) return null;

  const currentMatch = duplicates[selectedMatchIndex];

  const handleMerge = async () => {
    if (!currentMatch) return;

    const p1 = currentMatch.primaryPatient;
    const p2 = currentMatch.duplicateCandidate;

    const primaryId = chosenPrimaryId || p1.id;
    const secondaryId = primaryId === p1.id ? p2.id : p1.id;

    setIsMerging(true);
    try {
      const response = await apiService.mergePatients(primaryId, secondaryId);
      success('Unificação Concluída', `Registro mantido com sucesso para ${response.patient.name}.`);
      onMergeComplete();
      if (duplicates.length <= 1) {
        onClose();
      } else {
        setSelectedMatchIndex(0);
      }
    } catch (err: any) {
      error('Falha na Unificação', err.message || 'Erro ao unificar pacientes.');
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/30 text-amber-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Detecção e Unificação de Pacientes Duplicados</h3>
              <p className="text-xs text-slate-400">
                Seleção estritamente humana do registro principal e mescla automática de histórico.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {duplicates.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h4 className="font-bold text-slate-800 text-base">Nenhum paciente duplicado detectado!</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                A base de dados da clínica está limpa e íntegra. Não há registros com CPF, telefone ou similaridade nominal duplicados.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Top selector if multiple matches */}
              {duplicates.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-500 shrink-0">Ocorrências ({duplicates.length}):</span>
                  {duplicates.map((m, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedMatchIndex(idx);
                        setChosenPrimaryId('');
                      }}
                      className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors shrink-0 ${
                        selectedMatchIndex === idx
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Par #{idx + 1} ({m.confidenceScore}% similaridade)
                    </button>
                  ))}
                </div>
              )}

              {/* Confidence Banner */}
              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold text-amber-900">
                      Critério de correspondência:{' '}
                      {currentMatch.matchReason === 'cpf_exato'
                        ? 'CPF Idêntico'
                        : currentMatch.matchReason === 'telefone_exato'
                        ? 'Telefone Idêntico'
                        : 'Similaridade de Nome e Dados'}
                    </span>
                    <p className="text-amber-800 mt-0.5">
                      Confiança do algoritmo: <strong>{currentMatch.confidenceScore}%</strong>. A decisão final é obrigatória pelo operador.
                    </p>
                  </div>
                </div>
              </div>

              {/* Side by side comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option 1 */}
                <div
                  onClick={() => setChosenPrimaryId(currentMatch.primaryPatient.id)}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    (chosenPrimaryId === currentMatch.primaryPatient.id || !chosenPrimaryId)
                      ? 'border-sky-600 bg-sky-50/40 shadow-xs'
                      : 'border-slate-200 bg-slate-50/50 opacity-80 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-800">
                      Registro A (Mais Antigo / Principal)
                    </span>
                    <input
                      type="radio"
                      name="primaryChoice"
                      checked={chosenPrimaryId === currentMatch.primaryPatient.id || !chosenPrimaryId}
                      onChange={() => setChosenPrimaryId(currentMatch.primaryPatient.id)}
                      className="w-4 h-4 text-sky-600"
                    />
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-400">Nome:</span>
                      <p className="font-bold text-slate-800 text-sm">{currentMatch.primaryPatient.name}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-slate-400">CPF:</span>
                        <p className="font-medium text-slate-700">{currentMatch.primaryPatient.cpf || 'Não preenchido'}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Telefone:</span>
                        <p className="font-medium text-slate-700">{currentMatch.primaryPatient.phone}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-slate-400">Convênio:</span>
                        <p className="font-medium text-slate-700">{currentMatch.primaryPatient.healthInsurance}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Especialidade:</span>
                        <p className="font-medium text-slate-700">{currentMatch.primaryPatient.specialty}</p>
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Observações:</span>
                      <p className="text-slate-600 italic bg-white p-2 rounded border border-slate-200 mt-0.5">
                        {currentMatch.primaryPatient.notes || 'Sem observações'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Option 2 */}
                <div
                  onClick={() => setChosenPrimaryId(currentMatch.duplicateCandidate.id)}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    chosenPrimaryId === currentMatch.duplicateCandidate.id
                      ? 'border-sky-600 bg-sky-50/40 shadow-xs'
                      : 'border-slate-200 bg-slate-50/50 opacity-80 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Registro B (Candidato a Duplicado)
                    </span>
                    <input
                      type="radio"
                      name="primaryChoice"
                      checked={chosenPrimaryId === currentMatch.duplicateCandidate.id}
                      onChange={() => setChosenPrimaryId(currentMatch.duplicateCandidate.id)}
                      className="w-4 h-4 text-sky-600"
                    />
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-400">Nome:</span>
                      <p className="font-bold text-slate-800 text-sm">{currentMatch.duplicateCandidate.name}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-slate-400">CPF:</span>
                        <p className="font-medium text-slate-700">{currentMatch.duplicateCandidate.cpf || 'Não preenchido'}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Telefone:</span>
                        <p className="font-medium text-slate-700">{currentMatch.duplicateCandidate.phone}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-slate-400">Convênio:</span>
                        <p className="font-medium text-slate-700">{currentMatch.duplicateCandidate.healthInsurance}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Especialidade:</span>
                        <p className="font-medium text-slate-700">{currentMatch.duplicateCandidate.specialty}</p>
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Observações:</span>
                      <p className="text-slate-600 italic bg-white p-2 rounded border border-slate-200 mt-0.5">
                        {currentMatch.duplicateCandidate.notes || 'Sem observações'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Merge Actions summary */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Merge className="w-4 h-4 text-sky-600" /> Como funcionará a unificação:
                </div>
                <div>1. O registro selecionado será mantido como o paciente oficial.</div>
                <div>2. Dados faltantes (CPF, convênio, data de nascimento) serão copiados do registro secundário.</div>
                <div>3. Todo o histórico de mensagens de chat e agendamentos será reatribuído ao paciente principal.</div>
                <div>4. O registro secundário será removido e a ação será registrada no log de auditoria LGPD.</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancelar
          </button>

          {duplicates.length > 0 && (
            <button
              onClick={handleMerge}
              disabled={isMerging}
              className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
            >
              <Merge className="w-4 h-4" />
              {isMerging ? 'Unificando...' : 'Confirmar Unificação de Registros'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
