'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { InternalChatThread, InternalChatMessage, User } from '@/lib/types';
import { apiService } from '@/lib/services/api';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  MessageCircle,
  Send,
  Plus,
  Users,
  X,
  Search,
  ArrowLeft,
} from 'lucide-react';

type EnrichedThread = InternalChatThread & { displayName?: string; unreadCount: number };

/**
 * Chat Interno — conversas entre usuários da equipe, separadas por
 * completo do chat com pacientes (que usa WhatsApp/canais externos).
 * Qualquer usuário ATIVO da clínica já está disponível para iniciar
 * uma conversa — não existe convite manual nem lista de contatos
 * própria: mandar a primeira mensagem já cria a conversa
 * automaticamente.
 */
export function ChatInternoView() {
  const { user: currentUser } = useAuth();
  const { success, error } = useToast();
  const [threads, setThreads] = useState<EnrichedThread[]>([]);
  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<InternalChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState('');

  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchThreads = async () => {
    setIsLoadingThreads(true);
    try {
      const res = await apiService.getInternalChatThreads();
      setThreads(res.threads || []);
    } catch (err: any) {
      error('Erro ao carregar conversas', err.message);
    } finally {
      setIsLoadingThreads(false);
    }
  };

  useEffect(() => {
    fetchThreads();
  }, []);

  const openThread = async (threadId: string) => {
    setSelectedThreadId(threadId);
    setIsLoadingMessages(true);
    try {
      const res = await apiService.getInternalChatMessages(threadId);
      setMessages(res.messages || []);
      await apiService.markInternalChatThreadRead(threadId);
      setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, unreadCount: 0 } : t)));
    } catch (err: any) {
      error('Erro ao carregar mensagens', err.message);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || !selectedThreadId) return;
    setIsSending(true);
    const text = inputText.trim();
    setInputText('');
    try {
      const res = await apiService.sendInternalChatMessage({ threadId: selectedThreadId, text });
      setMessages((prev) => [...prev, res.message]);
      fetchThreads();
    } catch (err: any) {
      error('Falha ao enviar mensagem', err.message);
      setInputText(text);
    } finally {
      setIsSending(false);
    }
  };

  const openNewChatModal = async () => {
    setUserSearch('');
    setIsNewChatModalOpen(true);
    try {
      const res = await apiService.getUsers();
      setActiveUsers((res.users || []).filter((u) => u.active && u.id !== currentUser?.id));
    } catch (err: any) {
      error('Erro ao carregar usuários', err.message);
    }
  };

  const startDirectChat = async (recipientUserId: string) => {
    setIsNewChatModalOpen(false);
    try {
      const res = await apiService.sendInternalChatMessage({ recipientUserId, text: '👋' });
      await fetchThreads();
      openThread(res.threadId);
    } catch (err: any) {
      error('Falha ao iniciar conversa', err.message);
    }
  };

  const openNewGroupModal = async () => {
    setGroupName('');
    setSelectedParticipants([]);
    setIsNewGroupModalOpen(true);
    try {
      const res = await apiService.getUsers();
      setActiveUsers((res.users || []).filter((u) => u.active && u.id !== currentUser?.id));
    } catch (err: any) {
      error('Erro ao carregar usuários', err.message);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedParticipants.length < 2) return;
    setIsCreatingGroup(true);
    try {
      const res = await apiService.createInternalChatGroup({ name: groupName.trim(), participantUserIds: selectedParticipants });
      await fetchThreads();
      openThread(res.thread.id);
      success('Grupo Criado', `"${res.thread.name}" foi criado.`);
      setIsNewGroupModalOpen(false);
    } catch (err: any) {
      error('Falha ao criar grupo', err.message);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const filteredActiveUsers = useMemo(
    () => activeUsers.filter((u) => u.name.toLowerCase().includes(userSearch.toLowerCase())),
    [activeUsers, userSearch]
  );

  const selectedThread = threads.find((t) => t.id === selectedThreadId);

  const initials = (name?: string) =>
    (name || '?').split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="flex h-[calc(100vh-61px)] bg-slate-50">
      {/* Coluna de conversas */}
      <div className={`${selectedThreadId ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 shrink-0 bg-white border-r border-slate-200 flex-col`}>
        <div className="p-4 border-b border-slate-200 space-y-3">
          <h2 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
            <MessageCircle className="w-4 h-4 text-sky-600" /> Chat Interno
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={openNewChatModal} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-bold transition-colors">
              <Plus className="w-3.5 h-3.5" /> Nova Conversa
            </button>
            <button onClick={openNewGroupModal} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-bold transition-colors">
              <Users className="w-3.5 h-3.5" /> Novo Grupo
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoadingThreads ? (
            <div className="p-6 text-center text-slate-400 text-xs">Carregando conversas...</div>
          ) : threads.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">Nenhuma conversa ainda. Clique em + para começar.</div>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                onClick={() => openThread(t.id)}
                className={`w-full flex items-center gap-3 p-3 border-b border-slate-100 text-left hover:bg-slate-50 transition-colors ${
                  selectedThreadId === t.id ? 'bg-sky-50' : ''
                }`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${t.isGroup ? 'bg-indigo-600' : 'bg-slate-900'} text-white`}>
                  {t.isGroup ? <Users className="w-4 h-4" /> : initials(t.displayName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-slate-900 truncate">{t.isGroup ? t.name : t.displayName}</span>
                    {t.unreadCount > 0 && (
                      <span className="shrink-0 w-4 h-4 rounded-full bg-sky-600 text-white text-[9px] font-bold flex items-center justify-center">{t.unreadCount}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">{t.lastMessagePreview || 'Sem mensagens ainda'}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Coluna da conversa ativa */}
      <div className={`${selectedThreadId ? 'flex' : 'hidden lg:flex'} flex-1 flex-col`}>
        {selectedThread ? (
          <>
            <div className="p-3.5 bg-white border-b border-slate-200 flex items-center gap-2.5">
              <button onClick={() => setSelectedThreadId(null)} className="lg:hidden p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${selectedThread.isGroup ? 'bg-indigo-600' : 'bg-slate-900'} text-white`}>
                {selectedThread.isGroup ? <Users className="w-3.5 h-3.5" /> : initials(selectedThread.displayName)}
              </div>
              <span className="font-bold text-xs text-slate-900">{selectedThread.isGroup ? selectedThread.name : selectedThread.displayName}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {isLoadingMessages ? (
                <div className="text-center text-slate-400 text-xs py-6">Carregando mensagens...</div>
              ) : (
                messages.map((m) => {
                  const isMine = m.senderUserId === currentUser?.id;
                  return (
                    <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-xs ${isMine ? 'bg-sky-600 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'}`}>
                        {m.text}
                        <div className={`text-[9px] mt-1 ${isMine ? 'text-sky-100' : 'text-slate-400'}`}>
                          {new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
              <input
                type="text"
                placeholder="Digite uma mensagem..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-1 focus:ring-sky-500"
              />
              <button
                onClick={handleSend}
                disabled={isSending || !inputText.trim()}
                className="p-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl transition-colors disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">Selecione uma conversa para começar.</div>
        )}
      </div>

      {/* Modal de nova conversa 1-a-1 */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4" onClick={() => setIsNewChatModalOpen(false)}>
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3 shadow-xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-sm">Nova Conversa</h4>
              <button onClick={() => setIsNewChatModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Buscar colega..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-xl text-xs"
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {filteredActiveUsers.length === 0 ? (
                <p className="text-center text-slate-400 text-xs py-4">Nenhum usuário ativo encontrado.</p>
              ) : (
                filteredActiveUsers.map((u) => (
                  <button key={u.id} onClick={() => startDirectChat(u.id)} className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 transition-colors text-left">
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold shrink-0">{initials(u.name)}</div>
                    <div>
                      <div className="font-bold text-xs text-slate-900">{u.name}</div>
                      <div className="text-[10px] text-slate-500">{u.role}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de novo grupo */}
      {isNewGroupModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4" onClick={() => !isCreatingGroup && setIsNewGroupModalOpen(false)}>
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3 shadow-xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-sm">Novo Grupo</h4>
              <button onClick={() => setIsNewGroupModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1 text-xs">Nome do grupo</label>
              <input
                type="text"
                placeholder="Ex.: Equipe Recepção"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1 text-xs">
                Participantes <span className="text-slate-400 font-normal">(mínimo 2, só usuários ativos)</span>
              </label>
              <div className="max-h-48 overflow-y-auto space-y-1 border border-slate-200 rounded-xl p-1.5">
                {activeUsers.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={selectedParticipants.includes(u.id)}
                      onChange={(e) =>
                        setSelectedParticipants((prev) => (e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)))
                      }
                    />
                    <span>{u.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setIsNewGroupModalOpen(false)} disabled={isCreatingGroup} className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold text-xs disabled:opacity-50">
                Cancelar
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={isCreatingGroup || !groupName.trim() || selectedParticipants.length < 2}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs disabled:opacity-40 transition-colors"
              >
                {isCreatingGroup ? 'Criando...' : 'Criar Grupo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
