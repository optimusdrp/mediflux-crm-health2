'use client';

import React, { useState, useEffect } from 'react';
import { apiService } from '@/lib/services/api';
import { useToast } from '@/contexts/ToastContext';
import { Patient } from '@/lib/types';
import { Archive, RotateCcw, Search, MessageSquareText, Calendar, User } from 'lucide-react';

/**
 * Conversas Arquivadas — NOVA. Lista os atendimentos finalizados
 * (conversationStatus === 'archived'), com o motivo do encerramento,
 * quem finalizou e quando. Permite reabrir manualmente a qualquer
 * momento — a reabertura automática (quando o paciente escreve de
 * novo pelo WhatsApp) já acontece sozinha no backend, sem precisar
 * de nenhuma ação aqui.
 */
export function ConversasArquivadasView({ onReopenAndNavigate }: { onReopenAndNavigate?: (patientId: string) => void }) {
  const { success, error } = useToast();
  const [archivedPatients, setArchivedPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [reopeningId, setReopeningId] = useState<string | null>(null);

  const fetchArchived = async () => {
    setIsLoading(true);
    try {
      const res = await apiService.getPatients({ conversationStatus: 'archived' });
      setArchivedPatients(res.patients || []);
    } catch (err: any) {
      error('Falha ao carregar conversas arquivadas', err?.message || 'Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchArchived();
  }, []);

  const filteredPatients = archivedPatients.filter(
    (p) => !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()) || p.phone.includes(search)
  );

  const handleReopen = async (patient: Patient) => {
    setReopeningId(patient.id);
    try {
      await apiService.reopenPatientConversation(patient.id);
      success('Conversa Reaberta', `${patient.name} voltou para a fila de Atendimentos.`);
      setArchivedPatients((prev) => prev.filter((p) => p.id !== patient.id));
      onReopenAndNavigate?.(patient.id);
    } catch (err: any) {
      error('Falha ao reabrir conversa', err?.message || 'Tente novamente.');
    } finally {
      setReopeningId(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Archive className="w-5 h-5 text-slate-400" /> Conversas Arquivadas
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Histórico de atendimentos finalizados. Se o paciente escrever de novo, a conversa reabre automaticamente na fila de Atendimentos.
        </p>
      </div>

      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-slate-400 text-xs">Carregando conversas arquivadas...</div>
      ) : filteredPatients.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-xs">
          <Archive className="w-8 h-8 mx-auto mb-2 opacity-40" />
          Nenhuma conversa arquivada encontrada.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredPatients.map((p) => (
            <div key={p.id} className="p-4 bg-white rounded-2xl border border-slate-200 flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-bold text-slate-900 text-xs truncate">{p.name}</span>
                  <span className="text-[11px] text-slate-400">{p.phone}</span>
                </div>
                {p.archivedReason && (
                  <div className="flex items-start gap-1.5 text-[11px] text-slate-600">
                    <MessageSquareText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="italic">&ldquo;{p.archivedReason}&rdquo;</span>
                  </div>
                )}
                {p.archivedAt && (
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <Calendar className="w-3 h-3" />
                    Finalizada em {new Date(p.archivedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleReopen(p)}
                disabled={reopeningId === p.id}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" /> {reopeningId === p.id ? 'Reabrindo...' : 'Reabrir'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
