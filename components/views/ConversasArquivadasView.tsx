'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { apiService } from '@/lib/services/api';
import { useToast } from '@/contexts/ToastContext';
import { Patient, ChatMessage, User } from '@/lib/types';
import {
  Archive,
  RotateCcw,
  Search,
  MessageSquareText,
  Calendar,
  User as UserIcon,
  Trash2,
  X,
  Filter,
  ChevronDown,
} from 'lucide-react';

/**
 * Conversas Arquivadas — refatorada. Antes só listava e permitia
 * reabrir. Funcionalidades novas, pensadas a partir do que uma
 * clínica precisaria de verdade ao revisitar atendimentos
 * finalizados:
 *  - Ver o histórico de mensagens sem precisar reabrir a conversa
 *    (consulta rápida, a conversa continua arquivada depois de ver).
 *  - Nome de quem arquivou, não só o motivo — resolvido a partir de
 *    GET /users (já existente), sem precisar de rota nova.
 *  - Filtro por período de arquivamento e por quem arquivou — útil
 *    para revisão de equipe e para achar um atendimento específico
 *    num histórico que só cresce.
 *  - Exclusão definitiva (LGPD) — mesma ação sensível já disponível
 *    em Atendimentos, com o mesmo controle de permissão.
 *  - Contador no topo, refletindo o filtro atual.
 */
