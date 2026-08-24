'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ClinicSettings,
  RolePermission,
  User,
  EHRIntegration,
  Webhook,
  WebhookLog,
  QuickResponse,
  Funnel,
  FunnelStage,
  Role,
  TabId,
  SensitiveAction,
} from '@/lib/types';
import { apiService } from '@/lib/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { WhatsAppQRCodeViewer } from '@/components/WhatsAppQRCodeViewer';
import { WhatsAppRealConnectionPanel } from '@/components/WhatsAppRealConnectionPanel';
import {
  Settings,
  Building2,
  MessageSquare,
  Sparkles,
  Bell,
  Database,
  Share2,
  ShieldCheck,
  KanbanSquare,
  CreditCard,
  Save,
  CheckCircle2,
  RefreshCw,
  Lock,
  Plus,
  Trash2,
  Send,
  AlertTriangle,
  Search,
  Check,
  Smartphone,
  Globe,
  Sliders,
  Activity,
  Layers,
  Palette,
  Clock,
  Phone,
  Key,
  Volume2,
  Zap,
  Info,
  CheckSquare,
  Square,
  Copy,
  QrCode,
  Terminal,
  Power,
  BatteryCharging,
  Cpu,
  RefreshCw as RefreshIcon,
  Wifi,
  WifiOff,
} from 'lucide-react';

interface SubCategory {
  id: number;
  label: string;
  badge?: string;
  icon: React.ElementType;
  description: string;
  categoryGroup: 'ORGANIZAÇÃO & CLÍNICA' | 'COMUNICAÇÃO & ATENDIMENTO' | 'INTELIGÊNCIA ARTIFICIAL & REGRAS' | 'INTEGRAÇÕES & SISTEMA';
}

const SUB_TABS: SubCategory[] = [
  {
    id: 0,
    label: '1. Identidade & Unidades',
    icon: Building2,
    description: 'Razão social, CNPJ, dados de faturamento, responsável técnico e fusos operacionais.',
    categoryGroup: 'ORGANIZAÇÃO & CLÍNICA',
  },
  {
    id: 8,
    label: '2. Gestão de Funis & Etapas',
    icon: KanbanSquare,
    description: 'Estruturação de etapas da jornada do paciente, regras de bloqueio e campos obrigatórios.',
    categoryGroup: 'ORGANIZAÇÃO & CLÍNICA',
  },
  {
    id: 1,
    label: '3. Respostas Rápidas & Snippets',
    icon: MessageSquare,
    badge: 'Produtividade',
    description: 'Atalhos de texto dinâmicos com substituição automática de variáveis do paciente e consulta.',
    categoryGroup: 'COMUNICAÇÃO & ATENDIMENTO',
  },
  {
    id: 6,
    label: '4. Canais & Omnichannel API',
    icon: Smartphone,
    description: 'Configuração do WhatsApp Business Cloud API Oficial, Telegram, Instagram Direct e Web Widget.',
    categoryGroup: 'COMUNICAÇÃO & ATENDIMENTO',
  },
  {
    id: 3,
    label: '5. Alertas WhatsApp & SLA',
    icon: Bell,
    badge: 'Enfermagem',
    description: 'Telefones de plantão para emergências clínicas, sirenes sonoras e regras de escalação por Manchester.',
    categoryGroup: 'COMUNICAÇÃO & ATENDIMENTO',
  },
  {
    id: 2,
    label: '6. Políticas de Rascunho & IA',
    icon: Sparkles,
    badge: 'Segurança',
    description: 'Intervalos de salvamento automático, cache offline criptografado e revisão humana mandatória.',
    categoryGroup: 'INTELIGÊNCIA ARTIFICIAL & REGRAS',
  },
  {
    id: 7,
    label: '7. Matriz RBAC de Permissões',
    icon: ShieldCheck,
    description: 'Controle granular de acesso a abas e ações críticas por perfil (Admin, Médico, Recepção, etc.).',
    categoryGroup: 'INTELIGÊNCIA ARTIFICIAL & REGRAS',
  },
  {
    id: 5,
    label: '8. Integrações PEP / EHR',
    icon: Database,
    badge: 'TISS/HL7',
    description: 'Sincronização bidirecional de prontuários com iClinic, TOTVS Saúde, HiDoctor e Feegow.',
    categoryGroup: 'INTEGRAÇÕES & SISTEMA',
  },
  {
    id: 4,
    label: '9. Webhooks & Eventos',
    icon: Share2,
    badge: 'SSRF Guard',
    description: 'Disparos seguros com assinatura HMAC SHA-256 para sistemas externos e hospitais parceiros.',
    categoryGroup: 'INTEGRAÇÕES & SISTEMA',
  },
  {
    id: 9,
    label: '10. Assinatura & Faturamento',
    icon: CreditCard,
    description: 'Plano Enterprise ativo, métricas de consumo de IA, limites mensais de consultas e faturas.',
    categoryGroup: 'INTEGRAÇÕES & SISTEMA',
  },
];

