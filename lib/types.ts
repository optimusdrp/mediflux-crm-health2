export type Role = 'admin' | 'recepcao' | 'financeiro' | 'terceirizado' | 'medico';

export type TabId = 
  | 'landing_page'
  | 'visao_geral'
  | 'atendimentos'
  | 'jornadas'
  | 'pendencias'
  | 'automacoes'
  | 'indicadores'
  | 'configuracoes'
  | 'auditoria_lgpd'
  | 'analise_inteligente';

export type SensitiveAction = 
  | 'excluir_paciente'
  | 'unificar_duplicados'
  | 'exportar_dados_lgpd'
  | 'alterar_permissoes'
  | 'configurar_integracoes_pep'
  | 'gerenciar_cobranca'
  | 'disparar_webhooks_teste'
  | 'visualizar_prontuario_sensivel';

export type UrgencyLevel = 'critica' | 'alta' | 'media' | 'baixa';

export interface User {
  id: string;
  clinicId: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string;
  crm?: string;
  specialty?: string;
  active: boolean;
}

export interface Clinic {
  id: string;
  name: string;
  unit: string;
  cnpj: string;
  phone: string;
  address: string;
  logoUrl?: string;
}

export interface TrialInfo {
  isTrial: boolean;
  isValid: boolean;
  registeredAt: string;
  trialEndsAt: string;
  totalDays: number;
  daysRemaining: number;
  hoursRemaining: number;
  isExpiringSoon: boolean; // less than 2 days remaining (< 48 hours)
  isExpired: boolean;
  status: 'active' | 'expiring_soon' | 'expired' | 'permanent';
  message?: string;
  formattedEndsAt?: string;
}

export interface Subscription {
  clinicId: string;
  basePlan: 'essencial' | 'profissional' | 'enterprise';
  addOns: {
    triagem_clinica: boolean;
    classificacao_automatica: boolean;
    qualificacao_lead: boolean;
    analise_sentimento: boolean;
  };
  billingStatus: 'ativo' | 'inadimplente' | 'em_trial' | 'cancelado';
  maxAppointmentsPerMonth: number;
  currentPeriodAppointments: number;
  aiCallsCount: number;
  nextBillingAt: string;
  trialEndsAt?: string;
  trialInfo?: TrialInfo;
}

export interface UsageRecord {
  clinicId: string;
  periodKey: string; // YYYY-MM
  appointmentsCount: number;
  aiCallsCount: number;
  overLimitFee: number;
}

export interface Patient {
  id: string;
  clinicId: string;
  name: string;
  phone: string;
  cpf: string;
  birthDate: string;
  healthInsurance: string; // e.g. "Unimed", "Bradesco Saúde", "Particular"
  planNumber: string;
  specialty: string;
  funnelStage: string; // e.g. "novo", "em_triagem", "aguardando_medico", "agendado", "concluido"
  funnelId: string;
  urgency: UrgencyLevel;
  checklist: { [key: string]: boolean };
  notes: string;
  tags: string[];
  lastInteractionAt: string;
  assignedUserId?: string;
  unreadCount?: number;
  originChannel: 'whatsapp' | 'telegram' | 'site' | 'instagram' | 'presencial';
  aiSummary?: string;
  sentiment?: 'positivo' | 'neutro' | 'negativo' | 'urgente';
  leadScore?: number;
  requiresHumanReview?: boolean;
}

export interface ChatMessage {
  id: string;
  clinicId: string;
  patientId: string;
  sender: 'patient' | 'attendant' | 'bot' | 'system';
  senderName?: string;
  text: string;
  isInternalNote: boolean;
  timestamp: string;
  channel?: 'whatsapp' | 'telegram' | 'site' | 'instagram';
  aiAnalysis?: {
    urgency?: UrgencyLevel;
    tags?: string[];
    suggestedReply?: string;
    clinicalSignals?: string[];
  };
}

export interface Appointment {
  id: string;
  clinicId: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
  procedure: string;
  status: 'agendado' | 'confirmado' | 'em_atendimento' | 'concluido' | 'cancelado' | 'faltou';
  ehrData?: {
    integrated: boolean;
    ehrSystem?: string;
    remoteId?: string;
    syncedAt?: string;
    tissGuiaNumber?: string;
  };
}

export interface PriorityRule {
  id: string;
  clinicId: string;
  name: string;
  slaMinutes: number;
  condition: string;
  manchesterColor: 'vermelho' | 'laranja' | 'amarelo' | 'verde' | 'azul';
  enabled: boolean;
}

export interface AutomationRule {
  id: string;
  clinicId: string;
  name: string;
  trigger: string;
  actions: string[];
  active: boolean;
  successRate: number;
  executionCount: number;
}

export interface EHRIntegration {
  id: string;
  clinicId: string;
  provider: 'iClinic' | 'TOTVS' | 'HiDoctor' | 'Feegow';
  endpoint: string;
  maskedKey: string;
  rawKey?: string;
  syncDirection: 'bi-directional' | 'inbound' | 'outbound';
  syncFrequency: 'realtime' | '5min' | 'hourly' | 'daily';
  syncEntities: string[]; // ['patients', 'appointments', 'prescriptions']
  tissConfig?: {
    ansCode: string;
    tussTableVersion: string;
    enableAutomaticGuias: boolean;
  };
  lastSyncAt?: string;
  status: 'connected' | 'error' | 'unconfigured';
}

