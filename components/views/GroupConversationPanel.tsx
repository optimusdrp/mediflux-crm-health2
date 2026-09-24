'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ConversationGroup, ConversationGroupMessage, Contact } from '@/lib/types';
import { apiService } from '@/lib/services/api';
import { useToast } from '@/contexts/ToastContext';
import {
  ChevronsLeft,
  Send,
  Users,
  Bell,
  BellOff,
  Trash2,
  Settings2,
  X,
  MessageSquare,
} from 'lucide-react';

interface GroupConversationPanelProps {
  group: ConversationGroup;
  onGroupUpdated: (updated: ConversationGroup) => void;
  onBack: () => void;
}

/**
 * Painel de conversa de um grupo — abre no lugar do chat normal de
 * paciente quando um card de grupo é selecionado na fila de
 * Atendimentos. Mostra o histórico (se showReplies) ou só um
 * registro do que foi disparado, e permite gerenciar quem está no
 * grupo (remover, sem afetar o atendimento normal daquele contato)
 * e silenciar notificações.
 */
export function GroupConversationPanel({ group, onGroupUpdated, onBack }: GroupConversationPanelProps) {
  const { success, error } = useToast();
  const [messages, setMessages] = useState<ConversationGroupMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    if (!group.showReplies) {
      setIsLoadingMessages(false);
      return;
    }
    setIsLoadingMessages(true);
    try {
      const res = await apiService.getConversationGroupMessages(group.id);
      setMessages(res.messages || []);
    } catch (err: any) {
      error('Erro ao carregar mensagens do grupo', err.message);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id, group.showReplies]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openManage = async () => {
    setIsManageOpen(true);
    try {
      const res = await apiService.getContacts();
      setContacts((res.contacts || []).filter((c) => group.contactIds.includes(c.id)));
    } catch (err: any) {
      error('Erro ao carregar contatos do grupo', err.message);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    setIsSending(true);
    const text = inputText.trim();
    setInputText('');
    try {
      const res = await apiService.sendConversationGroupMessage(group.id, text);
      if (res.mode === 'broadcast') {
        success('Mensagem Enviada', `${res.sent} enviada(s)${res.failed ? `, ${res.failed} falharam` : ''}.`);
      } else {
        success('Mensagem Enviada', 'Enviada ao grupo do WhatsApp.');
      }
      if (group.showReplies) fetchMessages();
    } catch (err: any) {
      error('Falha ao enviar mensagem', err.message);
      setInputText(text);
    } finally {
      setIsSending(false);
    }
  };

  const handleToggleSilenced = async () => {
    try {
      const res = await apiService.updateConversationGroup({ id: group.id, silenced: !group.silenced });
      onGroupUpdated(res.group);
    } catch (err: any) {
      error('Falha ao atualizar', err.message);
    }
  };

  const handleToggleQueuePosition = async () => {
    try {
      const res = await apiService.updateConversationGroup({
        id: group.id,
        queuePosition: group.queuePosition === 'destacado' ? 'misturado' : 'destacado',
      });
      onGroupUpdated(res.group);
    } catch (err: any) {
      error('Falha ao atualizar', err.message);
    }
  };

  const handleToggleShowReplies = async () => {
    try {
      const res = await apiService.updateConversationGroup({ id: group.id, showReplies: !group.showReplies });
      onGroupUpdated(res.group);
    } catch (err: any) {
      error('Falha ao atualizar', err.message);
    }
  };

  const handleRemoveContact = async (contactId: string) => {
    try {
      const res = await apiService.updateConversationGroup({ id: group.id, removeContactId: contactId });
      onGroupUpdated(res.group);
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
      success('Removido do Grupo', 'O atendimento continua normal, só saiu deste grupo.');
    } catch (err: any) {
      error('Falha ao remover', err.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-2xs p-3 sm:p-3.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <button onClick={onBack} className="lg:hidden shrink-0 p-1.5 -ml-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs text-slate-900 truncate">{group.name}</div>
            <div className="text-[10px] text-slate-500">
              {group.mode === 'whatsapp_group' ? 'Grupo WhatsApp' : 'Disparo em Massa'} • {group.contactIds.length} contato{group.contactIds.length !== 1 ? 's' : ''}
              {group.silenced && ' • Silenciado'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={handleToggleSilenced} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors" title={group.silenced ? 'Ativar notificações' : 'Silenciar'}>
            {group.silenced ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          </button>
          <button onClick={openManage} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors" title="Gerenciar grupo">
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Corpo — chat ou registro, conforme showReplies */}
      {group.showReplies ? (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {isLoadingMessages ? (
              <div className="text-center text-slate-400 text-xs py-6">Carregando mensagens...</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-slate-400 text-xs py-6">Nenhuma mensagem enviada a este grupo ainda.</div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-xs ${
                    m.direction === 'outbound' ? 'bg-sky-600 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
                  }`}>
                    {m.direction === 'inbound' && m.contactName && <div className="text-[10px] font-bold opacity-70 mb-0.5">{m.contactName}</div>}
                    {m.text}
                    <div className={`text-[9px] mt-1 ${m.direction === 'outbound' ? 'text-sky-100' : 'text-slate-400'}`}>
                      {new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
            <input
              type="text"
              placeholder={group.mode === 'whatsapp_group' ? 'Mensagem para o grupo...' : 'Mensagem para disparar a todos...'}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-1 focus:ring-sky-500"
            />
            <button onClick={handleSend} disabled={isSending || !inputText.trim()} className="p-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl transition-colors disabled:opacity-40">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <MessageSquare className="w-8 h-8 text-slate-300" />
          <p className="text-xs text-slate-500 max-w-xs">
            Este grupo está configurado como &ldquo;Só Registro&rdquo; — não mostra respostas, só permite disparar mensagens novas.
          </p>
          <div className="flex items-center gap-2 w-full max-w-sm">
            <input
              type="text"
              placeholder="Mensagem para disparar a todos..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs"
            />
            <button onClick={handleSend} disabled={isSending || !inputText.trim()} className="p-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl transition-colors disabled:opacity-40">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal de gerenciamento */}
      {isManageOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4" onClick={() => setIsManageOpen(false)}>
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3 shadow-xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-sm">Gerenciar Grupo</h4>
              <button onClick={() => setIsManageOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <button onClick={handleToggleQueuePosition} className="w-full flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors">
                <span className="font-semibold text-slate-700">Posição na fila</span>
                <span className="text-slate-500">{group.queuePosition === 'destacado' ? 'Destacado' : 'Misturado'} (trocar)</span>
              </button>
              <button onClick={handleToggleShowReplies} className="w-full flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors">
                <span className="font-semibold text-slate-700">Ao abrir o card</span>
                <span className="text-slate-500">{group.showReplies ? 'Mostrar Respostas' : 'Só Registro'} (trocar)</span>
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col pt-1 border-t border-slate-100">
              <label className="block font-semibold text-slate-600 mb-1.5 text-xs">Contatos no grupo</label>
              <div className="flex-1 overflow-y-auto space-y-1">
                {contacts.length === 0 ? (
                  <p className="text-center text-slate-400 text-xs py-4">Nenhum contato encontrado.</p>
                ) : (
                  contacts.map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-xs">
                      <span className="truncate">{c.name}</span>
                      <button onClick={() => handleRemoveContact(c.id)} className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors shrink-0" title="Remover do grupo">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