export function ConversasArquivadasView({ onReopenAndNavigate }: { onReopenAndNavigate?: (patientId: string) => void }) {
  const { success, error } = useToast();
  const [archivedPatients, setArchivedPatients] = useState<Patient[]>([]);
  const [usersById, setUsersById] = useState<Record<string, User>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [reopeningId, setReopeningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterUserId, setFilterUserId] = useState<string>('todos');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const [historyPatient, setHistoryPatient] = useState<Patient | null>(null);
  const [historyMessages, setHistoryMessages] = useState<ChatMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<Patient | null>(null);

  const fetchArchived = async () => {
    setIsLoading(true);
    try {
      const [patientsRes, usersRes] = await Promise.allSettled([
        apiService.getPatients({ conversationStatus: 'archived' }),
        apiService.getUsers(),
      ]);
      if (patientsRes.status === 'fulfilled') setArchivedPatients(patientsRes.value.patients || []);
      if (usersRes.status === 'fulfilled') {
        const map: Record<string, User> = {};
        usersRes.value.users.forEach((u) => (map[u.id] = u));
        setUsersById(map);
      }
      if (patientsRes.status === 'rejected') throw patientsRes.reason;
    } catch (err: any) {
      error('Falha ao carregar conversas arquivadas', err?.message || 'Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchArchived();
  }, []);

  const filteredPatients = useMemo(() => {
    return archivedPatients.filter((p) => {
      const matchesSearch = !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()) || p.phone.includes(search);
      const matchesUser = filterUserId === 'todos' || p.archivedByUserId === filterUserId;
      const archivedDate = p.archivedAt ? new Date(p.archivedAt) : null;
      const matchesFrom = !filterDateFrom || (archivedDate && archivedDate >= new Date(filterDateFrom));
      const matchesTo = !filterDateTo || (archivedDate && archivedDate <= new Date(`${filterDateTo}T23:59:59`));
      return matchesSearch && matchesUser && matchesFrom && matchesTo;
    });
  }, [archivedPatients, search, filterUserId, filterDateFrom, filterDateTo]);

  const usersWhoArchived = useMemo(() => {
    const ids = new Set(archivedPatients.map((p) => p.archivedByUserId).filter(Boolean) as string[]);
    return Array.from(ids)
      .map((id) => usersById[id])
      .filter(Boolean);
  }, [archivedPatients, usersById]);

  const hasActiveFilters = filterUserId !== 'todos' || !!filterDateFrom || !!filterDateTo;
  const clearFilters = () => {
    setFilterUserId('todos');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

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

  const handleViewHistory = async (patient: Patient) => {
    setHistoryPatient(patient);
    setIsLoadingHistory(true);
    try {
      const res = await apiService.getChatMessages(patient.id);
      setHistoryMessages(res.messages || []);
    } catch (err: any) {
      error('Falha ao carregar histórico', err?.message || 'Tente novamente.');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeletingId(pendingDelete.id);
    try {
      await apiService.deletePatient(pendingDelete.id);
      success('Registro Excluído', `${pendingDelete.name} foi removido em conformidade com a LGPD.`);
      setArchivedPatients((prev) => prev.filter((p) => p.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch (err: any) {
      error('Permissão Insuficiente', err?.message || 'Apenas administradores podem excluir pacientes.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Archive className="w-5 h-5 text-slate-400" /> Conversas Arquivadas
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Histórico de atendimentos finalizados. Se o paciente escrever de novo, a conversa reabre automaticamente na fila de Atendimentos.
          </p>
        </div>
        {!isLoading && (
          <span className="shrink-0 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[11px] font-bold">
            {filteredPatients.length} de {archivedPatients.length}
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
          />
        </div>
        <button
          onClick={() => setIsFilterOpen((prev) => !prev)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors shrink-0 ${
            isFilterOpen || hasActiveFilters ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-white text-slate-600 border border-slate-200'
          }`}
        >
          <Filter className="w-3.5 h-3.5" /> Filtros {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-sky-600" />}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isFilterOpen && (
        <div className="p-4 bg-white rounded-2xl border border-slate-200 flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 w-full">
            <label className="block font-semibold text-slate-600 text-[11px] mb-1">Finalizado por</label>
            <select
              value={filterUserId}
              onChange={(e) => setFilterUserId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
            >
              <option value="todos">Todos</option>
              {usersWhoArchived.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 w-full">
            <label className="block font-semibold text-slate-600 text-[11px] mb-1">De</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
            />
          </div>
          <div className="flex-1 w-full">
            <label className="block font-semibold text-slate-600 text-[11px] mb-1">Até</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
            />
          </div>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 shrink-0">
              Limpar
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-16 text-slate-400 text-xs">Carregando conversas arquivadas...</div>
      ) : filteredPatients.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-xs">
          <Archive className="w-8 h-8 mx-auto mb-2 opacity-40" />
          {archivedPatients.length === 0 ? 'Nenhuma conversa arquivada encontrada.' : 'Nenhuma conversa corresponde aos filtros aplicados.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredPatients.map((p) => {
            const archivedByUser = p.archivedByUserId ? usersById[p.archivedByUserId] : undefined;
            return (
              <div key={p.id} className="p-4 bg-white rounded-2xl border border-slate-200 flex items-start justify-between gap-3">
                <button onClick={() => handleViewHistory(p)} className="min-w-0 space-y-1.5 text-left flex-1 group">
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-bold text-slate-900 text-xs truncate group-hover:text-sky-700 transition-colors">{p.name}</span>
                    <span className="text-[11px] text-slate-400">{p.phone}</span>
                  </div>
                  {p.archivedReason && (
                    <div className="flex items-start gap-1.5 text-[11px] text-slate-600">
                      <MessageSquareText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="italic">&ldquo;{p.archivedReason}&rdquo;</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-slate-400 flex-wrap">
                    {p.archivedAt && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(p.archivedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {archivedByUser && (
                      <span className="flex items-center gap-1">
                        <UserIcon className="w-3 h-3" /> Finalizada por {archivedByUser.name}
                      </span>
                    )}
                  </div>
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setPendingDelete(p)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Excluir definitivamente (LGPD)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleReopen(p)}
                    disabled={reopeningId === p.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> {reopeningId === p.id ? 'Reabrindo...' : 'Reabrir'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de histórico de mensagens — consulta rápida, a conversa continua arquivada */}
      {historyPatient && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => setHistoryPatient(null)}>
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{historyPatient.name}</h4>
                <p className="text-[11px] text-slate-500">Histórico da conversa arquivada</p>
              </div>
              <button onClick={() => setHistoryPatient(null)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {isLoadingHistory ? (
                <div className="text-center py-10 text-slate-400 text-xs">Carregando histórico...</div>
              ) : historyMessages.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">Nenhuma mensagem registrada nesta conversa.</div>
              ) : (
                historyMessages.map((m) => {
                  const isMe = m.sender === 'attendant' || m.sender === 'bot';
                  return (
                    <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`max-w-sm p-2.5 rounded-xl text-[11px] leading-relaxed ${
                          isMe ? 'bg-slate-900 text-white rounded-br-xs' : 'bg-slate-50 text-slate-900 border border-slate-200 rounded-bl-xs'
                        }`}
                      >
                        {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}
                        <div className="text-[9px] mt-1 opacity-60">
                          {new Date(m.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmação de exclusão definitiva */}
      {pendingDelete && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3 shadow-xl">
            <h4 className="font-bold text-slate-900 text-sm">Excluir permanentemente {pendingDelete.name}?</h4>
            <p className="text-slate-500 text-xs">
              Esta ação remove o cadastro e o histórico de conversa em conformidade com a LGPD. Não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setPendingDelete(null)} className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold text-xs">
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deletingId === pendingDelete.id}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs disabled:opacity-50"
              >
                {deletingId === pendingDelete.id ? 'Excluindo...' : 'Excluir Definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
