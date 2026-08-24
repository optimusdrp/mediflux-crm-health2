'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Patient, ChatMessage, UrgencyLevel, TriageResult } from '@/lib/types';
import { FALLBACK_PATIENTS } from '@/lib/data/fallbackSeed';
import { apiService } from '@/lib/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  Search,
  Filter,
  Send,
  Sparkles,
  Lock,
  Edit3,
  Trash2,
  CheckSquare,
  Square,
  HeartPulse,
  AlertTriangle,
  FileText,
  User,
  Phone,
  CreditCard,
  Calendar,
  Smile,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Plus,
  StickyNote,
  MessageSquare,
  Bot,
  Clock,
  Activity,
  Copy,
  Check,
} from 'lucide-react';

interface AtendimentosViewProps {
  initialPatientId?: string;
  onOpenEditModal: (patient: Patient) => void;
  onOpenNewPatientModal: () => void;
}

export function AtendimentosView({
  initialPatientId,
  onOpenEditModal,
  onOpenNewPatientModal,
}: AtendimentosViewProps) {
  const { user, hasActionPermission } = useAuth();
  const { success, error, warning, info } = useToast();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(initialPatientId || '');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [triageByPatientId, setTriageByPatientId] = useState<Record<string, TriageResult>>({});
  const [copiedResponse, setCopiedResponse] = useState(false);

  const activeTriageResult = selectedPatientId ? triageByPatientId[selectedPatientId] || null : null;

  // Filters
  const [search, setSearch] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState('todas');
  const [filterUrgency, setFilterUrgency] = useState('todas');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Quick responses templates
  const quickResponses = [
    { label: 'Boas-vindas', text: 'Olá, {{paciente}}! Seja bem-vindo(a) à nossa clínica. Como posso lhe ajudar hoje?' },
    { label: 'Preparo Exame', text: 'Prezado(a) {{paciente}}, para seu exame cardiológico é necessário jejum de 8 horas e levar documento com foto.' },
    { label: 'Confirmação', text: 'Confirmamos sua consulta para {{data}} às {{horario}} com Dr(a). {{medico}}.' },
  ];

  const [isRefreshingQueue, setIsRefreshingQueue] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshingQueue(true);
    try {
      const res = await apiService.getPatients({
        search: search || undefined,
        specialty: filterSpecialty !== 'all' && filterSpecialty !== 'todas' ? filterSpecialty : undefined,
        urgency: filterUrgency !== 'all' && filterUrgency !== 'todas' ? filterUrgency : undefined,
      });
      setPatients(res.patients);
      if (selectedPatientId) {
        const msgRes = await apiService.getChatMessages(selectedPatientId);
        setMessages(msgRes.messages);
      }
      info('Fila Atualizada', 'Mensagens e atendimentos sincronizados com sucesso.');
    } catch (err: any) {
      error('Erro ao atualizar fila', err.message);
    } finally {
      setIsRefreshingQueue(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchPatients = async () => {
      try {
        const res = await apiService.getPatients({
          search,
          specialty: filterSpecialty !== 'todas' ? filterSpecialty : undefined,
          urgency: filterUrgency !== 'todas' ? filterUrgency : undefined,
        });
        if (isMounted) {
          const list = res.patients && res.patients.length > 0 ? res.patients : FALLBACK_PATIENTS;
          setPatients(list);
          if (!selectedPatientId && list.length > 0) {
            setSelectedPatientId(list[0].id);
          }
        }
      } catch {
        if (isMounted && patients.length === 0) {
          setPatients(FALLBACK_PATIENTS);
          if (!selectedPatientId && FALLBACK_PATIENTS.length > 0) {
            setSelectedPatientId(FALLBACK_PATIENTS[0].id);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoadingPatients(false);
        }
      }
    };

    fetchPatients();
    return () => {
      isMounted = false;
    };
  }, [search, filterSpecialty, filterUrgency, selectedPatientId, patients.length]);

  const [prevInitialId, setPrevInitialId] = useState<string | undefined>(initialPatientId);
  if (initialPatientId && initialPatientId !== prevInitialId) {
    setPrevInitialId(initialPatientId);
    setSelectedPatientId(initialPatientId);
  }

  // Load chat messages when selected patient changes & poll periodically for live WhatsApp synchronization
  useEffect(() => {
    if (!selectedPatientId) return;
    let isMounted = true;

    const loadMessages = async () => {
      try {
        const res = await apiService.getChatMessages(selectedPatientId);
        if (isMounted) {
          setMessages(res.messages);
        }
      } catch (err: any) {
        console.error('Erro ao carregar mensagens:', err);
      }
    };

    loadMessages();

    // Auto-polling a cada 3 segundos para receber mensagens em tempo real
    const interval = setInterval(loadMessages, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedPatientId]);

  // Periodic polling for patient list to detect new WhatsApp incoming conversations
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await apiService.getPatients({
          search: search || undefined,
          // Correção de inconsistência: o valor "sem filtro" usado em
          // todo o resto do componente (inclusive no useState inicial e
          // no primeiro useEffect acima) é 'todas', não 'all' — o
          // backend (app/api/patients/route.ts) já tratava 'todas'
          // corretamente e ignorava 'all' por não reconhecer, então na
          // prática o filtro nunca chegava a ficar preso incorretamente,
          // mas o código enviava um valor sem efeito real em vez de
          // omitir o parâmetro como pretendido.
          specialty: filterSpecialty !== 'todas' ? filterSpecialty : undefined,
          urgency: filterUrgency !== 'todas' ? filterUrgency : undefined,
        });
        setPatients(res.patients);
      } catch (err) {
        // silent background poll
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [search, filterSpecialty, filterUrgency]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  // Send message or internal note
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !selectedPatientId) return;

    setIsSending(true);
    try {
      const res = await apiService.sendChatMessage({
        patientId: selectedPatientId,
        text: inputText.trim(),
        isInternalNote,
        sender: 'attendant',
        channel: selectedPatient?.originChannel || 'whatsapp',
      });

      setMessages((prev) => [...prev, res.message]);
      setInputText('');

      if (isInternalNote) {
        success('Nota Interna Salva', 'Visível apenas para a equipe da clínica.');
      } else if (res.whatsappDeliveryError) {
        // A mensagem foi salva no MediFlux (já está na lista acima),
        // mas não chegou de fato ao paciente — avisa o atendente de
        // forma clara, em vez de deixar a UI parecer que o envio real
        // funcionou quando não funcionou.
        warning('Mensagem salva, mas não enviada ao paciente', res.whatsappDeliveryError);
      }
    } catch (err: any) {
      error('Falha no Envio', err.message || 'Erro ao gravar mensagem.');
    } finally {
      setIsSending(false);
    }
  };

  // Trigger AI Clinical Triage for current patient chat context
  const handleRunAITriage = async () => {
    if (!selectedPatient) return;
    
    // Extrai todo o contexto recente de mensagens para que a IA analise a conversa completa
    const messagesHistory = messages
      .slice(-8)
      .map((m) =>
        m.isInternalNote
          ? `[Nota Interna]: ${m.text}`
          : `${m.sender === 'patient' ? 'Paciente' : 'Atendente'}: ${m.text}`
      );

    const latestPatientMsg = [...messages]
      .reverse()
      .find((m) => m.sender === 'patient')?.text || selectedPatient.notes || 'Paciente solicita atendimento';

    setIsAnalyzingAI(true);
    try {
      const res = await apiService.analyzeMessageTriage(latestPatientMsg, selectedPatient.id, messagesHistory);
      setTriageByPatientId((prev) => ({ ...prev, [selectedPatient.id]: res.triage }));

      if (res.triage.requiresHumanReview) {
        warning(
          'Revisão Humana Obrigatória',
          res.triage.guardrailReason || 'Guardrail clínico ativado: revise o protocolo antes de finalizar.'
        );
      } else {
        success(
          'Triagem IA Concluída',
          `Classificação: ${res.triage.manchesterCategory} (${res.triage.urgency.toUpperCase()})`
        );
      }

      // Update patient in local state
      if (res.patient) {
        setPatients((prev) => prev.map((p) => (p.id === res.patient!.id ? res.patient! : p)));
      }
    } catch (err: any) {
      if (err.name === 'FeatureNotAvailableError') {
        warning('Recurso Não Incluso', err.message);
      } else {
        error('Falha na Triagem IA', err.message || 'Erro ao processar IA.');
      }
    } finally {
      setIsAnalyzingAI(false);
    }
  };

  // Toggle checklist item
  const handleToggleChecklist = async (key: 'doc_enviado' | 'convenio_validado' | 'termo_assinado') => {
    if (!selectedPatient) return;
    const updatedChecklist = {
      ...selectedPatient.checklist,
      [key]: !selectedPatient.checklist[key],
    };

    try {
      const res = await apiService.updatePatient(selectedPatient.id, {
        checklist: updatedChecklist,
      });
      setPatients((prev) => prev.map((p) => (p.id === res.patient.id ? res.patient : p)));
      info('Checklist Atualizado', 'Item alterado com sucesso.');
    } catch (err: any) {
      error('Erro ao atualizar checklist', err.message);
    }
  };

  // Toggle Human Review
  const handleToggleReview = async () => {
    if (!selectedPatient) return;
    try {
      const res = await apiService.updatePatient(selectedPatient.id, {
        requiresHumanReview: !selectedPatient.requiresHumanReview,
      });
      setPatients((prev) => prev.map((p) => (p.id === res.patient.id ? res.patient : p)));
      success('Revisão Atualizada', selectedPatient.requiresHumanReview ? 'Protocolo validado e liberado pelo operador.' : 'Marcado para revisão humana.');
    } catch (err: any) {
      error('Erro', err.message);
    }
  };

  // Delete Patient (RBAC sensitive action)
  const handleDeletePatient = async () => {
    if (!selectedPatient) return;
    if (!confirm(`Tem certeza que deseja excluir permanentemente o cadastro de ${selectedPatient.name}?`)) {
      return;
    }

    try {
      await apiService.deletePatient(selectedPatient.id);
      success('Paciente Removido', 'Registro excluído em conformidade com a LGPD.');
      setPatients((prev) => prev.filter((p) => p.id !== selectedPatient.id));
      setSelectedPatientId('');
    } catch (err: any) {
      error('Permissão Insuficiente', err.message || 'Apenas administradores podem excluir pacientes.');
    }
  };

  const urgencyStyles: Record<UrgencyLevel, { badge: string; border: string; dot: string; title: string }> = {
    critica: { badge: 'bg-red-600 text-white', border: 'border-l-4 border-l-red-600', dot: 'bg-red-500', title: 'Emergência (Vermelho)' },
    alta: { badge: 'bg-orange-500 text-white', border: 'border-l-4 border-l-orange-500', dot: 'bg-orange-500', title: 'Muito Urgente (Laranja)' },
    media: { badge: 'bg-amber-400 text-slate-950 font-bold', border: 'border-l-4 border-l-amber-400', dot: 'bg-amber-400', title: 'Urgente (Amarelo)' },
    baixa: { badge: 'bg-emerald-500 text-white', border: 'border-l-4 border-l-emerald-500', dot: 'bg-emerald-500', title: 'Pouco Urgente (Verde)' },
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-61px)] overflow-hidden bg-slate-100">
      {/* COLUMN 1: Queue / Patient List (340px) */}
      <div className="w-full lg:w-80 shrink-0 bg-white border-r border-slate-200 flex flex-col h-full">
        {/* Search & Header */}
        <div className="p-3 border-b border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">
              Fila de Atendimentos ({patients.length})
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={isRefreshingQueue}
                title="Sincronizar mensagens e fila de atendimento em tempo real"
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isRefreshingQueue ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onOpenNewPatientModal}
                className="p-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Novo
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por nome, CPF ou fone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* Filters row */}
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <select
              value={filterUrgency}
              onChange={(e) => setFilterUrgency(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium"
            >
              <option value="todas">Urgência: Todas</option>
              <option value="critica">Crítica (Vermelho)</option>
              <option value="alta">Alta (Laranja)</option>
              <option value="media">Média (Amarelo)</option>
              <option value="baixa">Baixa (Verde)</option>
            </select>

            <select
              value={filterSpecialty}
              onChange={(e) => setFilterSpecialty(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium"
            >
              <option value="todas">Espec: Todas</option>
              <option value="Cardiologia">Cardiologia</option>
              <option value="Dermatologia">Dermatologia</option>
              <option value="Ortopedia">Ortopedia</option>
            </select>
          </div>
        </div>

        {/* Patients List Scrollable */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {isLoadingPatients ? (
            <div className="p-8 text-center text-xs text-slate-400">Carregando fila...</div>
          ) : patients.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">Nenhum atendimento localizado.</div>
          ) : (
            patients.map((p) => {
              const isSelected = p.id === selectedPatientId;
              const uStyle = urgencyStyles[p.urgency] || urgencyStyles.media;

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPatientId(p.id)}
                  className={`p-3 cursor-pointer transition-all ${uStyle.border} ${
                    isSelected ? 'bg-sky-50/80 border-r-2 border-r-sky-600' : 'hover:bg-slate-50 bg-white'
                  }`}
                  id={`patient-card-${p.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="truncate">
                      <div className="font-bold text-xs text-slate-900 truncate">{p.name}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span className="font-medium text-slate-700">{p.specialty}</span>
                        <span>•</span>
                        <span>{p.healthInsurance}</span>
                      </div>
                    </div>

                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase shrink-0 ${uStyle.badge}`}>
                      {p.urgency}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
                    <span className="capitalize text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {p.originChannel}
                    </span>
                    {p.requiresHumanReview && (
                      <span className="text-amber-700 bg-amber-50 border border-amber-200 px-1 rounded font-bold">
                        Revisão IA
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* COLUMN 2: Chat Stream & Omnichannel Messenger */}
      <div className="flex-1 flex flex-col h-full bg-slate-50 border-r border-slate-200">
        {selectedPatient ? (
          <>
            {/* Chat Top Bar */}
            <div className="p-3.5 bg-white border-b border-slate-200 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
                  {selectedPatient.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-xs text-slate-900">{selectedPatient.name}</h3>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 capitalize">
                      {selectedPatient.originChannel}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${urgencyStyles[selectedPatient.urgency]?.badge || 'bg-slate-200 text-slate-700'}`}>
                      {selectedPatient.urgency}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2">
                    <span>{selectedPatient.phone}</span>
                    <span>•</span>
                    <span>CPF: {selectedPatient.cpf || 'Não informado'}</span>
                  </div>
                </div>
              </div>

              {/* AI Trigger Action */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRunAITriage}
                  disabled={isAnalyzingAI}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs disabled:opacity-50"
                  id="btn-run-ai-triage"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isAnalyzingAI ? 'animate-spin' : ''}`} />
                  {isAnalyzingAI ? 'Classificando Histórico...' : 'Triagem Manchester IA'}
                </button>
              </div>
            </div>

            {/* Guardrail Warning Banner (Chat Top) */}
            {selectedPatient.requiresHumanReview && (
              <div className="bg-amber-500/10 border-b border-amber-300 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-950">
                <div className="flex items-center gap-2 font-medium">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Guardrail Clínico Obrigatório:</strong>{' '}
                    {activeTriageResult?.guardrailReason ||
                      'Caso de Urgência Alta/Crítica ou Fallback Local exige revisão e liberação humana antes da conduta.'}
                  </span>
                </div>
                <button
                  onClick={handleToggleReview}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[11px] font-bold shrink-0 shadow-2xs transition-colors"
                >
                  ✓ Validar e Liberar
                </button>
              </div>
            )}

            {/* Chat Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  Nenhuma mensagem registrada nesta conversa. Envie uma mensagem ou nota interna abaixo.
                </div>
              ) : (
                messages.map((m) => {
                  if (m.isInternalNote) {
                    return (
                      <div
                        key={m.id}
                        className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl max-w-lg mx-auto shadow-2xs"
                      >
                        <div className="flex items-center gap-1.5 text-amber-800 text-[10px] font-bold uppercase mb-1">
                          <StickyNote className="w-3.5 h-3.5 text-amber-600" />
                          <span>Nota Interna • Visível apenas para a clínica</span>
                        </div>
                        <p className="text-xs text-amber-950 leading-relaxed whitespace-pre-wrap">{m.text}</p>
                        <div className="text-right text-[10px] text-amber-700/80 mt-1">
                          {m.senderName || 'Atendente'} • {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    );
                  }

                  const isMe = m.sender === 'attendant' || m.sender === 'bot';

                  return (
                    <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`max-w-md p-3.5 rounded-2xl text-xs leading-relaxed shadow-2xs ${
                          isMe
                            ? 'bg-slate-900 text-white rounded-br-xs'
                            : 'bg-white text-slate-900 border border-slate-200 rounded-bl-xs'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.text}</p>
                        <div
                          className={`text-[10px] mt-1.5 flex items-center justify-end gap-1 ${
                            isMe ? 'text-slate-400' : 'text-slate-400'
                          }`}
                        >
                          <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {isMe && <CheckCircle2 className="w-3 h-3 text-sky-400" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Templates Drawer */}
            <div className="px-4 py-2 bg-white border-t border-slate-200 flex items-center gap-2 overflow-x-auto">
              <span className="text-[11px] font-semibold text-slate-400 shrink-0">Respostas Rápidas:</span>
              {quickResponses.map((qr, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    const text = qr.text.replace('{{paciente}}', selectedPatient.name.split(' ')[0]);
                    setInputText(text);
                  }}
                  className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium shrink-0 transition-colors"
                >
                  {qr.label}
                </button>
              ))}
            </div>

            {/* Input Composer */}
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsInternalNote(false)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                      !isInternalNote ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Mensagem ao Paciente
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsInternalNote(true)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                      isInternalNote
                        ? 'bg-amber-400 text-slate-950 shadow-2xs'
                        : 'text-amber-800 bg-amber-50 hover:bg-amber-100'
                    }`}
                  >
                    <StickyNote className="w-3.5 h-3.5" /> Nota Privada Interna
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={
                    isInternalNote
                      ? 'Escreva uma anotação privada que ficará gravada no histórico...'
                      : `Digite uma resposta para ${selectedPatient.name}...`
                  }
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className={`flex-1 px-3.5 py-2 text-xs border rounded-xl focus:outline-hidden focus:ring-2 ${
                    isInternalNote
                      ? 'bg-amber-50/50 border-amber-300 focus:ring-amber-400 text-amber-950'
                      : 'bg-slate-50 border-slate-300 focus:ring-sky-500 text-slate-900'
                  }`}
                />

                <button
                  type="submit"
                  disabled={isSending || !inputText.trim()}
                  className={`p-2.5 rounded-xl text-white font-bold transition-all disabled:opacity-50 ${
                    isInternalNote ? 'bg-amber-600 hover:bg-amber-700' : 'bg-sky-600 hover:bg-sky-700'
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
            Selecione um paciente na fila à esquerda para iniciar o atendimento.
          </div>
        )}
      </div>

      {/* COLUMN 3: Clinical Card & AI Insights (340px) */}
      <div className="w-full lg:w-80 shrink-0 bg-white border-l border-slate-200 flex flex-col h-full overflow-y-auto p-4 space-y-4">
        {selectedPatient ? (
          <>
            {/* Patient Header Card */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Ficha do Paciente</span>
                <button
                  onClick={() => onOpenEditModal(selectedPatient)}
                  className="p-1 text-slate-600 hover:text-sky-600 hover:bg-white rounded-md transition-colors"
                  title="Editar cadastro"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>

              <h4 className="font-bold text-sm text-slate-900">{selectedPatient.name}</h4>
              <div className="text-xs text-slate-600 mt-1 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-slate-400" />
                  <span>{selectedPatient.phone}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CreditCard className="w-3 h-3 text-slate-400" />
                  <span>
                    {selectedPatient.healthInsurance}{' '}
                    {selectedPatient.planNumber ? `• Nº ${selectedPatient.planNumber}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>Nascimento: {selectedPatient.birthDate || 'Não informado'}</span>
                </div>
              </div>
            </div>

            {/* Checklist de Atendimento */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
              <h5 className="font-bold text-xs text-slate-800 flex items-center justify-between">
                <span>Checklist de Entrada</span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              </h5>

              <div className="space-y-1.5 text-xs text-slate-700">
                <div
                  onClick={() => handleToggleChecklist('doc_enviado')}
                  className="flex items-center gap-2 cursor-pointer hover:text-slate-900"
                >
                  {selectedPatient.checklist.doc_enviado ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>Documento com Foto (RG/CNH)</span>
                </div>

                <div
                  onClick={() => handleToggleChecklist('convenio_validado')}
                  className="flex items-center gap-2 cursor-pointer hover:text-slate-900"
                >
                  {selectedPatient.checklist.convenio_validado ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>Elegibilidade de Convênio</span>
                </div>

                <div
                  onClick={() => handleToggleChecklist('termo_assinado')}
                  className="flex items-center gap-2 cursor-pointer hover:text-slate-900"
                >
                  {selectedPatient.checklist.termo_assinado ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>Termo de Consentimento LGPD</span>
                </div>
              </div>
            </div>

            {/* AI Insights & Clinical Triage Protocol */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Triagem & Protocolo Clínico
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded shadow-2xs ${urgencyStyles[selectedPatient.urgency]?.badge}`}>
                  {selectedPatient.urgency.toUpperCase()}
                </span>
              </div>

              {/* Protocol & SLA */}
              <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-slate-800 font-semibold">
                  <span className="flex items-center gap-1 text-[11px]">
                    <Activity className="w-3.5 h-3.5 text-sky-600" />
                    {activeTriageResult?.suggestedProtocol || 'Protocolo Clínico Manchester'}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                    <Clock className="w-3 h-3 text-slate-400" />
                    SLA: {activeTriageResult?.slaMinutes !== undefined ? `${activeTriageResult.slaMinutes} min` : (selectedPatient.urgency === 'critica' ? '0 min' : selectedPatient.urgency === 'alta' ? '10 min' : selectedPatient.urgency === 'media' ? '60 min' : '120 min')}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 leading-relaxed">
                  {selectedPatient.aiSummary || activeTriageResult?.recommendedAction || 'Triagem automática do histórico de mensagens.'}
                </div>
              </div>

              {/* Guardrails Clínicos Obrigatórios */}
              {selectedPatient.requiresHumanReview ? (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-300 space-y-2">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h6 className="font-bold text-[11px] text-amber-950">Guardrail Clínico Ativo</h6>
                      <p className="text-[10px] text-amber-800 leading-relaxed mt-0.5">
                        {activeTriageResult?.guardrailReason ||
                          'Casos de Urgência Alta/Crítica ou respostas provindas de Fallback Heurístico Local exigem validação prévia por profissional humano.'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleToggleReview}
                    className="w-full py-1.5 px-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[11px] font-bold transition-colors shadow-2xs flex items-center justify-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> Validar e Liberar Conduta Humana
                  </button>
                </div>
              ) : (
                <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-medium">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Revisão Humana Validada</span>
                  </div>
                  <button
                    onClick={handleToggleReview}
                    className="text-[10px] text-slate-500 hover:text-slate-800 underline"
                  >
                    Marcar revisão
                  </button>
                </div>
              )}

              {/* Red Flags & Sinais de Alarme */}
              {activeTriageResult?.redFlags && activeTriageResult.redFlags.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wide flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-rose-600" /> Sinais de Alarme (Red Flags)
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {activeTriageResult.redFlags.map((rf, idx) => (
                      <span key={idx} className="text-[10px] bg-rose-100 text-rose-900 font-semibold px-2 py-0.5 rounded">
                        ⚠️ {rf}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sinais Clínicos Identificados */}
              {activeTriageResult?.clinicalSignals && activeTriageResult.clinicalSignals.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Sinais Clínicos Detectados
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {activeTriageResult.clinicalSignals.map((sig, idx) => (
                      <span key={idx} className="text-[10px] bg-slate-200/80 text-slate-800 font-medium px-2 py-0.5 rounded">
                        {sig}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sugestão de Resposta ao Paciente */}
              {(activeTriageResult?.suggestedAttendantResponse || activeTriageResult?.recommendedAction) && (
                <div className="p-2.5 bg-purple-50/80 rounded-lg border border-purple-200 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-purple-950">
                    <span>Sugestão de Resposta:</span>
                    <button
                      onClick={() => {
                        const reply = activeTriageResult?.suggestedAttendantResponse || activeTriageResult?.recommendedAction || '';
                        setInputText(reply);
                        setCopiedResponse(true);
                        setTimeout(() => setCopiedResponse(false), 2000);
                      }}
                      className="flex items-center gap-1 text-[10px] text-purple-700 hover:text-purple-900 bg-purple-100 hover:bg-purple-200 px-2 py-0.5 rounded font-semibold transition-colors"
                    >
                      {copiedResponse ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      {copiedResponse ? 'Inserido!' : 'Inserir no Chat'}
                    </button>
                  </div>
                  <p className="text-[11px] text-purple-900 leading-relaxed italic bg-white/70 p-2 rounded border border-purple-100">
                    &ldquo;{activeTriageResult?.suggestedAttendantResponse || activeTriageResult?.recommendedAction}&rdquo;
                  </p>
                </div>
              )}

              {/* Tags do Paciente */}
              <div className="flex flex-wrap gap-1 pt-1">
                {selectedPatient.tags.map((t, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200"
                  >
                    {t}
                  </span>
                ))}
              </div>

              {/* Metadados Técnicos de Auditoria */}
              {activeTriageResult && (
                <div className="text-[9px] text-slate-400 font-mono pt-1 border-t border-slate-200 flex items-center justify-between">
                  <span>{activeTriageResult.providerUsed}</span>
                  <span>{activeTriageResult.executionTimeMs}ms • {(activeTriageResult.confidence * 100).toFixed(0)}% conf.</span>
                </div>
              )}
            </div>

            {/* Delete Patient (Sensitive Action) */}
            <div className="pt-2">
              <button
                onClick={handleDeletePatient}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir Atendimento (LGPD)
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
