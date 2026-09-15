'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Patient, ChatMessage, UrgencyLevel, TriageResult, QuickResponse } from '@/lib/types';
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
  ChevronsRight,
  ChevronsLeft,
  X,
  Eye,
  Download,
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
  // Comando "/" no chat — abre um menu de autocompletar com as
  // respostas rápidas cadastradas em Configurações, filtrando por
  // shortcut ou título conforme o usuário continua digitando após a
  // barra (ex.: "/boas" já filtra para "Boas-vindas").
  const [showQuickResponseMenu, setShowQuickResponseMenu] = useState(false);
  const [quickResponseFilter, setQuickResponseFilter] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [triageByPatientId, setTriageByPatientId] = useState<Record<string, TriageResult>>({});
  const [copiedResponse, setCopiedResponse] = useState(false);

  /**
   * Minimização dos cards da coluna "Clinical Card & AI Insights" —
   * cada um dos 3 blocos (Ficha do Paciente, Checklist de Entrada,
   * Triagem & Protocolo Clínico) pode ser minimizado individualmente,
   * virando uma faixa estreita só com o ícone. Tooltip com o nome do
   * card aparece no hover do mouse, ou ao pressionar/tocar por 2
   * segundos em telas sensíveis ao toque — mesmo padrão já usado no
   * menu lateral recolhível.
   *
   * Comportamento correto: um único botão recolhe a COLUNA INTEIRA,
   * virando uma faixa estreita só com os 3 ícones (Ficha, Checklist,
   * Triagem). Com a coluna recolhida, o usuário tem duas opções: (1)
   * clicar num ícone específico abre UM POP-UP FLUTUANTE só com
   * aquele card, sem precisar expandir a coluna inteira; (2) um botão
   * separado expande a coluna de volta ao normal, com TODOS os cards
   * visíveis ao mesmo tempo lado a lado, como sempre foi.
   */
  type ClinicalCardId = 'ficha' | 'checklist' | 'triagem';
  const [isClinicalColumnCollapsed, setIsClinicalColumnCollapsed] = useState(false);
  // Em telas pequenas (abaixo de lg), o painel clínico fica oculto por
  // padrão — o chat ocupa a tela toda. Um botão no cabeçalho do chat
  // abre o painel como uma "página" própria (mestre-detalhe), em vez
  // de empilhar tudo verticalmente numa rolagem só.
  const [isMobileClinicalPanelOpen, setIsMobileClinicalPanelOpen] = useState(false);
  // Card aberto como pop-up flutuante (só existe enquanto a coluna
  // está recolhida) — null quando nenhum pop-up está aberto.
  const [popupCard, setPopupCard] = useState<ClinicalCardId | null>(null);

  const [tooltipCard, setTooltipCard] = useState<ClinicalCardId | null>(null);
  const cardLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleCardTouchStart = (card: ClinicalCardId) => {
    cardLongPressTimerRef.current = setTimeout(() => setTooltipCard(card), 2000);
  };
  const clearCardLongPress = () => {
    if (cardLongPressTimerRef.current) {
      clearTimeout(cardLongPressTimerRef.current);
      cardLongPressTimerRef.current = null;
    }
    setTooltipCard(null);
  };

  /**
   * Checklist de Entrada — antes eram só 3 itens fixos hard-coded no
   * componente (doc_enviado, convenio_validado, termo_assinado), sem
   * nenhuma forma de adicionar itens novos. O schema já suportava
   * chaves livres (Patient.checklist: { [key: string]: boolean }),
   * só a tela nunca usava isso de verdade.
   *
   * Rótulo exibido de cada item: os 3 originais mantêm o texto de
   * sempre; itens novos guardam o rótulo em CHECKLIST_LABEL_OVERRIDES
   * assim que criados nesta sessão do navegador (a chave em si já
   * carrega uma versão normalizada do texto digitado, então mesmo
   * sem o override o item continua legível ao reabrir a conversa
   * depois).
   */
  const CHECKLIST_KNOWN_LABELS: Record<string, string> = {
    doc_enviado: 'Documento com Foto (RG/CNH)',
    convenio_validado: 'Elegibilidade de Convênio',
    termo_assinado: 'Termo de Consentimento LGPD',
  };
  const [checklistLabelOverrides, setChecklistLabelOverrides] = useState<Record<string, string>>({});
  const getChecklistLabel = (key: string): string =>
    checklistLabelOverrides[key] || CHECKLIST_KNOWN_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const normalizeChecklistKey = (label: string): string =>
    label
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove acentos
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_');

  /**
   * Catálogo de sugestões por palavra-chave — varre as últimas
   * mensagens da conversa (do paciente e do atendente) procurando
   * termos comuns em clínicas de saúde, e sugere o item de checklist
   * correspondente se ele ainda não estiver na lista do paciente.
   * Abordagem por palavra-chave, não por IA generativa — mantém o
   * comportamento previsível e sem custo de chamada de IA extra só
   * para popular sugestões.
   */
  const CHECKLIST_SUGGESTION_RULES: { keywords: string[]; key: string; label: string }[] = [
    { keywords: ['documento', 'rg', 'cnh', 'identidade'], key: 'doc_enviado', label: 'Documento com Foto (RG/CNH)' },
    { keywords: ['convênio', 'convenio', 'plano de saúde', 'plano de saude'], key: 'convenio_validado', label: 'Elegibilidade de Convênio' },
    { keywords: ['termo', 'consentimento', 'lgpd', 'autorização', 'autorizacao'], key: 'termo_assinado', label: 'Termo de Consentimento LGPD' },
    { keywords: ['exame', 'laudo', 'resultado'], key: 'exame_anexado', label: 'Exame ou Laudo Anexado' },
    { keywords: ['receita', 'prescrição', 'prescricao', 'medicamento'], key: 'receita_verificada', label: 'Receita Médica Verificada' },
    { keywords: ['jejum'], key: 'orientacao_jejum', label: 'Orientação de Jejum Confirmada' },
    { keywords: ['pagamento', 'boleto', 'pix', 'cartão', 'cartao'], key: 'pagamento_confirmado', label: 'Pagamento Confirmado' },
    { keywords: ['endereço', 'endereco', 'cep'], key: 'endereco_confirmado', label: 'Endereço Confirmado' },
  ];

  const handleAddChecklistItem = (key: string, label: string) => {
    setChecklistLabelOverrides((prev) => ({ ...prev, [key]: label }));
    handleToggleChecklist(key);
  };

  /**
   * Busca de itens já utilizados pela clínica — deriva da própria
   * lista de pacientes já carregada (cada checklist real já é uma
   * fonte de "itens que esta clínica usa"), sem precisar de uma
   * entidade nova no backend só para isso.
   */
  const [isChecklistSearchOpen, setIsChecklistSearchOpen] = useState(false);

  /**
   * Edição manual da classificação de Triagem Inicial — a IA sugere
   * uma urgência (Protocolo Manchester), mas o atendente/profissional
   * de saúde pode divergir do que a IA identificou e corrigir. Abre
   * um seletor com as 4 cores do protocolo ao clicar no badge de
   * urgência; salva direto em Patient.urgency, o mesmo campo usado
   * em toda a fila e nos indicadores.
   */
  const [isEditingUrgency, setIsEditingUrgency] = useState(false);
  const [isSavingUrgency, setIsSavingUrgency] = useState(false);

  const handleUpdateUrgency = async (newUrgency: UrgencyLevel) => {
    if (!selectedPatient || newUrgency === selectedPatient.urgency) {
      setIsEditingUrgency(false);
      return;
    }
    setIsSavingUrgency(true);
    try {
      const res = await apiService.updatePatient(selectedPatient.id, { urgency: newUrgency });
      setPatients((prev) => prev.map((p) => (p.id === res.patient.id ? res.patient : p)));
      success('Triagem Atualizada', 'A classificação de urgência foi alterada manualmente.');
    } catch (err: any) {
      error('Falha ao atualizar triagem', err?.message || 'Tente novamente.');
    } finally {
      setIsSavingUrgency(false);
      setIsEditingUrgency(false);
    }
  };
  const [checklistSearchQuery, setChecklistSearchQuery] = useState('');
  const [newChecklistItemText, setNewChecklistItemText] = useState('');

  const allKnownChecklistKeys = React.useMemo(() => {
    const keys = new Set<string>(Object.keys(CHECKLIST_KNOWN_LABELS));
    for (const p of patients) {
      Object.keys(p.checklist || {}).forEach((k) => keys.add(k));
    }
    return Array.from(keys);
  }, [patients]);

  /**
   * Busca de mensagens dentro da conversa selecionada — filtra em
   * tempo real conforme o usuário digita, tanto pelo texto da
   * mensagem quanto pelo nome de quem a enviou.
   */
  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false);

  /**
   * Pré-visualização de documentos — PDF renderiza direto no
   * navegador (iframe nativo, nunca sai do MediFlux). .txt/.csv
   * buscam o conteúdo via fetch e mostram como texto puro (idem,
   * fica só entre o navegador e o S3). .doc/.docx/.xls exigem o
   * Microsoft Office Online Viewer — não há visualizador nativo de
   * navegador para esses formatos — que precisa enviar o arquivo aos
   * servidores da Microsoft para renderizar. Como o documento pode
   * ser dado sensível de saúde (exame, receita), isso só acontece
   * depois de o usuário confirmar explicitamente que aceita — nunca
   * automático ao abrir o preview.
   */
  type DocPreviewKind = 'pdf' | 'text' | 'office' | 'image' | 'unsupported';
  const [previewDoc, setPreviewDoc] = useState<{ fileName: string; url: string; kind: DocPreviewKind } | null>(null);
  const [officeViewerConsented, setOfficeViewerConsented] = useState(false);
  const [textPreviewContent, setTextPreviewContent] = useState<string | null>(null);
  const [isLoadingTextPreview, setIsLoadingTextPreview] = useState(false);

  const getDocPreviewKind = (fileName: string): DocPreviewKind => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return 'pdf';
    if (ext === 'txt' || ext === 'csv') return 'text';
    if (['doc', 'docx', 'xls', 'xlsx'].includes(ext)) return 'office';
    return 'unsupported';
  };

  const handleOpenDocPreview = async (fileName: string, url: string) => {
    const kind = getDocPreviewKind(fileName);
    setPreviewDoc({ fileName, url, kind });
    setOfficeViewerConsented(false);
    setTextPreviewContent(null);
    if (kind === 'text') {
      setIsLoadingTextPreview(true);
      try {
        const res = await fetch(url);
        const content = await res.text();
        // Limite de exibição — documentos de texto muito longos ficam
        // pesados para renderizar inline; o usuário sempre pode baixar
        // o arquivo completo pelo botão de download.
        setTextPreviewContent(content.length > 20000 ? content.slice(0, 20000) + '\n\n[... arquivo truncado, baixe para ver o conteúdo completo ...]' : content);
      } catch {
        setTextPreviewContent('Não foi possível carregar o conteúdo deste arquivo para pré-visualização.');
      } finally {
        setIsLoadingTextPreview(false);
      }
    }
  };

  /**
   * Transcrição de áudio sob demanda — o usuário clica no botão
   * "Transcrever" no player, chamando o backend (que busca o áudio no
   * S3 e usa o Gemini). guarda qual mensagem está transcrevendo no
   * momento, para mostrar o spinner só naquele item específico.
   */
  const [transcribingMessageId, setTranscribingMessageId] = useState<string | null>(null);
  const handleTranscribeAudio = async (messageId: string) => {
    if (!selectedPatient) return;
    setTranscribingMessageId(messageId);
    try {
      const res = await apiService.transcribeAudioMessage(selectedPatient.id, messageId);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId && m.media ? { ...m, media: { ...m.media, transcription: res.transcription } } : m))
      );
    } catch (err: any) {
      error('Falha ao transcrever áudio', err?.message || 'Tente novamente.');
    } finally {
      setTranscribingMessageId(null);
    }
  };
  const [messageSearchQuery, setMessageSearchQuery] = useState('');

  const activeTriageResult = selectedPatientId ? triageByPatientId[selectedPatientId] || null : null;

  // Filters
  const [search, setSearch] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState('todas');
  const [filterUrgency, setFilterUrgency] = useState('todas');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Sem rolagem automática por mensagem nova — nem mesmo quando o
  // usuário já estava perto do fim (comportamento anterior). A
  // posição de rolagem de cada conversa é lembrada por paciente e
  // restaurada ao reabri-la, exatamente de onde o usuário parou da
  // última vez que a viu.
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionsRef = useRef<Record<string, number>>({});

  // Quick responses templates
  /**
   * Respostas Rápidas — antes eram 3 textos fixos, hard-coded direto
   * no componente, sem nenhuma relação com o que o usuário cadastra
   * de verdade em Configurações → "3. Respostas Rápidas & Snippets"
   * (ClinicSettings.quickResponses, que já existe e já persiste
   * corretamente — ver auditoria anterior desta migração). Agora
   * busca da API real; se a clínica ainda não cadastrou nenhuma
   * resposta, a barra simplesmente fica vazia (nunca mais mostra os
   * 3 textos fictícios de exemplo).
   */
  const [quickResponses, setQuickResponses] = useState<QuickResponse[]>([]);

  /**
   * Filtro de fila por usuário atribuído — o administrador configura
   * em Configurações se, por padrão, cada usuário vê só as conversas
   * atribuídas a ele mesmo ou a fila inteira (com opção de filtrar).
   * Administradores sempre veem tudo, independente da configuração —
   * a restrição vale só para os demais perfis. Quando a configuração
   * força "só minhas", o toggle fica travado (sem opção de trocar
   * para "todas") — é uma política da clínica, não uma preferência
   * pessoal que o usuário possa contornar.
   */
  const [restrictQueueToAssigned, setRestrictQueueToAssigned] = useState(false);
  const [queueFilterMode, setQueueFilterMode] = useState<'minhas' | 'todas'>('todas');
  const canToggleQueueFilter = user?.role === 'admin' || !restrictQueueToAssigned;

  useEffect(() => {
    let isMounted = true;
    apiService
      .getClinicSettings()
      .then((res) => {
        if (!isMounted) return;
        setQuickResponses(res.settings?.quickResponses || []);
        const restrict = res.settings?.queueVisibility?.restrictToAssignedUser || false;
        setRestrictQueueToAssigned(restrict);
        // Admin sempre começa vendo "todas"; os demais perfis, se a
        // clínica restringe por padrão, já começam vendo só "minhas".
        if (restrict && user?.role !== 'admin') setQueueFilterMode('minhas');
      })
      .catch(() => {
        // Silencioso — a tela funciona normalmente sem a barra populada;
        // o usuário ainda pode digitar a mensagem manualmente.
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const [isRefreshingQueue, setIsRefreshingQueue] = useState(false);

  /**
   * Substitui os placeholders de uma resposta rápida pelos dados reais
   * do paciente selecionado — mesma convenção de nomes já usada em
   * ConfiguracoesView (aceita tanto {{patient_name}} quanto o alias em
   * português {{paciente}}, e assim por diante). Placeholders sem dado
   * real disponível (ex.: {{doctor_name}}, já que Patient não guarda
   * médico responsável) são deixados como estão, em vez de preenchidos
   * com um valor inventado.
   */
  const renderQuickResponseText = (qr: QuickResponse, patient: Patient): string => {
    const raw = qr.text || qr.template || '';
    return raw.replace(/{{patient_name}}|{{paciente}}/gi, patient.name.split(' ')[0]);
  };

  const applyQuickResponse = (qr: QuickResponse) => {
    if (!selectedPatient) return;
    setInputText(renderQuickResponseText(qr, selectedPatient));
    setShowQuickResponseMenu(false);
    setQuickResponseFilter('');
  };

  /**
   * Comando "/" no chat — ao digitar "/" como primeiro caractere (ou
   * logo após um espaço), abre o menu de autocompletar. Continuar
   * digitando depois da barra filtra a lista por shortcut ou título.
   */
  const handleInputChange = (value: string) => {
    setInputText(value);
    const slashMatch = value.match(/(?:^|\s)\/(\S*)$/);
    if (slashMatch) {
      setShowQuickResponseMenu(true);
      setQuickResponseFilter(slashMatch[1].toLowerCase());
    } else {
      setShowQuickResponseMenu(false);
    }
  };

  const filteredQuickResponses = quickResponses.filter((qr) => {
    if (!quickResponseFilter) return true;
    const shortcutNorm = qr.shortcut.replace(/^\//, '').toLowerCase();
    return shortcutNorm.includes(quickResponseFilter) || qr.title.toLowerCase().includes(quickResponseFilter);
  });

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

  // Restaura a posição de rolagem salva desta conversa ao abri-la — só
  // na troca de paciente, nunca em reação a mensagens novas chegando
  // (mensagem nova NUNCA move a rolagem sozinha, mesmo se o usuário
  // estava no fim da conversa).
  const previousPatientIdRef = useRef<string>('');
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    if (previousPatientIdRef.current === selectedPatientId) return; // mesma conversa, mensagem nova chegou — não mexe na rolagem

    previousPatientIdRef.current = selectedPatientId;
    const savedPosition = scrollPositionsRef.current[selectedPatientId];
    // requestAnimationFrame — garante que o DOM já renderizou as
    // mensagens desta conversa antes de tentar posicionar a rolagem.
    requestAnimationFrame(() => {
      if (savedPosition !== undefined) {
        container.scrollTop = savedPosition;
      } else {
        // Primeira vez que esta conversa é aberta nesta sessão do
        // navegador — não há posição salva ainda, então começa no
        // fim (mensagem mais recente), que é o ponto de entrada mais
        // útil para uma conversa nunca vista antes.
        container.scrollTop = container.scrollHeight;
      }
    });
  }, [selectedPatientId, messages]);

  // Salva a posição de rolagem atual continuamente, por paciente —
  // assim, ao trocar de conversa e voltar depois, o usuário encontra
  // exatamente onde parou.
  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;
    if (!container || !selectedPatientId) return;
    scrollPositionsRef.current[selectedPatientId] = container.scrollTop;
  };

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  /**
   * Lista efetivamente exibida na fila — aplica o filtro "Minhas
   * conversas" sobre o que já foi carregado do backend (não é uma
   * nova chamada de API; assignedUserId já vem em cada paciente).
   */
  const visiblePatients = queueFilterMode === 'minhas' ? patients.filter((p) => p.assignedUserId === user?.id) : patients;

  const suggestedChecklistItems = React.useMemo(() => {
    if (!selectedPatient) return [];
    const conversationText = messages
      .filter((m) => !m.isInternalNote)
      .slice(-20) // últimas 20 mensagens — suficiente para captar o assunto atual sem reprocessar a conversa inteira
      .map((m) => m.text.toLowerCase())
      .join(' ');

    return CHECKLIST_SUGGESTION_RULES.filter(
      (rule) => selectedPatient.checklist[rule.key] === undefined && rule.keywords.some((kw) => conversationText.includes(kw))
    );
  }, [messages, selectedPatient]);

  const filteredChecklistSearchResults = checklistSearchQuery.trim()
    ? allKnownChecklistKeys.filter(
        (key) =>
          getChecklistLabel(key).toLowerCase().includes(checklistSearchQuery.toLowerCase()) &&
          (!selectedPatient || selectedPatient.checklist[key] === undefined)
      )
    : [];

  // Fecha a busca de mensagens ao trocar de conversa — o filtro de
  // uma conversa não deveria vazar para a próxima que o usuário abrir.
  useEffect(() => {
    setIsMessageSearchOpen(false);
    setMessageSearchQuery('');
    setIsEditingUrgency(false);
    setIsMobileClinicalPanelOpen(false);
  }, [selectedPatientId]);

  const filteredMessages = messageSearchQuery.trim()
    ? messages.filter(
        (m) =>
          m.text.toLowerCase().includes(messageSearchQuery.toLowerCase()) ||
          (m.senderName || '').toLowerCase().includes(messageSearchQuery.toLowerCase())
      )
    : messages;

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
      // Sem rolagem automática — a posição de rolagem do usuário é
      // preservada mesmo ao enviar uma mensagem própria; ele já está
      // olhando a conversa, e mexer na rolagem sem pedir seria a
      // mesma interrupção indesejada que motivou remover isso.

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
  const handleToggleChecklist = async (key: string) => {
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

  /**
   * Finalizar Conversa — exige um motivo (não é opcional: é a base do
   * relatório de motivos de encerramento). Ao confirmar, a conversa
   * sai da fila de Atendimentos e passa a aparecer só em Conversas
   * Arquivadas. Se o paciente escrever de novo depois, a conversa
   * reabre automaticamente e volta para a fila — isso acontece no
   * backend, não precisa de nada aqui no front-end.
   */
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [isArchiving, setIsArchiving] = useState(false);

  const handleArchiveConversation = async () => {
    if (!selectedPatient || !archiveReason.trim()) return;
    setIsArchiving(true);
    try {
      await apiService.archivePatientConversation(selectedPatient.id, archiveReason.trim());
      success('Conversa Finalizada', `O atendimento de ${selectedPatient.name} foi arquivado.`);
      setPatients((prev) => prev.filter((p) => p.id !== selectedPatient.id));
      setSelectedPatientId('');
      setIsArchiveModalOpen(false);
      setArchiveReason('');
    } catch (err: any) {
      error('Falha ao finalizar conversa', err?.message || 'Tente novamente.');
    } finally {
      setIsArchiving(false);
    }
  };

  const urgencyStyles: Record<UrgencyLevel, { badge: string; border: string; dot: string; title: string }> = {
    critica: { badge: 'bg-red-600 text-white', border: 'border-l-4 border-l-red-600', dot: 'bg-red-500', title: 'Emergência (Vermelho)' },
    alta: { badge: 'bg-orange-500 text-white', border: 'border-l-4 border-l-orange-500', dot: 'bg-orange-500', title: 'Muito Urgente (Laranja)' },
    media: { badge: 'bg-amber-400 text-slate-950 font-bold', border: 'border-l-4 border-l-amber-400', dot: 'bg-amber-400', title: 'Urgente (Amarelo)' },
    baixa: { badge: 'bg-emerald-500 text-white', border: 'border-l-4 border-l-emerald-500', dot: 'bg-emerald-500', title: 'Pouco Urgente (Verde)' },
  };

  /**
   * Emoji de sentimento — classificado automaticamente pela IA na
   * primeira mensagem de uma conversa nova (ver routes/webhook.ts no
   * backend). Não é recalculado em mensagens seguintes; reflete o
   * tom com que o paciente iniciou o contato.
   */
  const sentimentEmoji: Record<string, string> = {
    positivo: '🙂',
    neutro: '😐',
    negativo: '😟',
    urgente: '😰',
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-61px)] overflow-hidden bg-slate-100">
      {/* COLUMN 1: Queue / Patient List (340px) — em telas pequenas (abaixo de lg), some quando um
          paciente está selecionado, para dar lugar ao chat (layout mestre-detalhe, 1 coluna por vez) */}
      <div className={`${selectedPatientId ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 shrink-0 bg-white border-r border-slate-200 flex-col h-full`}>
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

          {/* Filtro de fila por usuário atribuído — travado em "Minhas"
              quando o administrador configurou restrição por padrão e
              o usuário atual não é admin (política da clínica, não uma
              preferência que dá para contornar). */}
          {canToggleQueueFilter ? (
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <button
                onClick={() => setQueueFilterMode('minhas')}
                className={`py-1 rounded-md font-semibold transition-colors ${
                  queueFilterMode === 'minhas' ? 'bg-sky-600 text-white' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Minhas Conversas
              </button>
              <button
                onClick={() => setQueueFilterMode('todas')}
                className={`py-1 rounded-md font-semibold transition-colors ${
                  queueFilterMode === 'todas' ? 'bg-sky-600 text-white' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Todas
              </button>
            </div>
          ) : (
            <div className="text-[10px] text-slate-400 flex items-center gap-1 px-1">
              <User className="w-3 h-3" /> Exibindo apenas suas conversas atribuídas
            </div>
          )}
        </div>

        {/* Patients List Scrollable */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {isLoadingPatients ? (
            <div className="p-8 text-center text-xs text-slate-400">Carregando fila...</div>
          ) : patients.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">Nenhum atendimento localizado.</div>
          ) : (
            visiblePatients.map((p) => {
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
                      <div className="font-bold text-xs text-slate-900 truncate flex items-center gap-1">
                        {p.name}
                        {p.sentiment && (
                          <span title={`Sentimento identificado na primeira mensagem: ${p.sentiment}`}>{sentimentEmoji[p.sentiment]}</span>
                        )}
                      </div>
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

      {/* COLUMN 2: Chat Stream & Omnichannel Messenger — em telas pequenas, só aparece com paciente
          selecionado (a Coluna 1 já se escondeu acima); sem seleção, fica oculta, evitando o chat
          vazio aparecer empilhado sob a fila inteira. */}
      <div className={`${selectedPatientId ? 'flex' : 'hidden lg:flex'} flex-1 flex-col h-full bg-slate-50 border-r border-slate-200`}>
        {selectedPatient ? (
          <>
            {/* Chat Top Bar */}
            <div className="p-3.5 bg-white border-b border-slate-200 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-3 min-w-0">
                {/* Voltar à fila — só em telas pequenas, onde a Coluna 1 ficou oculta */}
                <button
                  onClick={() => setSelectedPatientId('')}
                  className="lg:hidden shrink-0 p-1.5 -ml-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Voltar à fila de Atendimentos"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {selectedPatient.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-xs text-slate-900 truncate">{selectedPatient.name}</h3>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 capitalize shrink-0">
                      {selectedPatient.originChannel}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${urgencyStyles[selectedPatient.urgency]?.badge || 'bg-slate-200 text-slate-700'}`}>
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
              <div className="flex items-center gap-2 shrink-0">
                {/* Abrir painel clínico — só em telas pequenas, onde ele fica oculto por padrão */}
                <button
                  onClick={() => setIsMobileClinicalPanelOpen(true)}
                  className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                  title="Abrir ficha clínica"
                >
                  <User className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsMessageSearchOpen((prev) => !prev)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isMessageSearchOpen ? 'bg-sky-100 text-sky-700' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                  title="Buscar mensagens nesta conversa"
                >
                  <Search className="w-4 h-4" />
                </button>
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

            {/* Busca de mensagens na conversa — filtra em tempo real por texto ou remetente */}
            {isMessageSearchOpen && (
              <div className="px-4 py-2 bg-sky-50/60 border-b border-sky-200 flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Buscar nesta conversa..."
                  value={messageSearchQuery}
                  onChange={(e) => setMessageSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-xs text-slate-800 focus:outline-hidden placeholder:text-slate-400"
                />
                {messageSearchQuery && (
                  <span className="text-[10px] text-slate-500 shrink-0">
                    {filteredMessages.length} resultado{filteredMessages.length !== 1 ? 's' : ''}
                  </span>
                )}
                <button
                  onClick={() => {
                    setIsMessageSearchOpen(false);
                    setMessageSearchQuery('');
                  }}
                  className="p-1 text-slate-400 hover:text-slate-700 shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

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
            <div ref={messagesContainerRef} onScroll={handleMessagesScroll} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  Nenhuma mensagem registrada nesta conversa. Envie uma mensagem ou nota interna abaixo.
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  Nenhuma mensagem encontrada para &ldquo;{messageSearchQuery}&rdquo;.
                </div>
              ) : (
                filteredMessages.map((m) => {
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
                        {/* Mídia recebida — áudio, imagem ou documento. mediaError indica
                            que o WhatsApp confirmou o envio mas o conteúdo não pôde ser
                            recuperado (falha documentada e conhecida da Evolution API neste
                            endpoint específico) — a mensagem existe, só sem preview/download. */}
                        {m.mediaError && (
                          <div className={`mb-2 p-2 rounded-lg text-[11px] flex items-start gap-1.5 ${isMe ? 'bg-slate-800 text-amber-300' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>{m.mediaError}</span>
                          </div>
                        )}

                        {m.media?.type === 'audio' && (
                          <div className="mb-2 space-y-1.5">
                            {m.media.url ? (
                              <audio controls src={m.media.url} className="w-64 max-w-full h-9" />
                            ) : (
                              <div className="text-[11px] italic opacity-70">Áudio indisponível.</div>
                            )}
                            {m.media.transcription ? (
                              <div className={`p-2 rounded-lg text-[11px] italic ${isMe ? 'bg-slate-800 text-slate-200' : 'bg-slate-50 text-slate-700 border border-slate-200'}`}>
                                &ldquo;{m.media.transcription}&rdquo;
                              </div>
                            ) : (
                              m.media.url && (
                                <button
                                  onClick={() => handleTranscribeAudio(m.id)}
                                  disabled={transcribingMessageId === m.id}
                                  className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors disabled:opacity-50 ${
                                    isMe ? 'bg-slate-800 hover:bg-slate-700 text-sky-300' : 'bg-slate-100 hover:bg-slate-200 text-sky-700'
                                  }`}
                                >
                                  <FileText className={`w-3 h-3 ${transcribingMessageId === m.id ? 'animate-pulse' : ''}`} />
                                  {transcribingMessageId === m.id ? 'Transcrevendo...' : 'Transcrever áudio'}
                                </button>
                              )
                            )}
                          </div>
                        )}

                        {m.media?.type === 'image' && m.media.url && (
                          <div className="mb-2 space-y-1.5">
                            <img
                              src={m.media.url}
                              alt="Imagem recebida"
                              onClick={() => setPreviewDoc({ fileName: m.media!.fileName, url: m.media!.url!, kind: 'image' })}
                              className="max-w-full max-h-64 rounded-lg border border-slate-200 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                            />
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setPreviewDoc({ fileName: m.media!.fileName, url: m.media!.url!, kind: 'image' })}
                                className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors ${
                                  isMe ? 'bg-slate-800 hover:bg-slate-700 text-sky-300' : 'bg-slate-100 hover:bg-slate-200 text-sky-700'
                                }`}
                              >
                                <Eye className="w-3 h-3" /> Ampliar
                              </button>
                              <a
                                href={m.media.url}
                                download={m.media.fileName}
                                className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors ${
                                  isMe ? 'bg-slate-800 hover:bg-slate-700 text-sky-300' : 'bg-slate-100 hover:bg-slate-200 text-sky-700'
                                }`}
                              >
                                <Download className="w-3 h-3" /> Baixar
                              </a>
                            </div>
                          </div>
                        )}

                        {m.media?.type === 'document' && m.media.url && (
                          <div className="mb-2 space-y-1.5">
                            <div
                              className={`flex items-center gap-2 p-2.5 rounded-lg ${
                                isMe ? 'bg-slate-800' : 'bg-slate-50 border border-slate-200'
                              }`}
                            >
                              <FileText className={`w-6 h-6 shrink-0 ${isMe ? 'text-sky-300' : 'text-sky-600'}`} />
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] font-semibold truncate">{m.media.fileName}</div>
                                <div className={`text-[10px] ${isMe ? 'text-slate-400' : 'text-slate-500'}`}>{(m.media.sizeBytes / 1024).toFixed(0)} KB</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleOpenDocPreview(m.media!.fileName, m.media!.url!)}
                                className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors ${
                                  isMe ? 'bg-slate-800 hover:bg-slate-700 text-sky-300' : 'bg-slate-100 hover:bg-slate-200 text-sky-700'
                                }`}
                              >
                                <Eye className="w-3 h-3" /> Visualizar
                              </button>
                              <a
                                href={m.media.url}
                                download={m.media.fileName}
                                className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors ${
                                  isMe ? 'bg-slate-800 hover:bg-slate-700 text-sky-300' : 'bg-slate-100 hover:bg-slate-200 text-sky-700'
                                }`}
                              >
                                <Download className="w-3 h-3" /> Baixar
                              </a>
                            </div>
                          </div>
                        )}

                        {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}
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

            {/* Quick Templates Drawer — respostas reais cadastradas em Configurações → "3. Respostas Rápidas & Snippets" */}
            {quickResponses.length > 0 && (
              <div className="px-4 py-2 bg-white border-t border-slate-200 flex items-center gap-2 overflow-x-auto">
                <span className="text-[11px] font-semibold text-slate-400 shrink-0">Respostas Rápidas:</span>
                {quickResponses.map((qr) => (
                  <button
                    key={qr.id}
                    onClick={() => applyQuickResponse(qr)}
                    title={qr.shortcut}
                    className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium shrink-0 transition-colors"
                  >
                    {qr.title}
                  </button>
                ))}
              </div>
            )}

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

              <div className="flex items-center gap-2 relative">
                {/* Menu de autocompletar do comando "/" — mesma fonte de dados da barra acima */}
                {showQuickResponseMenu && filteredQuickResponses.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-2 w-80 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg z-20">
                    {filteredQuickResponses.map((qr) => (
                      <button
                        key={qr.id}
                        type="button"
                        onClick={() => applyQuickResponse(qr)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-800">{qr.title}</span>
                          <span className="text-[10px] font-mono text-sky-600">{qr.shortcut}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{qr.text || qr.template}</p>
                      </button>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  placeholder={
                    isInternalNote
                      ? 'Escreva uma anotação privada que ficará gravada no histórico...'
                      : `Digite uma resposta para ${selectedPatient.name}... (use / para respostas rápidas)`
                  }
                  value={inputText}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setShowQuickResponseMenu(false);
                  }}
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

      {/* COLUMN 3: Clinical Card & AI Insights (340px, ou 64px recolhida) — em telas
          pequenas, fica oculta por padrão (o chat ocupa a tela toda); abre como uma
          "página" própria ao clicar no botão do cabeçalho do chat, com botão de voltar. */}
      <div
        className={`${isMobileClinicalPanelOpen ? 'flex' : 'hidden lg:flex'} ${
          isClinicalColumnCollapsed ? 'w-full lg:w-16' : 'w-full lg:w-80'
        } fixed lg:static inset-0 lg:inset-auto z-40 lg:z-auto shrink-0 bg-white border-l border-slate-200 flex-col h-full transition-[width] duration-200 ${
          isClinicalColumnCollapsed ? 'overflow-visible' : 'overflow-y-auto'
        }`}
      >
        {/* Botão de voltar ao chat — só em telas pequenas, onde o painel vira tela cheia */}
        <button
          onClick={() => setIsMobileClinicalPanelOpen(false)}
          className="lg:hidden flex items-center gap-1.5 p-3 border-b border-slate-200 text-xs font-semibold text-slate-600"
        >
          <ChevronsLeft className="w-4 h-4" /> Voltar à conversa
        </button>
        {selectedPatient ? (
          <>
            {isClinicalColumnCollapsed ? (
              /* Coluna recolhida — barra vertical só com os 3 ícones.
                 Clicar num ícone abre um POP-UP flutuante só com aquele
                 card (sem expandir a coluna). O botão de baixo expande
                 a coluna inteira, com todos os cards lado a lado. */
              <div className="p-2 space-y-1.5 flex flex-col items-center">
                {(
                  [
                    { id: 'ficha' as ClinicalCardId, icon: User, label: 'Ficha do Paciente', color: 'text-slate-500' },
                    { id: 'checklist' as ClinicalCardId, icon: ShieldCheck, label: 'Checklist de Entrada', color: 'text-emerald-600' },
                    { id: 'triagem' as ClinicalCardId, icon: Sparkles, label: 'Triagem & Protocolo Clínico', color: 'text-purple-600' },
                  ]
                ).map((card) => (
                  <div key={card.id} className="relative w-full">
                    <button
                      onClick={() => setPopupCard(card.id)}
                      onMouseEnter={() => setTooltipCard(card.id)}
                      onMouseLeave={() => setTooltipCard(null)}
                      onTouchStart={() => handleCardTouchStart(card.id)}
                      onTouchEnd={clearCardLongPress}
                      onTouchCancel={clearCardLongPress}
                      className="w-full flex items-center justify-center p-2.5 rounded-xl hover:bg-slate-100 transition-colors"
                      title={card.label}
                    >
                      <card.icon className={`w-4 h-4 ${card.color}`} />
                    </button>
                    {tooltipCard === card.id && (
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-[60] px-2.5 py-1.5 bg-slate-800 text-white text-[11px] font-semibold rounded-lg shadow-lg whitespace-nowrap pointer-events-none">
                        {card.label}
                      </div>
                    )}
                  </div>
                ))}

                <div className="w-full border-t border-slate-200 my-1" />

                <button
                  onClick={() => setIsClinicalColumnCollapsed(false)}
                  className="w-full flex items-center justify-center p-2.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  title="Expandir painel inteiro"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
              </div>
            ) : (
            <div className="p-4 space-y-4">
            {/* Botão de recolher a coluna inteira */}
            <button
              onClick={() => setIsClinicalColumnCollapsed(true)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
              title="Recolher painel"
            >
              <ChevronsRight className="w-3.5 h-3.5" /> Recolher painel
            </button>

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
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsChecklistSearchOpen((prev) => !prev)}
                    className={`p-1 rounded-md transition-colors ${isChecklistSearchOpen ? 'bg-sky-100 text-sky-700' : 'text-slate-500 hover:bg-white'}`}
                    title="Buscar item já usado pela clínica"
                  >
                    <Search className="w-3.5 h-3.5" />
                  </button>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                </div>
              </h5>

              {/* Itens já marcados/existentes no checklist deste paciente */}
              <div className="space-y-1.5 text-xs text-slate-700">
                {Object.keys(selectedPatient.checklist).length === 0 && (
                  <p className="text-slate-400 italic">Nenhum item adicionado ainda.</p>
                )}
                {Object.keys(selectedPatient.checklist).map((key) => (
                  <div key={key} onClick={() => handleToggleChecklist(key)} className="flex items-center gap-2 cursor-pointer hover:text-slate-900">
                    {selectedPatient.checklist[key] ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                    <span>{getChecklistLabel(key)}</span>
                  </div>
                ))}
              </div>

              {/* Sugestões automáticas com base no conteúdo da conversa */}
              {suggestedChecklistItems.length > 0 && (
                <div className="pt-2 border-t border-slate-200 space-y-1.5">
                  <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wide flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Sugerido pela conversa
                  </span>
                  {suggestedChecklistItems.map((suggestion) => (
                    <button
                      key={suggestion.key}
                      onClick={() => handleAddChecklistItem(suggestion.key, suggestion.label)}
                      className="w-full flex items-center gap-2 text-left px-2 py-1.5 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg text-[11px] text-sky-800 font-medium transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 shrink-0" /> {suggestion.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Busca de itens já utilizados pela clínica em outros atendimentos */}
              {isChecklistSearchOpen && (
                <div className="pt-2 border-t border-slate-200 space-y-1.5">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Buscar item já usado..."
                    value={checklistSearchQuery}
                    onChange={(e) => setChecklistSearchQuery(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-[11px] border border-slate-300 rounded-lg bg-white"
                  />
                  {checklistSearchQuery.trim() && (
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {filteredChecklistSearchResults.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic px-1">Nenhum item encontrado.</p>
                      ) : (
                        filteredChecklistSearchResults.map((key) => (
                          <button
                            key={key}
                            onClick={() => {
                              handleAddChecklistItem(key, getChecklistLabel(key));
                              setChecklistSearchQuery('');
                              setIsChecklistSearchOpen(false);
                            }}
                            className="w-full flex items-center gap-2 text-left px-2 py-1.5 hover:bg-white rounded-lg text-[11px] text-slate-700 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5 shrink-0 text-slate-400" /> {getChecklistLabel(key)}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Adicionar item personalizado */}
              <div className="pt-2 border-t border-slate-200 flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="Novo item do checklist..."
                  value={newChecklistItemText}
                  onChange={(e) => setNewChecklistItemText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newChecklistItemText.trim()) {
                      handleAddChecklistItem(normalizeChecklistKey(newChecklistItemText), newChecklistItemText.trim());
                      setNewChecklistItemText('');
                    }
                  }}
                  className="flex-1 px-2.5 py-1.5 text-[11px] border border-slate-300 rounded-lg"
                />
                <button
                  onClick={() => {
                    if (!newChecklistItemText.trim()) return;
                    handleAddChecklistItem(normalizeChecklistKey(newChecklistItemText), newChecklistItemText.trim());
                    setNewChecklistItemText('');
                  }}
                  disabled={!newChecklistItemText.trim()}
                  className="p-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg disabled:opacity-40 transition-colors shrink-0"
                  title="Adicionar item"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* AI Insights & Clinical Triage Protocol */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between relative">
                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Triagem & Protocolo Clínico
                </span>
                <button
                  onClick={() => setIsEditingUrgency((prev) => !prev)}
                  disabled={isSavingUrgency}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded shadow-2xs transition-opacity hover:opacity-80 disabled:opacity-50 ${urgencyStyles[selectedPatient.urgency]?.badge}`}
                  title="Clique para editar a classificação de triagem"
                >
                  {isSavingUrgency ? 'Salvando...' : selectedPatient.urgency.toUpperCase()}
                </button>
                {isEditingUrgency && (
                  <div className="absolute top-full right-0 mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden w-56">
                    {(['critica', 'alta', 'media', 'baixa'] as UrgencyLevel[]).map((level) => (
                      <button
                        key={level}
                        onClick={() => handleUpdateUrgency(level)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] hover:bg-slate-50 transition-colors ${
                          level === selectedPatient.urgency ? 'bg-slate-50 font-semibold' : ''
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${urgencyStyles[level].dot}`} />
                        {urgencyStyles[level].title}
                      </button>
                    ))}
                  </div>
                )}
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

            {/* Finalizar Conversa — arquiva o atendimento com motivo obrigatório */}
            <div className="pt-2">
              <button
                onClick={() => setIsArchiveModalOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Finalizar Conversa
              </button>
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
            </div>
            )}
          </>
        ) : null}
      </div>

      {/* Modal de Finalizar Conversa — exige motivo, nunca opcional */}
      {isArchiveModalOpen && selectedPatient && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => !isArchiving && setIsArchiveModalOpen(false)}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-bold text-slate-900 text-sm">Finalizar conversa com {selectedPatient.name}?</h4>
            <p className="text-slate-500 text-xs">
              A conversa sairá da fila de Atendimentos e passará para Conversas Arquivadas. Se o paciente escrever de novo, ela reabre automaticamente.
            </p>
            <div>
              <label className="block font-semibold text-slate-600 text-xs mb-1">Motivo do encerramento (obrigatório)</label>
              <textarea
                autoFocus
                rows={3}
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                placeholder="Ex.: Consulta concluída, paciente atendido com sucesso."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setIsArchiveModalOpen(false)}
                disabled={isArchiving}
                className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold text-xs disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleArchiveConversation}
                disabled={isArchiving || !archiveReason.trim()}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs disabled:opacity-40 transition-colors"
              >
                {isArchiving ? 'Finalizando...' : 'Finalizar Conversa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de pré-visualização de documento/imagem */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4" onClick={() => setPreviewDoc(null)}>
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <span className="font-bold text-slate-900 text-sm truncate flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-600 shrink-0" /> {previewDoc.fileName}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={previewDoc.url}
                  download={previewDoc.fileName}
                  className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Baixar
                </a>
                <button onClick={() => setPreviewDoc(null)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-slate-50 min-h-[300px]">
              {previewDoc.kind === 'image' && (
                <img src={previewDoc.url} alt={previewDoc.fileName} className="max-w-full max-h-[75vh] mx-auto object-contain" />
              )}

              {previewDoc.kind === 'pdf' && <iframe src={previewDoc.url} className="w-full h-[75vh] border-0" title={previewDoc.fileName} />}

              {previewDoc.kind === 'text' && (
                <div className="p-4">
                  {isLoadingTextPreview ? (
                    <div className="text-center py-10 text-slate-400 text-xs">Carregando conteúdo...</div>
                  ) : (
                    <pre className="whitespace-pre-wrap font-mono text-[11px] text-slate-800 bg-white p-4 rounded-lg border border-slate-200">
                      {textPreviewContent}
                    </pre>
                  )}
                </div>
              )}

              {previewDoc.kind === 'office' && !officeViewerConsented && (
                <div className="p-6 flex flex-col items-center text-center gap-3 max-w-md mx-auto py-16">
                  <FileText className="w-10 h-10 text-slate-300" />
                  <p className="text-xs text-slate-600">
                    Este formato (.doc, .docx, .xls) não tem visualizador nativo no navegador. A pré-visualização usa o Microsoft Office Online Viewer,
                    que precisa enviar uma cópia temporária deste arquivo aos servidores da Microsoft para renderizá-lo.
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Como este documento pode conter dado sensível de saúde, confirme que deseja continuar — ou baixe o arquivo para abrir localmente.
                  </p>
                  <button
                    onClick={() => setOfficeViewerConsented(true)}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    Entendi, visualizar mesmo assim
                  </button>
                </div>
              )}

              {previewDoc.kind === 'office' && officeViewerConsented && (
                <iframe
                  src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewDoc.url)}`}
                  className="w-full h-[75vh] border-0"
                  title={previewDoc.fileName}
                />
              )}

              {previewDoc.kind === 'unsupported' && (
                <div className="p-10 text-center text-slate-400 text-xs">
                  Não há pré-visualização disponível para este tipo de arquivo. Use o botão &ldquo;Baixar&rdquo; para abri-lo localmente.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pop-up flutuante — card individual, aberto a partir da barra de ícones da coluna recolhida */}
      {popupCard && selectedPatient && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setPopupCard(null)}>
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full max-h-[85vh] overflow-y-auto p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                {popupCard === 'ficha' && (
                  <>
                    <User className="w-4 h-4 text-slate-500" /> Ficha do Paciente
                  </>
                )}
                {popupCard === 'checklist' && (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" /> Checklist de Entrada
                  </>
                )}
                {popupCard === 'triagem' && (
                  <>
                    <Sparkles className="w-4 h-4 text-purple-600" /> Triagem & Protocolo Clínico
                  </>
                )}
              </span>
              <button onClick={() => setPopupCard(null)} className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {popupCard === 'ficha' && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Dados Cadastrais</span>
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
            )}

            {popupCard === 'checklist' && (
              <div className="space-y-1.5 text-xs text-slate-700">
                {Object.keys(selectedPatient.checklist).length === 0 && (
                  <p className="text-slate-400 italic">Nenhum item adicionado ainda.</p>
                )}
                {Object.keys(selectedPatient.checklist).map((key) => (
                  <div key={key} onClick={() => handleToggleChecklist(key)} className="flex items-center gap-2 cursor-pointer hover:text-slate-900">
                    {selectedPatient.checklist[key] ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                    <span>{getChecklistLabel(key)}</span>
                  </div>
                ))}
              </div>
            )}

            {popupCard === 'triagem' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded shadow-2xs ${urgencyStyles[selectedPatient.urgency]?.badge}`}>
                    {selectedPatient.urgency.toUpperCase()}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5">
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
                {activeTriageResult?.redFlags && activeTriageResult.redFlags.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wide flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-rose-600" /> Sinais de Alarme
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
                {(activeTriageResult?.suggestedAttendantResponse || activeTriageResult?.recommendedAction) && (
                  <div className="p-2.5 bg-purple-50/80 rounded-lg border border-purple-200 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-purple-950">
                      <span>Sugestão de Resposta:</span>
                      <button
                        onClick={() => {
                          const reply = activeTriageResult?.suggestedAttendantResponse || activeTriageResult?.recommendedAction || '';
                          setInputText(reply);
                          setPopupCard(null);
                        }}
                        className="flex items-center gap-1 text-[10px] text-purple-700 hover:text-purple-900 bg-purple-100 hover:bg-purple-200 px-2 py-0.5 rounded font-semibold transition-colors"
                      >
                        <Copy className="w-3 h-3" /> Inserir no Chat
                      </button>
                    </div>
                    <p className="text-[11px] text-purple-900 leading-relaxed italic bg-white/70 p-2 rounded border border-purple-100">
                      &ldquo;{activeTriageResult?.suggestedAttendantResponse || activeTriageResult?.recommendedAction}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