const ALL_ROLES: { key: Role; label: string; desc: string; color: string }[] = [
  { key: 'admin', label: 'Administrador Geral', desc: 'Acesso irrestrito a governança e faturamento', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { key: 'medico', label: 'Corpo Clínico (Médicos)', desc: 'Atendimento, prontuário e triagem médica', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  { key: 'recepcao', label: 'Recepção & Triagem', desc: 'Agendamento, recepção e encaminhamento inicial', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: 'financeiro', label: 'Faturamento / Financeiro', desc: 'Gestão de cobrança, faturas e relatórios', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'terceirizado', label: 'Plantão Terceirizado', desc: 'Acesso restrito a filas de pendências', color: 'bg-slate-100 text-slate-700 border-slate-300' },
];

const ALL_TABS: { id: TabId; label: string }[] = [
  { id: 'visao_geral', label: 'Visão Geral' },
  { id: 'atendimentos', label: 'Atendimentos' },
  { id: 'jornadas', label: 'Jornadas (Kanban)' },
  { id: 'pendencias', label: 'Pendências & SLA' },
  { id: 'automacoes', label: 'Automações' },
  { id: 'indicadores', label: 'Indicadores' },
  { id: 'configuracoes', label: 'Configurações' },
  { id: 'auditoria_lgpd', label: 'Auditoria LGPD' },
  { id: 'analise_inteligente', label: 'Análise Inteligente (IA)' },
];

const ALL_ACTIONS: { id: SensitiveAction; label: string; danger?: boolean }[] = [
  { id: 'visualizar_prontuario_sensivel', label: 'Visualizar Prontuário Sensível' },
  { id: 'exportar_dados_lgpd', label: 'Exportar Relatório LGPD / Dados', danger: true },
  { id: 'unificar_duplicados', label: 'Unificar Prontuários Duplicados', danger: true },
  { id: 'excluir_paciente', label: 'Anonimizar / Excluir Paciente', danger: true },
  { id: 'alterar_permissoes', label: 'Alterar Matriz RBAC de Permissões', danger: true },
  { id: 'configurar_integracoes_pep', label: 'Configurar Credenciais PEP / EHR' },
  { id: 'gerenciar_cobranca', label: 'Gerenciar Assinatura & Faturamento' },
  { id: 'disparar_webhooks_teste', label: 'Disparar Testes de Webhook' },
];

export function ConfiguracoesView() {
  const { user, subscription } = useAuth();
  const { success, error, warning } = useToast();

  const [activeSubTab, setActiveSubTab] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [ehrList, setEhrList] = useState<EHRIntegration[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingEHR, setIsSyncingEHR] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Quick Response Simulator State
  const [selectedSnippetId, setSelectedSnippetId] = useState<string>('qr_01');
  const [simulatorPatientName, setSimulatorPatientName] = useState<string>('Nome do Paciente');
  const [simulatorDoctorName, setSimulatorDoctorName] = useState<string>('Nome do Médico');
  const [simulatorDate, setSimulatorDate] = useState<string>('20/08/2026');
  const [simulatorTime, setSimulatorTime] = useState<string>('10:15');

  // New Quick Response Modal
  const [isNewSnippetModalOpen, setIsNewSnippetModalOpen] = useState(false);
  const [newSnippetData, setNewSnippetData] = useState({
    shortcut: '',
    title: '',
    category: 'Geral',
    text: '',
  });

  // New Webhook Modal
  const [isNewWebhookModalOpen, setIsNewWebhookModalOpen] = useState(false);
  const [newWebhookData, setNewWebhookData] = useState({
    name: '',
    url: '',
    secret: 'whsec_98a72b14c0e3',
    events: ['triage.critical'] as string[],
  });

  // EHR Edit Modal
  const [editingEhr, setEditingEhr] = useState<EHRIntegration | null>(null);
  const [ehrApiKeyInput, setEhrApiKeyInput] = useState('');

  // WhatsApp Web.js Session State
  const [wppSession, setWppSession] = useState<{
    clinicId: string;
    status: 'disconnected' | 'connecting' | 'qr_ready' | 'authenticated' | 'ready' | 'error';
    qrCode?: string;
    qrExpiresAt?: number;
    sessionName: string;
    batteryLevel?: number;
    pushname?: string;
    wid?: string;
    platform?: string;
    lastSeen?: string;
    headless: boolean;
    authStrategy: 'LocalAuth' | 'RemoteAuth' | 'Legacy';
    autoRestart: boolean;
    webhookUrl?: string;
    messagesSentToday: number;
    messagesReceivedToday: number;
    puppeteerConfig: {
      chromiumPath: string;
      noSandbox: boolean;
      disableGpu: boolean;
    };
  } | null>(null);
  const [wppLoadingAction, setWppLoadingAction] = useState<string | null>(null);
  const [wppTestPhone, setWppTestPhone] = useState('5551991507327');
  const [wppTestMessage, setWppTestMessage] = useState('Olá! Gostaria de agendar uma consulta cardiológica.');
  const [wppActiveSubView, setWppActiveSubView] = useState<'qr_status' | 'advanced_config' | 'test_terminal'>('qr_status');

  // Load WhatsApp Web.js Session
  const fetchWppSession = async () => {
    try {
      const res = await apiService.getWhatsAppWebSession();
      setWppSession(res.session);
    } catch (err) {
      console.error('Erro ao buscar sessão whatsapp-web.js:', err);
    }
  };

  const handleWppAction = async (action: 'start_client' | 'connect_no_qr' | 'direct_connect' | 'refresh_qr' | 'simulate_scan' | 'disconnect' | 'update_config' | 'test_send' | 'simulate_inbound', payload?: any) => {
    setWppLoadingAction(action);
    try {
      const res = await apiService.executeWhatsAppWebAction(action, payload);
      setWppSession(res.session);
      success('WhatsApp Web.js', res.message);
    } catch (err: any) {
      error('Falha no WhatsApp Web.js', err.message || 'Não foi possível executar a ação.');
    } finally {
      setWppLoadingAction(null);
    }
  };

  // Firestore Seeding & Multi-Tenant State
  const [isSeedingFirestore, setIsSeedingFirestore] = useState(false);
  const [firestoreStatus, setFirestoreStatus] = useState<{
    connected: boolean;
    projectId: string;
    databaseId: string;
    totalUsers: number;
    users: any[];
  } | null>(null);

  const fetchFirestoreStatus = async () => {
    try {
      const res = await apiService.getFirestoreStatus();
      if (res?.status) {
        setFirestoreStatus({
          connected: res.status.connected,
          projectId: res.status.projectId,
          databaseId: res.status.databaseId,
          totalUsers: res.totalRegisteredUsers,
          users: res.users,
        });
      }
    } catch (err) {
      console.error('Erro ao consultar status do Firestore:', err);
    }
  };

  const handleSeedFirestore = async () => {
    setIsSeedingFirestore(true);
    try {
      const res = await fetch('/api/admin/seed-firestore', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        success('Firestore Populado', `4 Usuários de teste e a clínica CardioVida foram registrados no Firestore com sucesso! (${data.totalUsers} registros verificados)`);
        await fetchFirestoreStatus();
      } else {
        error('Falha ao Popular', data.error || 'Não foi possível gravar no Firestore');
      }
    } catch (err: any) {
      error('Erro de Conexão', err.message || 'Falha ao conectar com o Firestore');
    } finally {
      setIsSeedingFirestore(false);
    }
  };

  // Identidade extra fields
  const [identityData, setIdentityData] = useState({
    razaoSocial: 'Clínica CardioVida & Saúde Integrada Ltda.',
    nomeFantasia: 'CardioVida Especialidades',
    cnpj: '18.234.567/0001-89',
    cnes: '7492810',
    rtNome: 'Dr. Roberto Vasconcelos',
    rtCrm: 'CRM/SP 142.890',
    telefonePrincipal: '(11) 3456-7890',
    whatsappAtendimento: '(11) 98877-6655',
    emailContato: 'contato@cardiovida.com.br',
    endereco: 'Alameda Santos, 1470 - 8º andar - Cerqueira César, São Paulo - SP, 01418-100',
    fusoHorario: 'America/Sao_Paulo (UTC-3:00)',
    horarioFuncionamento: 'Segunda a Sexta: 07h às 20h | Sábados: 08h às 14h',
  });

  // Load Initial Configuration Data
  useEffect(() => {
    let isMounted = true;
    const fetchAll = async () => {
      try {
        const [sRes, ehrRes, whRes, wppRes] = await Promise.all([
          apiService.getClinicSettings(),
          apiService.getEHRIntegrations(),
          apiService.getWebhooks(),
          apiService.getWhatsAppWebSession(),
        ]);
        if (isMounted) {
          setSettings(sRes.settings);
          setPermissions(sRes.permissions);
          setUsers(sRes.users);
          setEhrList(ehrRes.integrations);
          setWebhooks(whRes.webhooks);
          setWebhookLogs(whRes.logs || []);
          if (wppRes?.session) setWppSession(wppRes.session);
          fetchFirestoreStatus();
        }
      } catch (err: unknown) {
        const msg = (err as { message?: string })?.message || 'Erro de rede';
        error('Erro ao carregar configurações', msg);
      }
    };
    fetchAll();
    return () => {
      isMounted = false;
    };
  }, [error]);

  const markDirty = () => {
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
      await apiService.saveClinicSettings({
        ...settings,
        rolePermissions: permissions,
      });
      setHasUnsavedChanges(false);
      success('Configurações Salvas com Sucesso', 'Todas as 10 áreas de governança foram atualizadas e registradas em auditoria LGPD.');
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'Erro ao persistir';
      error('Falha ao salvar', msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncEHR = async (ehrId: string) => {
    setIsSyncingEHR(ehrId);
    try {
      const res = await apiService.syncEHR(ehrId);
      success('Sincronização Concluída', `${res.message} (${res.syncedEntitiesCount.patients} pacientes, ${res.syncedEntitiesCount.appointments} consultas).`);
      const ehrRes = await apiService.getEHRIntegrations();
      setEhrList(ehrRes.integrations);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'Falha ao sincronizar';
      if (msg.includes('bloqueada')) {
        warning('Chave Não Configurada', msg);
      } else {
        error('Falha na Sincronização', msg);
      }
    } finally {
      setIsSyncingEHR(null);
    }
  };

  const handleTestWebhook = async (webhookId: string) => {
    try {
      const res = await apiService.testWebhook(webhookId, 'triage.critical');
      success('Webhook Disparado com Sucesso', `Status HTTP: ${res.log.statusCode} (Latência de resposta: ${res.log.responseTime}ms)`);
      const whRes = await apiService.getWebhooks();
      setWebhookLogs(whRes.logs || []);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'Falha no webhook';
      error('Bloqueio de Segurança / Erro', msg);
    }
  };

  const handleAddQuickResponse = () => {
    if (!settings || !newSnippetData.shortcut || !newSnippetData.text) {
      warning('Campos Obrigatórios', 'Preencha o atalho (ex: /retorno) e o texto do modelo.');
      return;
    }

    const cleanShortcut = newSnippetData.shortcut.startsWith('/')
      ? newSnippetData.shortcut.substring(1)
      : newSnippetData.shortcut;

    const newQr: QuickResponse = {
      id: `qr_${Date.now()}`,
      shortcut: cleanShortcut,
      title: newSnippetData.title || `Atalho /${cleanShortcut}`,
      category: newSnippetData.category,
      text: newSnippetData.text,
      template: newSnippetData.text,
    };

    setSettings({
      ...settings,
      quickResponses: [newQr, ...settings.quickResponses],
    });
    setSelectedSnippetId(newQr.id);
    setIsNewSnippetModalOpen(false);
    setNewSnippetData({ shortcut: '', title: '', category: 'Geral', text: '' });
    markDirty();
    success('Modelo Criado', `Atalho /${cleanShortcut} adicionado aos rascunhos.`);
  };

  const handleDeleteQuickResponse = (qrId: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      quickResponses: settings.quickResponses.filter((q) => q.id !== qrId),
    });
    if (selectedSnippetId === qrId && settings.quickResponses.length > 1) {
      setSelectedSnippetId(settings.quickResponses.find((q) => q.id !== qrId)?.id || '');
    }
    markDirty();
    success('Snippet Removido', 'Modelo de resposta rápida excluído com sucesso.');
  };

  const handleAddWebhook = async () => {
    if (!newWebhookData.name || !newWebhookData.url) {
      warning('Campos Obrigatórios', 'Informe o nome do sistema parceiro e a URL HTTPS de destino.');
      return;
    }

    try {
      const res = await apiService.createWebhook({
        name: newWebhookData.name,
        url: newWebhookData.url,
        secret: newWebhookData.secret,
        events: newWebhookData.events,
        active: true,
      });
      setWebhooks([res.webhook, ...webhooks]);
      setIsNewWebhookModalOpen(false);
      setNewWebhookData({
        name: '',
        url: '',
        secret: `whsec_${Date.now().toString(36)}`,
        events: ['triage.critical'],
      });
      success('Webhook Criado', 'Novo endpoint registrado com proteção SSRF e HMAC ativo.');
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'Falha ao registrar webhook';
      error('Erro ao Criar Webhook', msg);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    try {
      await apiService.deleteWebhook(id);
      setWebhooks(webhooks.filter((w) => w.id !== id));
      success('Webhook Removido', 'Endpoint desvinculado do MediFlux.');
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'Falha ao excluir webhook';
      error('Erro', msg);
    }
  };

  // Toggle RBAC Permission
  const toggleRoleTab = (roleKey: Role, tabId: TabId) => {
    if (user?.role !== 'admin') {
      warning('Ação Restrita', 'Apenas Administradores podem reconfigurar a matriz RBAC.');
      return;
    }
    setPermissions((prev) =>
      prev.map((rp) => {
        if (rp.role !== roleKey) return rp;
        const exists = rp.permittedTabs.includes(tabId);
        const newTabs = exists
          ? rp.permittedTabs.filter((t) => t !== tabId)
          : [...rp.permittedTabs, tabId];
        return { ...rp, permittedTabs: newTabs };
      })
    );
    markDirty();
  };

  const toggleRoleAction = (roleKey: Role, actionId: SensitiveAction) => {
    if (user?.role !== 'admin') {
      warning('Ação Restrita', 'Apenas Administradores podem reconfigurar a matriz RBAC.');
      return;
    }
    setPermissions((prev) =>
      prev.map((rp) => {
        if (rp.role !== roleKey) return rp;
        const exists = rp.grantedActions.includes(actionId);
        const newActions = exists
          ? rp.grantedActions.filter((a) => a !== actionId)
          : [...rp.grantedActions, actionId];
        return { ...rp, grantedActions: newActions };
      })
    );
    markDirty();
  };

  // Filter SubTabs based on search term
  const filteredSubTabs = useMemo(() => {
    if (!searchTerm.trim()) return SUB_TABS;
    const term = searchTerm.toLowerCase();
    return SUB_TABS.filter(
      (tab) =>
        tab.label.toLowerCase().includes(term) ||
        tab.description.toLowerCase().includes(term) ||
        tab.categoryGroup.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const activeTabMeta = SUB_TABS.find((t) => t.id === activeSubTab) || SUB_TABS[0];

  // Simulator current template parsed text
  const currentSnippet = settings?.quickResponses.find((q) => q.id === selectedSnippetId) || settings?.quickResponses[0];
  const simulatedRenderedText = useMemo(() => {
    if (!currentSnippet) return '';
    const raw = currentSnippet.text || currentSnippet.template || '';
    return raw
      .replace(/{{patient_name}}|{{paciente}}/gi, simulatorPatientName)
      .replace(/{{doctor_name}}|{{medico}}/gi, simulatorDoctorName)
      .replace(/{{clinic_name}}|{{clinica}}/gi, identityData.nomeFantasia)
      .replace(/{{clinic_unit}}|{{unidade}}/gi, 'Unidade Jardins')
      .replace(/{{appointment_date}}|{{data}}/gi, simulatorDate)
      .replace(/{{appointment_time}}|{{horario}}/gi, simulatorTime);
  }, [currentSnippet, simulatorPatientName, simulatorDoctorName, simulatorDate, simulatorTime, identityData.nomeFantasia]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Action Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Settings className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Painel de Governança & Configurações da Clínica
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Compliance LGPD & TISS Ativos
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Controle centralizado dos 10 módulos de governança clínica, políticas de inteligência artificial Manchester, canais omnichannel e integrações PEP.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end md:self-center">
            {hasUnsavedChanges && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Alterações pendentes
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 ${
                hasUnsavedChanges
                  ? 'bg-sky-600 hover:bg-sky-700 text-white ring-2 ring-sky-300 ring-offset-1'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              } disabled:opacity-50`}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Salvando Alterações...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {hasUnsavedChanges ? 'Salvar Modificações' : 'Salvar Configurações'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Search Bar across settings */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar configurações (ex: WABA, Manchester, TISS, Webhook, SLA, RBAC)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-lg text-xs transition-colors focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
            />
          </div>
          <div className="hidden lg:flex items-center gap-4 text-[11px] text-slate-500">
            <span>
              <strong>Usuário Ativo:</strong> {user?.name} ({user?.role?.toUpperCase()})
            </span>
            <span>•</span>
            <span>
              <strong>Clínica:</strong> {identityData.nomeFantasia}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Navigation Rail & Right Active Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Navigation Sidebar (3.5 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-3 space-y-4 shadow-2xs">
          {['ORGANIZAÇÃO & CLÍNICA', 'COMUNICAÇÃO & ATENDIMENTO', 'INTELIGÊNCIA ARTIFICIAL & REGRAS', 'INTEGRAÇÕES & SISTEMA'].map((group) => {
            const groupTabs = filteredSubTabs.filter((t) => t.categoryGroup === group);
            if (groupTabs.length === 0) return null;

            return (
              <div key={group} className="space-y-1">
                <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  {group}
                </div>
                <div className="space-y-1">
                  {groupTabs.map((tab) => {
                    const isActive = activeSubTab === tab.id;
                    const IconComp = tab.icon;

                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveSubTab(tab.id)}
                        className={`w-full flex items-start gap-3 px-3 py-2.5 text-left rounded-xl text-xs transition-all ${
                          isActive
                            ? 'bg-sky-50 text-sky-950 font-bold border border-sky-200 shadow-2xs'
                            : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            isActive ? 'bg-sky-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <IconComp className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate">{tab.label}</span>
                            {tab.badge && (
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                  isActive
                                    ? 'bg-sky-200 text-sky-900'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {tab.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 font-normal line-clamp-1 mt-0.5">
                            {tab.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Main Content Area (8.5 cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-6">
          {/* Active Tab Header */}
          <div className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-500" />
              <h2 className="text-base font-bold text-slate-900">{activeTabMeta.label}</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">{activeTabMeta.description}</p>
          </div>

          {/* ========================================================================= */}
          {/* SUBTAB 0: IDENTIDADE & UNIDADES */}
          {/* ========================================================================= */}
          {activeSubTab === 0 && (
            <div className="space-y-6 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Razão Social Registrada</label>
                  <input
                    type="text"
                    value={identityData.razaoSocial}
                    onChange={(e) => {
                      setIdentityData({ ...identityData, razaoSocial: e.target.value });
                      markDirty();
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nome Fantasia da Clínica</label>
                  <input
                    type="text"
                    value={identityData.nomeFantasia}
                    onChange={(e) => {
                      setIdentityData({ ...identityData, nomeFantasia: e.target.value });
                      markDirty();
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">CNPJ (Receita Federal)</label>
                  <input
                    type="text"
                    value={identityData.cnpj}
                    onChange={(e) => {
                      setIdentityData({ ...identityData, cnpj: e.target.value });
                      markDirty();
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Código CNES (Datasus)</label>
                  <input
                    type="text"
                    value={identityData.cnes}
                    onChange={(e) => {
                      setIdentityData({ ...identityData, cnes: e.target.value });
                      markDirty();
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              {/* Responsável Técnico */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <ShieldCheck className="w-4 h-4 text-sky-600" />
                  Responsável Técnico Médico (CFM / CRM)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Nome do Médico Responsável</label>
                    <input
                      type="text"
                      value={identityData.rtNome}
                      onChange={(e) => {
                        setIdentityData({ ...identityData, rtNome: e.target.value });
                        markDirty();
                      }}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Registro Profissional (CRM/UF)</label>
                    <input
                      type="text"
                      value={identityData.rtCrm}
                      onChange={(e) => {
                        setIdentityData({ ...identityData, rtCrm: e.target.value });
                        markDirty();
                      }}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Contato e Horários */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Telefone Principal (PABX / SAC)</label>
                  <input
                    type="text"
                    value={identityData.telefonePrincipal}
                    onChange={(e) => {
                      setIdentityData({ ...identityData, telefonePrincipal: e.target.value });
                      markDirty();
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">WhatsApp Oficial de Atendimento</label>
                  <input
                    type="text"
                    value={identityData.whatsappAtendimento}
                    onChange={(e) => {
                      setIdentityData({ ...identityData, whatsappAtendimento: e.target.value });
                      markDirty();
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Endereço Completo da Unidade</label>
                  <input
                    type="text"
                    value={identityData.endereco}
                    onChange={(e) => {
                      setIdentityData({ ...identityData, endereco: e.target.value });
                      markDirty();
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Horário de Funcionamento para Pacientes</label>
                  <input
                    type="text"
                    value={identityData.horarioFuncionamento}
                    onChange={(e) => {
                      setIdentityData({ ...identityData, horarioFuncionamento: e.target.value });
                      markDirty();
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SUBTAB 8: GESTÃO DE FUNIS & ETAPAS */}
          {/* ========================================================================= */}
          {activeSubTab === 8 && (
            <div className="space-y-6 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Jornadas Clínicas & Funis Customizados</h3>
                  <p className="text-slate-500">Controle a passagem de bastão entre recepção, enfermagem e consultório médico.</p>
                </div>
              </div>

              <div className="space-y-4">
                {settings?.funnels.map((funnel) => (
                  <div key={funnel.id} className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <KanbanSquare className="w-4 h-4 text-sky-600" />
                        <span className="font-bold text-slate-900 text-sm">{funnel.name}</span>
                        {funnel.isDefault && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800">
                            Funil Padrão
                          </span>
                        )}
                      </div>
                      <span className="text-slate-500 font-medium">
                        {funnel.stages.length} etapas sequenciais
                      </span>
                    </div>

                    {/* Funnel Stages List */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2">
                      {funnel.stages.map((st, idx) => (
                        <div
                          key={st.id}
                          className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 text-[10px] flex items-center justify-center font-bold">
                                {idx + 1}
                              </span>
                              {st.name}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-500">
                            {st.requiredFields.length > 0 ? (
                              <span>Exige: {st.requiredFields.join(', ')}</span>
                            ) : (
                              <span className="text-slate-400">Sem campos obrigatórios</span>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-100">
                            <span className="text-slate-500 font-mono">ID: {st.id}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded font-medium ${
                                st.lockAdvanceWithoutRequiredFields
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {st.lockAdvanceWithoutRequiredFields ? 'Bloqueio Ativo' : 'Avanço Livre'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SUBTAB 1: RESPOSTAS RÁPIDAS & SNIPPETS COM SIMULADOR */}
          {/* ========================================================================= */}
          {activeSubTab === 1 && (
            <div className="space-y-6 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Gerenciador de Modelos de Resposta Rápida</h3>
                  <p className="text-slate-500">
                    Digite a barra <code className="bg-slate-100 px-1 py-0.5 rounded text-sky-800 font-mono font-bold">/</code> no chat de atendimento para acionar o preenchimento instantâneo.
                  </p>
                </div>
                <button
                  onClick={() => setIsNewSnippetModalOpen(true)}
                  className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Novo Snippet
                </button>
              </div>

              {/* Main 2-Column: Left Snippets list, Right Live Simulator */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left List (7 cols) */}
                <div className="lg:col-span-7 space-y-3">
                  {settings?.quickResponses.map((qr) => {
                    const isSelected = selectedSnippetId === qr.id;
                    return (
                      <div
                        key={qr.id}
                        onClick={() => setSelectedSnippetId(qr.id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-sky-50/70 border-sky-300 ring-2 ring-sky-400/20 shadow-2xs'
                            : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/80'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sky-900 bg-white px-2 py-0.5 rounded-md border border-slate-200 font-mono text-[11px]">
                              /{qr.shortcut}
                            </span>
                            <span className="font-bold text-slate-900">{qr.title}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-200/80 text-slate-700">
                              {qr.category}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteQuickResponse(qr.id);
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                              title="Excluir Snippet"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <textarea
                          rows={3}
                          value={qr.text || qr.template || ''}
                          onChange={(e) => {
                            const newText = e.target.value;
                            setSettings({
                              ...settings,
                              quickResponses: settings.quickResponses.map((item) =>
                                item.id === qr.id ? { ...item, text: newText, template: newText } : item
                              ),
                            });
                            markDirty();
                          }}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-mono text-[11px] focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Right WhatsApp Simulator (5 cols) */}
                <div className="lg:col-span-5 bg-slate-900 rounded-2xl p-4 text-white space-y-3 shadow-md">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <Smartphone className="w-4 h-4 text-emerald-400" />
                      Simulador de Envio WhatsApp
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">Live Preview</span>
                  </div>

                  {/* Simulator Controls */}
                  <div className="space-y-2 text-[11px] bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                    <div className="text-[10px] font-bold uppercase text-slate-400">Variáveis de Teste:</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400">Nome Paciente</label>
                        <input
                          type="text"
                          value={simulatorPatientName}
                          onChange={(e) => setSimulatorPatientName(e.target.value)}
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400">Nome Médico</label>
                        <input
                          type="text"
                          value={simulatorDoctorName}
                          onChange={(e) => setSimulatorDoctorName(e.target.value)}
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400">Data Consulta</label>
                        <input
                          type="text"
                          value={simulatorDate}
                          onChange={(e) => setSimulatorDate(e.target.value)}
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400">Horário</label>
                        <input
                          type="text"
                          value={simulatorTime}
                          onChange={(e) => setSimulatorTime(e.target.value)}
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[11px]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Simulated WhatsApp Bubble */}
                  <div className="bg-[#0b141a] p-3 rounded-xl min-h-[160px] flex flex-col justify-end">
                    <div className="bg-[#005c4b] text-slate-100 p-3 rounded-xl rounded-tr-none text-[11.5px] leading-relaxed shadow-sm font-sans">
                      {simulatedRenderedText}
                      <div className="text-[9px] text-emerald-200/70 text-right mt-1 font-mono">
                        {simulatorTime} • Enviado ✓✓
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 text-center">
                    Substituição em tempo real com dados sincronizados do paciente.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SUBTAB 6: CANAIS & OMNICHANNEL API */}
          {/* ========================================================================= */}
          {activeSubTab === 6 && (
            <div className="space-y-6 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    Canais de Atendimento & Conexão WhatsApp
                  </h3>
                  <p className="text-slate-500">
                    Gerencie a integração via <strong className="text-emerald-700 font-semibold font-mono">whatsapp-web.js (Node.js/Puppeteer)</strong> e outros canais omnichannel.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 font-mono">Motor: whatsapp-web.js v1.26.0</span>
                  <button
                    onClick={fetchWppSession}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
                    title="Atualizar status da sessão"
                  >
                    <RefreshIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Conexão real com WhatsApp — via whatsapp-web.js de verdade,
                  separada da simulação abaixo (que é ligada a uma rota de
                  demonstração, app/api/settings/whatsapp-web-js) */}
              <WhatsAppRealConnectionPanel />

              {/* WhatsApp-web.js Main Integration Hub */}
              <div className="p-5 bg-gradient-to-br from-emerald-500/5 via-slate-50 to-emerald-500/10 rounded-2xl border border-emerald-200/80 shadow-2xs space-y-5">
                {/* Header with status badge */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-emerald-100">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-2xs shrink-0">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-sm">WhatsApp Web.js • Puppeteer LocalAuth</h4>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase">
                          Multi-Device Ativo
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-200 text-slate-600 border border-slate-300 uppercase">
                          Demonstração
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Painel de demonstração — simula o comportamento da conexão sem abrir uma sessão real. Para
                        conectar um WhatsApp de verdade, use o painel &quot;Conexão real com WhatsApp&quot; acima.
                      </p>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="flex items-center gap-2 shrink-0">
                    {wppSession?.status === 'ready' && (
                      <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                        Conectado & Pronto (Ready)
                      </span>
                    )}
                    {wppSession?.status === 'qr_ready' && (
                      <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1.5 shadow-2xs animate-pulse">
                        <QrCode className="w-3.5 h-3.5 text-amber-600" />
                        Aguardando Leitura QR Code
                      </span>
                    )}
                    {wppSession?.status === 'disconnected' && (
                      <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1.5">
                        <WifiOff className="w-3.5 h-3.5 text-rose-600" />
                        Desconectado
                      </span>
                    )}
                    {wppSession?.status === 'connecting' && (
                      <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-300 flex items-center gap-1.5">
                        <RefreshIcon className="w-3.5 h-3.5 text-sky-600 animate-spin" />
                        Iniciando Puppeteer...
                      </span>
                    )}
                  </div>
                </div>

                {/* Sub-nav inside WhatsApp Web card */}
                <div className="flex items-center gap-2 border-b border-emerald-100/80 pb-2">
                  <button
                    onClick={() => setWppActiveSubView('qr_status')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 ${
                      wppActiveSubView === 'qr_status'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-emerald-50'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    Pareamento & QR Code
                  </button>
                  <button
                    onClick={() => setWppActiveSubView('advanced_config')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 ${
                      wppActiveSubView === 'advanced_config'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-emerald-50'
                    }`}
                  >
                    <Cpu className="w-3.5 h-3.5" />
                    Configuração Puppeteer & Sessão
                  </button>
                  <button
                    onClick={() => setWppActiveSubView('test_terminal')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 ${
                      wppActiveSubView === 'test_terminal'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-emerald-50'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    Terminal de Teste & Envio
                  </button>
                </div>

                {/* View 1: QR & Pairing */}
                {wppActiveSubView === 'qr_status' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    {/* Left col: QR Container / Session info */}
                    <div className="lg:col-span-6 bg-white p-4 rounded-xl border border-emerald-200/90 flex flex-col items-center justify-center text-center shadow-2xs">
                      {wppSession?.status === 'ready' ? (
                        <div className="py-4 space-y-3">
                          <div className="w-16 h-16 mx-auto bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-9 h-9" />
                          </div>
                          <div>
                            <h5 className="font-bold text-slate-900 text-sm">Dispositivo Conectado</h5>
                            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                              {wppSession.wid || '5511988776655@c.us'}
                            </p>
                          </div>
                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-left text-[11px] space-y-1.5 w-full">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Nome do Aparelho:</span>
                              <strong className="text-slate-800">{wppSession.pushname || 'CardioVida'}</strong>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Nível da Bateria:</span>
                              <span className="text-emerald-700 font-bold flex items-center gap-1">
                                <BatteryCharging className="w-3.5 h-3.5" />
                                {wppSession.batteryLevel || 98}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Sessão Local:</span>
                              <span className="font-mono text-slate-700">{wppSession.sessionName}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Mensagens Hoje:</span>
                              <span className="text-slate-800 font-bold">
                                ↑ {wppSession.messagesSentToday} | ↓ {wppSession.messagesReceivedToday}
                              </span>
                            </div>
                          </div>
                          <div className="pt-2 flex gap-2 w-full">
                            <button
                              onClick={() => handleWppAction('refresh_qr')}
                              disabled={wppLoadingAction !== null}
                              className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] transition-all flex items-center justify-center gap-1"
                            >
                              <RefreshIcon className="w-3.5 h-3.5" />
                              Re-parear
                            </button>
                            <button
                              onClick={() => handleWppAction('disconnect')}
                              disabled={wppLoadingAction !== null}
                              className="flex-1 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-[11px] transition-all flex items-center justify-center gap-1"
                            >
                              <Power className="w-3.5 h-3.5" />
                              Desconectar
                            </button>
                          </div>
                        </div>
                      ) : wppSession?.status === 'qr_ready' ? (
                        <div className="py-2 w-full">
                          <WhatsAppQRCodeViewer
                            qrCodeString={wppSession.qrCode}
                            expiresAt={wppSession.qrExpiresAt}
                            status={wppSession.status}
                            onRefreshQR={() => handleWppAction('refresh_qr')}
                            onSimulateScan={() =>
                              handleWppAction('simulate_scan', {
                                phoneNumber: settings?.channels.whatsapp.number || identityData.whatsappAtendimento,
                              })
                            }
                            onDirectConnect={(phone) =>
                              handleWppAction('connect_no_qr', {
                                phoneNumber:
                                  phone || settings?.channels.whatsapp.number || identityData.whatsappAtendimento,
                              })
                            }
                            isLoading={wppLoadingAction !== null}
                            clinicPhone={settings?.channels.whatsapp.number || '+55 (51) 99150-7327'}
                          />
                        </div>
                      ) : (
                        <div className="py-6 space-y-3">
                          <div className="w-14 h-14 mx-auto bg-slate-100 text-slate-400 rounded-full flex items-center justify-center">
                            <WifiOff className="w-7 h-7" />
                          </div>
                          <div>
                            <h5 className="font-bold text-slate-800 text-sm">Cliente Desconectado</h5>
                            <p className="text-[11px] text-slate-500 max-w-xs mt-1">
                              Conecte o motor <strong className="font-mono text-emerald-700">whatsapp-web.js</strong> diretamente via LocalAuth no número configurado pelo administrador.
                            </p>
                          </div>
                          <div className="flex flex-col sm:flex-row items-center gap-2">
                            <button
                              onClick={() =>
                                handleWppAction('connect_no_qr', {
                                  phoneNumber: settings?.channels.whatsapp.number || identityData.whatsappAtendimento,
                                })
                              }
                              disabled={wppLoadingAction !== null}
                              className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-2xs transition-all flex items-center justify-center gap-2"
                            >
                              <Zap className="w-4 h-4 text-amber-300" />
                              {wppLoadingAction === 'connect_no_qr' ? 'Conectando...' : 'Conectar Sem QR Code'}
                            </button>
                            <button
                              onClick={() => handleWppAction('start_client')}
                              disabled={wppLoadingAction !== null}
                              className="w-full px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              Modo QR Code
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right col: Setup Instructions & Architecture Guide */}
                    <div className="lg:col-span-6 space-y-3">
                      <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2.5 shadow-2xs">
                        <h5 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                          <Info className="w-4 h-4 text-sky-600" />
                          Como funciona a conexão com <span className="font-mono text-emerald-700">whatsapp-web.js</span>:
                        </h5>
                        <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-600 leading-relaxed">
                          <li>
                            <strong>Instalação Node.js:</strong> Utiliza o pacote oficial <code className="px-1 py-0.5 bg-slate-100 text-emerald-800 font-mono rounded">whatsapp-web.js</code> controlando uma instância headless do Chromium.
                          </li>
                          <li>
                            <strong>Estratégia LocalAuth:</strong> Os tokens de autenticação da sessão são salvos no diretório <code className="px-1 py-0.5 bg-slate-100 text-slate-700 font-mono rounded">.wwebjs_auth/</code> para persistir mesmo após reinicializações.
                          </li>
                          <li>
                            <strong>Eventos Automatizados:</strong> Dispara ouvintes de eventos nativos: <code className="font-mono text-slate-700">qr</code>, <code className="font-mono text-slate-700">ready</code>, <code className="font-mono text-slate-700">message_create</code> e <code className="font-mono text-slate-700">disconnected</code>.
                          </li>
                          <li>
                            <strong>Triagem e Encaminhamento:</strong> As mensagens recebidas passam automaticamente pelo pipeline de triagem com IA clínica (Gemini/Manchester).
                          </li>
                        </ol>
                      </div>

                      {/* Quick Specs Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                          <span className="text-slate-500 block text-[10px]">Autenticação</span>
                          <strong className="text-slate-800 font-mono">LocalAuth (Sessão)</strong>
                        </div>
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                          <span className="text-slate-500 block text-[10px]">Modo do Browser</span>
                          <strong className="text-slate-800 font-mono">Headless: true</strong>
                        </div>
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                          <span className="text-slate-500 block text-[10px]">Auto-Reconnect</span>
                          <strong className="text-emerald-700 font-bold">Ativado (5s retry)</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* View 2: Puppeteer & Session Advanced Config */}
                {wppActiveSubView === 'advanced_config' && (
                  <div className="space-y-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                    <h5 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-emerald-600" />
                      Parâmetros da Instância <span className="font-mono text-emerald-700">Client(options)</span>
                    </h5>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Identificador da Sessão (sessionName)</label>
                        <input
                          type="text"
                          value={wppSession?.sessionName || 'session_cardiovida_wpp'}
                          onChange={(e) => {
                            if (wppSession) setWppSession({ ...wppSession, sessionName: e.target.value });
                          }}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-[11px]"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Estratégia de Autenticação (authStrategy)</label>
                        <select
                          value={wppSession?.authStrategy || 'LocalAuth'}
                          onChange={(e) => {
                            if (wppSession) setWppSession({ ...wppSession, authStrategy: e.target.value as any });
                          }}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-[11px]"
                        >
                          <option value="LocalAuth">LocalAuth (Recomendado - Armazenamento Local)</option>
                          <option value="RemoteAuth">RemoteAuth (AWS S3 / Mongo Store)</option>
                          <option value="Legacy">Legacy / NoAuth (Requer QR a cada restart)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Caminho Executável Chromium (Puppeteer)</label>
                        <input
                          type="text"
                          defaultValue="/usr/bin/google-chrome-stable"
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-[11px]"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Webhook de Mensagens Entrantes (Inbound)</label>
                        <input
                          type="text"
                          value={wppSession?.webhookUrl || 'https://api.cardiovida.com.br/api/chat/webhook-wpp'}
                          onChange={(e) => {
                            if (wppSession) setWppSession({ ...wppSession, webhookUrl: e.target.value });
                          }}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-[11px]"
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex flex-wrap items-center gap-4 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={wppSession?.headless ?? true}
                          onChange={(e) => {
                            if (wppSession) setWppSession({ ...wppSession, headless: e.target.checked });
                          }}
                          className="w-4 h-4 text-emerald-600 rounded"
                        />
                        <span className="text-slate-700 font-semibold">Executar em modo Headless (Sem UI de janela)</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={wppSession?.autoRestart ?? true}
                          onChange={(e) => {
                            if (wppSession) setWppSession({ ...wppSession, autoRestart: e.target.checked });
                          }}
                          className="w-4 h-4 text-emerald-600 rounded"
                        />
                        <span className="text-slate-700 font-semibold">Auto-reconexão contínua em caso de perda de sinal</span>
                      </label>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={() =>
                          handleWppAction('update_config', {
                            sessionName: wppSession?.sessionName,
                            authStrategy: wppSession?.authStrategy,
                            webhookUrl: wppSession?.webhookUrl,
                            headless: wppSession?.headless,
                            autoRestart: wppSession?.autoRestart,
                          })
                        }
                        disabled={wppLoadingAction !== null}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-2xs transition-all flex items-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Salvar Configurações do Client
                      </button>
                    </div>
                  </div>
                )}

                {/* View 3: Test Terminal & Direct Dispatch */}
                {wppActiveSubView === 'test_terminal' && (
                  <div className="space-y-4 bg-slate-950 text-slate-100 p-4 rounded-xl font-mono text-xs shadow-2xs border border-slate-800">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400 font-bold">whatsapp-web.js REPL & Test Dispatcher</span>
                      </div>
                      <span className="text-[10px] text-slate-500">client.sendMessage / on(&apos;message&apos;)</span>
                    </div>

                    {/* Webhook endpoint card */}
                    <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-lg space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400 font-sans font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          Endpoint Webhook de Entrada Ativo (Inbound Listener):
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/api/chat/webhook-wpp`);
                            success('Webhook URL', 'Copiada para a área de transferência!');
                          }}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded text-[10px] flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" /> Copiar URL
                        </button>
                      </div>
                      <code className="text-emerald-300 text-[11px] block bg-black/50 p-1.5 rounded">
                        {typeof window !== 'undefined' ? `${window.location.origin}/api/chat/webhook-wpp` : '/api/chat/webhook-wpp'}
                      </code>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">Telefone (Origem ou Destino)</label>
                        <input
                          type="text"
                          value={wppTestPhone}
                          onChange={(e) => setWppTestPhone(e.target.value)}
                          placeholder="5551991507327"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[10px] text-slate-400 mb-1">Conteúdo da Mensagem</label>
                        <input
                          type="text"
                          value={wppTestMessage}
                          onChange={(e) => setWppTestMessage(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Dual Action Buttons: Outbound & Inbound */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        onClick={() =>
                          handleWppAction('test_send', {
                            to: wppTestPhone,
                            text: wppTestMessage,
                          })
                        }
                        disabled={wppLoadingAction !== null || wppSession?.status !== 'ready'}
                        className={`flex-1 px-3 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                          wppSession?.status === 'ready'
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-2xs'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <Send className="w-3.5 h-3.5" />
                        {wppLoadingAction === 'test_send' ? 'Disparando...' : '1. Enviar Mensagem (Outbound da Clínica)'}
                      </button>

                      <button
                        onClick={() =>
                          handleWppAction('simulate_inbound', {
                            from: wppTestPhone,
                            text: wppTestMessage,
                            pushname: `Paciente (${wppTestPhone.slice(-4)})`,
                          })
                        }
                        disabled={wppLoadingAction !== null}
                        className="flex-1 px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-300" />
                        {wppLoadingAction === 'simulate_inbound' ? 'Recebendo...' : '2. Simular Mensagem Recebida (Inbound do Paciente)'}
                      </button>
                    </div>

                    {/* Console / Event Log simulated output */}
                    <div className="p-3 bg-black/60 rounded-lg border border-slate-800/80 text-[11px] leading-relaxed text-slate-300 space-y-1">
                      <p className="text-emerald-400">$ [whatsapp-web.js] Initializing Client with LocalAuth...</p>
                      <p className="text-slate-400">» Puppeteer instance launched on headless mode</p>
                      <p className="text-emerald-300">✓ [Client Event] &apos;authenticated&apos; received. Session active for WID: {wppSession?.wid || '5551991507327@c.us'}</p>
                      <p className="text-emerald-300">✓ [Client Event] &apos;ready&apos; received. Telefone vinculado: {wppTestPhone}</p>
                      <p className="text-sky-300">ℹ Webhook inbound listener attached to /api/chat/webhook-wpp</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Alternative / Secondary Channels List */}
              <div className="space-y-2 pt-2">
                <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider">
                  Outros Canais Omnichannel Integrados
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Telegram */}
                  <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Send className="w-3.5 h-3.5 text-sky-500" /> Telegram Bot
                      </span>
                      <input
                        type="checkbox"
                        checked={settings?.channels.telegram.enabled ?? true}
                        onChange={(e) => {
                          if (!settings) return;
                          setSettings({
                            ...settings,
                            channels: {
                              ...settings.channels,
                              telegram: { ...settings.channels.telegram, enabled: e.target.checked },
                            },
                          });
                          markDirty();
                        }}
                        className="w-4 h-4 text-sky-600 rounded"
                      />
                    </div>
                    <input
                      type="text"
                      value={settings?.channels.telegram.botHandle || '@CardioVidaBot'}
                      onChange={(e) => {
                        if (!settings) return;
                        setSettings({
                          ...settings,
                          channels: {
                            ...settings.channels,
                            telegram: { ...settings.channels.telegram, botHandle: e.target.value },
                          },
                        });
                        markDirty();
                      }}
                      className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-mono text-[11px]"
                    />
                  </div>

                  {/* Instagram */}
                  <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-pink-500" /> Instagram Direct
                      </span>
                      <input
                        type="checkbox"
                        checked={settings?.channels.instagram.enabled ?? true}
                        onChange={(e) => {
                          if (!settings) return;
                          setSettings({
                            ...settings,
                            channels: {
                              ...settings.channels,
                              instagram: { ...settings.channels.instagram, enabled: e.target.checked },
                            },
                          });
                          markDirty();
                        }}
                        className="w-4 h-4 text-sky-600 rounded"
                      />
                    </div>
                    <input
                      type="text"
                      value={settings?.channels.instagram.profile || '@cardiovida.oficial'}
                      onChange={(e) => {
                        if (!settings) return;
                        setSettings({
                          ...settings,
                          channels: {
                            ...settings.channels,
                            instagram: { ...settings.channels.instagram, profile: e.target.value },
                          },
                        });
                        markDirty();
                      }}
                      className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-mono text-[11px]"
                    />
                  </div>

                  {/* Web Chat Widget */}
                  <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5 text-indigo-500" /> Web Chat Widget
                      </span>
                      <input
                        type="checkbox"
                        checked={settings?.channels.site.enabled ?? true}
                        onChange={(e) => {
                          if (!settings) return;
                          setSettings({
                            ...settings,
                            channels: {
                              ...settings.channels,
                              site: { ...settings.channels.site, enabled: e.target.checked },
                            },
                          });
                          markDirty();
                        }}
                        className="w-4 h-4 text-sky-600 rounded"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings?.channels.site.widgetColor || '#0ea5e9'}
                        onChange={(e) => {
                          if (!settings) return;
                          setSettings({
                            ...settings,
                            channels: {
                              ...settings.channels,
                              site: { ...settings.channels.site, widgetColor: e.target.value },
                            },
                          });
                          markDirty();
                        }}
                        className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={settings?.channels.site.widgetColor || '#0ea5e9'}
                        onChange={(e) => {
                          if (!settings) return;
                          setSettings({
                            ...settings,
                            channels: {
                              ...settings.channels,
                              site: { ...settings.channels.site, widgetColor: e.target.value },
                            },
                          });
                          markDirty();
                        }}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono text-[11px]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SUBTAB 3: ALERTAS WHATSAPP & SLA */}
          {/* ========================================================================= */}
          {activeSubTab === 3 && (
            <div className="space-y-6 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Alertas de Emergência & SLA de Enfermagem</h3>
                  <p className="text-slate-500">Configure os telefones que recebem disparos em caso de triagem Manchester Vermelha ou estouro de SLA.</p>
                </div>
              </div>

              {/* Plantão Numbers */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <Phone className="w-4 h-4 text-rose-600" />
                  Telefones de Plantão Médico / Enfermagem
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Telefone Principal de Emergência</label>
                    <input
                      type="text"
                      value={settings?.whatsappAlerts.emergencyNumber || '+5511999990001'}
                      onChange={(e) => {
                        if (!settings) return;
                        setSettings({
                          ...settings,
                          whatsappAlerts: { ...settings.whatsappAlerts, emergencyNumber: e.target.value },
                        });
                        markDirty();
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Tempo de Escalação de SLA (Minutos)</label>
                    <input
                      type="number"
                      value={settings?.whatsappAlerts.slaAlertMinutes || 15}
                      onChange={(e) => {
                        if (!settings) return;
                        setSettings({
                          ...settings,
                          whatsappAlerts: { ...settings.whatsappAlerts, slaAlertMinutes: Number(e.target.value) },
                        });
                        markDirty();
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Manchester Sound Rules */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <Volume2 className="w-4 h-4 text-sky-600" />
                  Notificações Sonoras e Alertas em Tempo Real
                </div>

                <div className="space-y-2.5">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings?.globalNotifications.enableSound ?? true}
                      onChange={(e) => {
                        if (!settings) return;
                        setSettings({
                          ...settings,
                          globalNotifications: { ...settings.globalNotifications, enableSound: e.target.checked },
                        });
                        markDirty();
                      }}
                      className="w-4 h-4 text-sky-600 rounded"
                    />
                    <span className="font-semibold text-slate-800">
                      Emitir sinal sonoro no painel da recepção ao detectar novos atendimentos
                    </span>
                  </label>

                  <div className="pl-6 space-y-1.5 pt-1">
                    <div className="font-semibold text-slate-600">Regra de Disparo Sonoro por Manchester:</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        { key: 'all', label: 'Todas as Cores' },
                        { key: 'vermelho_laranja', label: 'Apenas Vermelho e Laranja' },
                        { key: 'only_vermelho', label: 'Apenas Vermelho (Emergência)' },
                      ].map((rule) => (
                        <button
                          key={rule.key}
                          type="button"
                          onClick={() => {
                            if (!settings) return;
                            setSettings({
                              ...settings,
                              globalNotifications: {
                                ...settings.globalNotifications,
                                manchesterSoundRule: rule.key as any,
                              },
                            });
                            markDirty();
                          }}
                          className={`px-3 py-2 rounded-xl border text-center font-bold text-[11px] transition-all ${
                            settings?.globalNotifications.manchesterSoundRule === rule.key
                              ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {rule.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SUBTAB 2: POLÍTICAS DE RASCUNHOS & IA */}
          {/* ========================================================================= */}
          {activeSubTab === 2 && (
            <div className="space-y-6 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Políticas de Rascunhos & Governança de IA Clínica</h3>
                  <p className="text-slate-500">Regras de segurança médica para proteção do paciente e autonomia supervisionada.</p>
                </div>
              </div>

              {/* Mandated Human Review Toggles */}
              <div className="space-y-3">
                <div className="p-4 bg-rose-50/60 rounded-2xl border border-rose-200/80 flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={settings?.draftsPolicy.requireReviewForCritical ?? true}
                    onChange={(e) => {
                      if (!settings) return;
                      setSettings({
                        ...settings,
                        draftsPolicy: { ...settings.draftsPolicy, requireReviewForCritical: e.target.checked },
                      });
                      markDirty();
                    }}
                    className="w-4 h-4 text-rose-600 rounded mt-0.5"
                  />
                  <div>
                    <div className="font-bold text-rose-950 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      Exigir Revisão Humana Obrigatória em Casos Críticos (Vermelho / Laranja)
                    </div>
                    <p className="text-rose-800 text-[11px] mt-0.5">
                      Bloqueia o envio automático de qualquer resposta gerada por IA sem a prévia conferência de um médico ou enfermeiro responsável.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={settings?.draftsPolicy.allowDirectSendForRoutine ?? false}
                    onChange={(e) => {
                      if (!settings) return;
                      setSettings({
                        ...settings,
                        draftsPolicy: { ...settings.draftsPolicy, allowDirectSendForRoutine: e.target.checked },
                      });
                      markDirty();
                    }}
                    className="w-4 h-4 text-emerald-600 rounded mt-0.5"
                  />
                  <div>
                    <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Permitir Envio Automático em Mensagens de Rotina (Verde / Não-Urgente)
                    </div>
                    <p className="text-emerald-800 text-[11px] mt-0.5">
                      Agiliza respostas para confirmações de horário, orientações de preparo simples e localização da clínica.
                    </p>
                  </div>
                </div>
              </div>

              {/* Sliders & Offline Cache */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <Sliders className="w-4 h-4 text-sky-600" />
                  Temporizadores de Rascunho e Cache Local Criptografado
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700">Intervalo de Auto-Save de Rascunhos</label>
                      <span className="font-mono font-bold text-sky-700">
                        {settings?.draftsPolicy.autoSaveSeconds ?? 3} segundos
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={15}
                      value={settings?.draftsPolicy.autoSaveSeconds ?? 3}
                      onChange={(e) => {
                        if (!settings) return;
                        setSettings({
                          ...settings,
                          draftsPolicy: { ...settings.draftsPolicy, autoSaveSeconds: Number(e.target.value) },
                        });
                        markDirty();
                      }}
                      className="w-full accent-sky-600"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700">Retenção de Cache Offline Local</label>
                      <span className="font-mono font-bold text-sky-700">
                        {settings?.draftsPolicy.offlineCacheRetentionDays ?? 7} dias
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={30}
                      value={settings?.draftsPolicy.offlineCacheRetentionDays ?? 7}
                      onChange={(e) => {
                        if (!settings) return;
                        setSettings({
                          ...settings,
                          draftsPolicy: { ...settings.draftsPolicy, offlineCacheRetentionDays: Number(e.target.value) },
                        });
                        markDirty();
                      }}
                      className="w-full accent-sky-600"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SUBTAB 7: MATRIZ RBAC DE PERMISSÕES */}
          {/* ========================================================================= */}
          {activeSubTab === 7 && (
            <div className="space-y-6 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Matriz de Permissões RBAC (Abas e Ações Sensíveis)</h3>
                  <p className="text-slate-500">
                    Defina quais perfis podem visualizar abas específicas ou executar ações de alto risco LGPD.
                  </p>
                </div>
                {user?.role !== 'admin' && (
                  <span className="px-2.5 py-1 rounded bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200">
                    Modo Apenas Leitura (Requer Admin)
                  </span>
                )}
              </div>

              {/* Roles Matrix Tabs */}
              <div className="space-y-4">
                {ALL_ROLES.map((roleDef) => {
                  const rolePerm = permissions.find((p) => p.role === roleDef.key) || {
                    clinicId: '',
                    role: roleDef.key,
                    permittedTabs: [],
                    grantedActions: [],
                  };

                  return (
                    <div key={roleDef.key} className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${roleDef.color}`}>
                            {roleDef.label}
                          </span>
                          <span className="text-slate-500">{roleDef.desc}</span>
                        </div>
                        <span className="font-mono text-[10px] text-slate-400">
                          {rolePerm.permittedTabs.length} abas • {rolePerm.grantedActions.length} ações
                        </span>
                      </div>

                      {/* Permitted Tabs */}
                      <div>
                        <div className="font-semibold text-slate-700 mb-1.5">Abas com Acesso Liberado:</div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                          {ALL_TABS.map((tab) => {
                            const isChecked = rolePerm.permittedTabs.includes(tab.id);
                            return (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => toggleRoleTab(roleDef.key, tab.id)}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-left text-[11px] transition-colors ${
                                  isChecked
                                    ? 'bg-sky-50 text-sky-900 border-sky-300 font-semibold'
                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                {isChecked ? (
                                  <CheckSquare className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                ) : (
                                  <Square className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                )}
                                <span className="truncate">{tab.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Granted Sensitive Actions */}
                      <div className="pt-2 border-t border-slate-200/60">
                        <div className="font-semibold text-slate-700 mb-1.5">Ações Sensíveis / LGPD Autorizadas:</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {ALL_ACTIONS.map((act) => {
                            const isChecked = rolePerm.grantedActions.includes(act.id);
                            return (
                              <button
                                key={act.id}
                                type="button"
                                onClick={() => toggleRoleAction(roleDef.key, act.id)}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-left text-[11px] transition-colors ${
                                  isChecked
                                    ? act.danger
                                      ? 'bg-rose-50 text-rose-900 border-rose-300 font-semibold'
                                      : 'bg-emerald-50 text-emerald-900 border-emerald-300 font-semibold'
                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                {isChecked ? (
                                  <CheckSquare
                                    className={`w-3.5 h-3.5 shrink-0 ${
                                      act.danger ? 'text-rose-600' : 'text-emerald-600'
                                    }`}
                                  />
                                ) : (
                                  <Square className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                )}
                                <span className="truncate">{act.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SUBTAB 5: INTEGRAÇÕES PEP / EHR */}
          {/* ========================================================================= */}
          {activeSubTab === 5 && (
            <div className="space-y-6 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Integrações com Prontuário Eletrônico (PEP / EHR)</h3>
                  <p className="text-slate-500">
                    Sincronização com MV Soul, Tasy Philips, iClinic, TOTVS TISS/TUSS, HiDoctor e Feegow.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {ehrList.map((ehr) => (
                  <div key={ehr.id} className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-sm shadow-2xs">
                          {ehr.provider[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-900 text-xs">{ehr.provider}</h4>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                ehr.status === 'connected'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {ehr.status === 'connected' ? 'Conectado' : 'Não Configurado'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500">
                            Direção: {ehr.syncDirection} • Frequência: {ehr.syncFrequency} • Último sync: {ehr.lastSyncAt ? new Date(ehr.lastSyncAt).toLocaleTimeString() : 'Nunca'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingEhr(ehr)}
                          className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-slate-700 font-semibold text-[11px] flex items-center gap-1 shadow-2xs"
                        >
                          <Key className="w-3.5 h-3.5 text-slate-500" />
                          Credenciais
                        </button>
                        <button
                          onClick={() => handleSyncEHR(ehr.id)}
                          disabled={isSyncingEHR === ehr.id}
                          className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold text-[11px] flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSyncingEHR === ehr.id ? 'animate-spin' : ''}`} />
                          {isSyncingEHR === ehr.id ? 'Sincronizando...' : 'Sincronizar Agora'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-slate-500 font-semibold mb-0.5 text-[11px]">Endpoint da API</label>
                        <input
                          type="text"
                          defaultValue={ehr.endpoint}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 font-semibold mb-0.5 text-[11px]">Token / Chave de API</label>
                        <input
                          type="text"
                          disabled
                          value={ehr.maskedKey || '••••••••••••••••'}
                          className="w-full px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-lg font-mono text-[11px] text-slate-500 cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Firestore Multi-Tenant & Test Users Seeding Card */}
              <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 rounded-2xl border border-sky-800/60 shadow-xl text-white space-y-4">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30">
                        <Database className="w-4 h-4" />
                      </span>
                      <h4 className="font-bold text-sm text-white">Google Cloud Firestore — Isolamento Multi-Tenant</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                        Regras de Segurança Ativas
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px] max-w-2xl">
                      Banco de dados NoSQL gerenciado em nuvem com particionamento estrito por <code className="text-sky-300 bg-slate-800 px-1 py-0.5 rounded">clinicId</code> e autenticação RBAC via PBKDF2.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={fetchFirestoreStatus}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[11px] font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Checar Status
                    </button>
                    <button
                      type="button"
                      onClick={handleSeedFirestore}
                      disabled={isSeedingFirestore}
                      className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-[11px] font-bold flex items-center gap-1.5 shadow-lg shadow-sky-950 transition-all disabled:opacity-50"
                    >
                      <Database className={`w-3.5 h-3.5 ${isSeedingFirestore ? 'animate-spin' : ''}`} />
                      {isSeedingFirestore ? 'Populando Firestore...' : 'Popular 4 Usuários de Teste'}
                    </button>
                  </div>
                </div>

                {/* Firestore Database & Rules Metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Database ID</div>
                    <div className="text-xs font-mono font-bold text-sky-400 truncate mt-0.5">
                      {firestoreStatus?.databaseId || 'ai-studio-medifluxcrmhealt-c70fd804-3280-47c9-aec3-ac790f225cc0'}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Isolamento Multi-Tenant</div>
                    <div className="text-xs font-semibold text-emerald-400 mt-0.5 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{'/clinics/{clinicId}/*'}</span>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Usuários Registrados</div>
                    <div className="text-xs font-mono font-bold text-amber-400 mt-0.5">
                      {firestoreStatus?.totalUsers ?? 5} contas ativas
                    </div>
                  </div>
                </div>

                {/* 4 Test Users Scoped Details */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <div className="text-[11px] font-bold text-slate-300">Usuários de Teste Pré-Configurados no Firestore:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    <div className="p-2.5 bg-slate-950/90 rounded-xl border border-slate-800/80 text-[11px] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-indigo-300">Admin Geral</span>
                        <span className="text-[9px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-1.5 py-0.2 rounded font-bold">RBAC Total</span>
                      </div>
                      <div className="text-slate-300 font-medium truncate">Dr. Roberto Vasconcelos</div>
                      <div className="text-slate-500 text-[10px] truncate">admin@cardiovida.com.br</div>
                    </div>

                    <div className="p-2.5 bg-slate-950/90 rounded-xl border border-slate-800/80 text-[11px] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sky-300">Médico</span>
                        <span className="text-[9px] bg-sky-950 text-sky-300 border border-sky-800 px-1.5 py-0.2 rounded font-bold">CRM 189.432</span>
                      </div>
                      <div className="text-slate-300 font-medium truncate">Dra. Camila Albuquerque</div>
                      <div className="text-slate-500 text-[10px] truncate">camila.med@cardiovida.com.br</div>
                    </div>

                    <div className="p-2.5 bg-slate-950/90 rounded-xl border border-slate-800/80 text-[11px] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-300">Recepção</span>
                        <span className="text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.2 rounded font-bold">Triagem</span>
                      </div>
                      <div className="text-slate-300 font-medium truncate">Juliana Mendes</div>
                      <div className="text-slate-500 text-[10px] truncate">recepcao@cardiovida.com.br</div>
                    </div>

                    <div className="p-2.5 bg-slate-950/90 rounded-xl border border-slate-800/80 text-[11px] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-300">Financeiro</span>
                        <span className="text-[9px] bg-amber-950 text-amber-300 border border-amber-800 px-1.5 py-0.2 rounded font-bold">TISS/Fatur</span>
                      </div>
                      <div className="text-slate-300 font-medium truncate">Carlos Eduardo Peixoto</div>
                      <div className="text-slate-500 text-[10px] truncate">financeiro@cardiovida.com.br</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1">
                    <span>Senha padrão de teste para todos os perfis: <code className="text-sky-300 bg-slate-800 px-1.5 py-0.5 rounded font-mono font-bold">cardiovida2026</code></span>
                    <span className="text-slate-500">Script CLI: <code className="text-slate-300 font-mono">npm run seed:firestore</code></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SUBTAB 4: WEBHOOKS & EVENTOS (SSRF GUARD) */}
          {/* ========================================================================= */}
          {activeSubTab === 4 && (
            <div className="space-y-6 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Webhooks de Saída & Proteção Antirrede Privada (SSRF Guard)</h3>
                  <p className="text-slate-500">
                    Notifique sistemas hospitalares e sistemas terceiros com assinatura HMAC SHA-256 e validação de IP público.
                  </p>
                </div>
                <button
                  onClick={() => setIsNewWebhookModalOpen(true)}
                  className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Novo Webhook
                </button>
              </div>

              {/* Webhooks List */}
              <div className="space-y-3">
                {webhooks.map((w) => (
                  <div key={w.id} className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs">{w.name}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          SSRF Verified
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTestWebhook(w.id)}
                          className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-2xs"
                        >
                          <Send className="w-3 h-3 text-sky-600" />
                          Disparar Teste
                        </button>
                        <button
                          onClick={() => handleDeleteWebhook(w.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
                          title="Excluir Webhook"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="font-mono text-slate-700 bg-white p-2 rounded-xl border border-slate-200 text-[11px] truncate">
                      {w.url}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 flex-wrap gap-2">
                      <span>Eventos: {w.events.join(', ')}</span>
                      <span className="font-mono">Secret: {w.secret.substring(0, 8)}••••••••</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Webhook Execution Logs */}
              {webhookLogs.length > 0 && (
                <div className="p-4 bg-slate-900 text-slate-200 rounded-2xl space-y-2 font-mono text-[11px]">
                  <div className="flex items-center justify-between font-bold text-xs text-sky-400">
                    <span>Logs Recentes de Disparo de Webhooks</span>
                    <span>Status HTTP</span>
                  </div>
                  {webhookLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between py-1 border-t border-slate-800">
                      <span>{log.event} ({log.responseTime}ms)</span>
                      <span className={log.statusCode === 200 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        HTTP {log.statusCode}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* SUBTAB 9: ASSINATURA & FATURAMENTO */}
          {/* ========================================================================= */}
          {activeSubTab === 9 && (
            <div className="space-y-6 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Plano, Validade da Licença & Faturamento</h3>
                  <p className="text-slate-500">Transparência total de recursos contratados, controle do período de testes no Firestore e consumo mensal.</p>
                </div>
              </div>

              {/* Dynamic Trial Warning / Active Card */}
              {subscription?.billingStatus === 'em_trial' && (
                <div
                  className={`p-5 rounded-2xl border ${
                    subscription.trialInfo?.isExpiringSoon || (subscription.trialInfo?.daysRemaining ?? 7) <= 2
                      ? 'bg-amber-500/10 border-amber-400 text-amber-950'
                      : 'bg-teal-500/10 border-teal-300 text-teal-950'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 ${
                          subscription.trialInfo?.isExpiringSoon || (subscription.trialInfo?.daysRemaining ?? 7) <= 2
                            ? 'bg-amber-600'
                            : 'bg-teal-600'
                        }`}
                      >
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              subscription.trialInfo?.isExpiringSoon || (subscription.trialInfo?.daysRemaining ?? 7) <= 2
                                ? 'bg-amber-200 text-amber-900 border border-amber-300'
                                : 'bg-teal-200 text-teal-900 border border-teal-300'
                            }`}
                          >
                            {subscription.trialInfo?.isExpiringSoon || (subscription.trialInfo?.daysRemaining ?? 7) <= 2
                              ? '⚠️ EXPIRA EM MENOS DE 2 DIAS'
                              : '✨ PERÍODO DE AVALIAÇÃO DE 7 DIAS'}
                          </span>
                          <span className="text-slate-500 text-[11px]">Banco: Google Cloud Firestore</span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 mt-1">
                          {subscription.trialInfo?.isExpiringSoon || (subscription.trialInfo?.daysRemaining ?? 7) <= 2
                            ? `Restam apenas ${subscription.trialInfo?.hoursRemaining ?? 36} horas do período de testes`
                            : `Licença de Teste Ativa: ${subscription.trialInfo?.daysRemaining ?? 7} dias restantes`}
                        </h4>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          {subscription.trialInfo?.message ||
                            'O MediFlux verifica a data de criação do usuário no Firestore para liberar o acesso durante os 7 dias.'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-slate-500 block">Válido até:</span>
                      <span className="font-mono font-bold text-slate-800 text-xs">
                        {subscription.trialInfo?.formattedEndsAt || '7 dias a partir do registro'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Active Plan Card */}
              <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 text-white rounded-2xl space-y-4 shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-sky-400">
                      {subscription?.billingStatus === 'em_trial' ? 'Plano em Teste Gratuito' : 'Plano Ativo'}
                    </span>
                    <h4 className="text-lg font-black text-white">
                      MediFlux {subscription?.basePlan === 'enterprise' ? 'Enterprise Health' : (subscription?.basePlan || 'Enterprise')}
                    </h4>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-extrabold text-emerald-400">
                      {subscription?.billingStatus === 'em_trial' ? 'R$ 0,00 (Trial 7 Dias)' : 'R$ 890,00'}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {subscription?.billingStatus === 'em_trial' ? 'Acesso total liberado' : 'cobrança mensal automática'}
                    </span>
                  </div>
                </div>

                {/* Resource Usage Bars */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-700/80">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300">Atendimentos / Mês</span>
                      <span className="font-bold text-sky-400">342 / 1.000</span>
                    </div>
                    <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-sky-500 rounded-full" style={{ width: '34.2%' }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300">Requisições de IA</span>
                      <span className="font-bold text-emerald-400">1.280 / 5.000</span>
                    </div>
                    <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: '25.6%' }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300">Armazenamento LGPD</span>
                      <span className="font-bold text-purple-400">4.2 GB / 50 GB</span>
                    </div>
                    <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: '8.4%' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Add-ons List */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="font-bold text-slate-900">Módulos e Add-ons Inclusos na Licença:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" /> Triagem Clínica Manchester com Roteador Dual IA
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" /> Sincronizador Bidirecional TISS / TUSS (TOTVS/iClinic)
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" /> Detector de Pacientes Duplicados & Unificação Segura
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" /> Trilha Imutável de Auditoria LGPD e Exportação
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: CRIAR NOVO SNIPPET / RESPOSTA RÁPIDA */}
      {/* ========================================================================= */}
      {isNewSnippetModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">Criar Novo Modelo de Resposta Rápida</h3>
              <button
                onClick={() => setIsNewSnippetModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Atalho (ex: /retorno)</label>
                  <input
                    type="text"
                    placeholder="/orientacoes"
                    value={newSnippetData.shortcut}
                    onChange={(e) => setNewSnippetData({ ...newSnippetData, shortcut: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Categoria</label>
                  <select
                    value={newSnippetData.category}
                    onChange={(e) => setNewSnippetData({ ...newSnippetData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="Geral">Geral</option>
                    <option value="Agendamento">Agendamento</option>
                    <option value="Exames">Exames</option>
                    <option value="Emergência">Emergência</option>
                    <option value="Financeiro">Financeiro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Título Descritivo</label>
                <input
                  type="text"
                  placeholder="Orientações pós-consulta"
                  value={newSnippetData.title}
                  onChange={(e) => setNewSnippetData({ ...newSnippetData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Texto da Mensagem</label>
                <textarea
                  rows={4}
                  placeholder="Olá {{patient_name}}, segue sua receita médica..."
                  value={newSnippetData.text}
                  onChange={(e) => setNewSnippetData({ ...newSnippetData, text: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                />
                <div className="flex gap-1.5 flex-wrap mt-1 text-[10px] text-slate-500">
                  <span>Variáveis:</span>
                  <button
                    type="button"
                    onClick={() => setNewSnippetData({ ...newSnippetData, text: newSnippetData.text + ' {{patient_name}}' })}
                    className="font-mono text-sky-700 bg-sky-50 px-1 py-0.5 rounded"
                  >
                    + {"{{patient_name}}"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewSnippetData({ ...newSnippetData, text: newSnippetData.text + ' {{doctor_name}}' })}
                    className="font-mono text-sky-700 bg-sky-50 px-1 py-0.5 rounded"
                  >
                    + {"{{doctor_name}}"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewSnippetData({ ...newSnippetData, text: newSnippetData.text + ' {{appointment_date}}' })}
                    className="font-mono text-sky-700 bg-sky-50 px-1 py-0.5 rounded"
                  >
                    + {"{{appointment_date}}"}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsNewSnippetModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddQuickResponse}
                className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold"
              >
                Salvar Snippet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CRIAR NOVO WEBHOOK */}
      {/* ========================================================================= */}
      {isNewWebhookModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">Registrar Novo Endpoint de Webhook (SSRF Guard)</h3>
              <button
                onClick={() => setIsNewWebhookModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nome do Sistema Parceiro</label>
                <input
                  type="text"
                  placeholder="Hospital Albert Einstein - Triagem"
                  value={newWebhookData.name}
                  onChange={(e) => setNewWebhookData({ ...newWebhookData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">URL HTTPS de Destino (IP Público Obrigatório)</label>
                <input
                  type="text"
                  placeholder="https://hospital.com.br/api/mediflux"
                  value={newWebhookData.url}
                  onChange={(e) => setNewWebhookData({ ...newWebhookData, url: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Segredo de Assinatura HMAC SHA-256</label>
                <input
                  type="text"
                  value={newWebhookData.secret}
                  onChange={(e) => setNewWebhookData({ ...newWebhookData, secret: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsNewWebhookModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddWebhook}
                className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold"
              >
                Registrar Webhook
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDITAR CREDENCIAIS EHR */}
      {/* ========================================================================= */}
      {editingEhr && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                Credenciais Seguras • {editingEhr.provider}
              </h3>
              <button
                onClick={() => setEditingEhr(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nova Chave de API / Bearer Token</label>
                <input
                  type="password"
                  placeholder="Insira a nova chave gerada pelo software de PEP..."
                  value={ehrApiKeyInput}
                  onChange={(e) => setEhrApiKeyInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                A chave é criptografada e armazenada com isolamento multi-tenant por clínica.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setEditingEhr(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  try {
                    await apiService.updateEHRIntegration(editingEhr.id, {
                      apiKey: ehrApiKeyInput,
                      status: 'connected',
                    });
                    const ehrRes = await apiService.getEHRIntegrations();
                    setEhrList(ehrRes.integrations);
                    setEditingEhr(null);
                    setEhrApiKeyInput('');
                    success('Credenciais Atualizadas', `Conexão com ${editingEhr.provider} restabelecida.`);
                  } catch (err: unknown) {
                    const msg = (err as { message?: string })?.message || 'Falha ao gravar chave';
                    error('Erro', msg);
                  }
                }}
                className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold"
              >
                Salvar Credencial
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