export type LGPDCategory =
  | 'acesso_dados'
  | 'exportacao'
  | 'exclusao'
  | 'alteracao_cadastral'
  | 'unificacao'
  | 'login'
  | 'consentimento';

export interface AuditLog {
  id: string;
  clinicId: string;
  action: string;
  target: string;
  authorEmail: string; // Extracted strictly from JWT
  authorRole: Role;
  ip: string;
  timestamp: string;
  details?: Record<string, unknown>;
  lgpdCategory?: LGPDCategory;
}

export interface RolePermission {
  clinicId: string;
  role: Role;
  permittedTabs: TabId[];
  grantedActions: SensitiveAction[];
}

export interface Webhook {
  id: string;
  clinicId: string;
  name: string;
  url: string;
  secret: string;
  active: boolean;
  events: string[]; // e.g. ['patient.created', 'appointment.scheduled', 'triage.critical']
  createdAt: string;
}

export interface WebhookLog {
  id: string;
  clinicId: string;
  webhookId: string;
  event: string;
  statusCode: number;
  responseTime: number;
  timestamp: string;
  payloadSummary?: string;
  errorMessage?: string;
}

export interface QuickResponse {
  id: string;
  shortcut: string; // e.g. "/boasvindas"
  title: string;
  text: string;
  template?: string;
  category: string;
}

export interface FunnelStage {
  id: string;
  name: string;
  color: string;
  order: number;
  requiredFields: string[]; // e.g. ['cpf', 'healthInsurance', 'planNumber']
  lockAdvanceWithoutRequiredFields: boolean;
}

export interface Funnel {
  id: string;
  name: string;
  isDefault: boolean;
  stages: FunnelStage[];
}

export interface ClinicSettings {
  clinicId: string;
  quickResponses: QuickResponse[];
  draftsPolicy: {
    autoSaveSeconds: number;
    offlineCacheRetentionDays: number;
    enableLocalEncryptedDrafts: boolean;
    requireReviewForCritical?: boolean;
    allowDirectSendForRoutine?: boolean;
  };
  whatsappAlerts: {
    dutyPhones: string[];
    slaBreachDispatches: boolean;
    criticalTriageAlerts: boolean;
    emergencyNumber?: string;
    slaAlertMinutes?: number;
  };
  globalNotifications: {
    enableSound: boolean;
    enablePopups: boolean;
    manchesterSoundRule: 'all' | 'vermelho_laranja' | 'only_vermelho';
  };
  channels: {
    whatsapp: {
      enabled: boolean;
      number: string;
      businessHours: string;
      connectionType?: 'whatsapp-web.js' | 'cloud-api';
      wppWebConfig?: {
        sessionName: string;
        authStrategy: 'LocalAuth' | 'RemoteAuth' | 'Legacy';
        headless: boolean;
        autoRestart: boolean;
        webhookUrl?: string;
      };
    };
    telegram: { enabled: boolean; botHandle: string; businessHours: string };
    instagram: { enabled: boolean; profile: string; businessHours: string };
    site: { enabled: boolean; widgetColor: string; businessHours: string };
  };
  funnels: Funnel[];
}

export interface TriageResult {
  urgency: UrgencyLevel;
  confidence: number;
  clinicalSignals: string[];
  recommendedAction: string;
  suggestedProtocol: string;
  slaMinutes: number;
  manchesterCategory: string;
  manchesterColor?: 'vermelho' | 'laranja' | 'amarelo' | 'verde' | 'azul';
  requiresHumanReview: boolean;
  guardrailTriggered: boolean;
  guardrailReason?: string;
  redFlags?: string[];
  suggestedAttendantResponse?: string;
  providerUsed: 'Bedrock (Claude Haiku 4.5)' | 'Google Gemini' | 'Fallback Heurístico Local';
  executionTimeMs: number;
  reasoning: string;
}

export interface AutoTagResult {
  tags: string[];
  category: string;
  specialtySuggested: string;
  providerUsed: string;
}

export interface LeadQualificationResult {
  score: number; // 0-100
  qualificationLevel: 'Quente' | 'Morno' | 'Frio';
  commercialInterest: string;
  preferredDatesSuggested: string[];
  keyMotivators: string[];
  providerUsed: string;
}

export interface SentimentAnalysisResult {
  sentiment: 'positivo' | 'neutro' | 'negativo' | 'urgente';
  score: number; // -1.0 to 1.0
  emotionalState: string;
  frustrationIndicators: string[];
  recommendedTone: string;
  providerUsed: string;
}

export interface DuplicateMatch {
  primaryPatient: Patient;
  duplicateCandidate: Patient;
  matchReason: 'cpf_exato' | 'telefone_exato' | 'nome_similar' | 'multiplos_fatores';
  confidenceScore: number; // 0 - 100
}
