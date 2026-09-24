import { authFetch } from './authFetch';
import {
  User,
  Clinic,
  Subscription,
  UsageRecord,
  Patient,
  ChatMessage,
  Appointment,
  PriorityRule,
  AutomationRule,
  EHRIntegration,
  AuditLog,
  RolePermission,
  Webhook,
  WebhookLog,
  ClinicSettings,
  DuplicateMatch,
  TriageResult,
  AutoTagResult,
  LeadQualificationResult,
  SentimentAnalysisResult,
  Role,
  Contact,
  ContactGroup,
  InternalChatThread,
  InternalChatMessage,
  ConversationGroup,
  ConversationGroupMessage,
  TabId,
  SensitiveAction,
  Funnel,
  FunnelStage,
  Unit,
} from '../types';

export const apiService = {
  // 1. Autenticação
  async login(email: string, password?: string) {
    return authFetch<{
      token: string;
      firebaseToken: string | null;
      user: User;
      clinic: Clinic;
      subscription: Subscription;
      permissions: RolePermission;
    }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  async getMe() {
    return authFetch<{
      user: User;
      clinic: Clinic;
      subscription: Subscription;
      permissions: RolePermission;
      dynaliteValidated: boolean;
    }>("/api/auth/me");
  },

  async registerTrial(trialData: {
    name: string;
    email: string;
    phone?: string;
    clinicName: string;
    specialty?: string;
    teamSize?: string;
    password?: string;
    acceptTerms: boolean;
  }) {
    return authFetch<{
      token: string;
      firebaseToken: string | null;
      user: User;
      clinic: Clinic;
      subscription: Subscription;
      permissions: RolePermission;
      trialDaysRemaining: number;
      trialExpiresAt: string;
      message: string;
    }>("/api/auth/register-trial", {
      method: "POST",
      body: JSON.stringify(trialData),
    });
  },

  async simulateTrial(
    mode:
      | "active_7_days"
      | "expiring_soon_36h"
      | "expiring_soon_12h"
      | "expired",
    email?: string,
  ) {
    return authFetch<{
      success: boolean;
      trialStatus?: any;
      message: string;
    }>("/api/auth/simulate-trial", {
      method: "POST",
      body: JSON.stringify({ mode, email }),
    });
  },

  // 2. Pacientes
  async getPatients(params?: {
    search?: string;
    specialty?: string;
    stage?: string;
    urgency?: string;
    conversationStatus?: string;
  }) {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.specialty) query.set("specialty", params.specialty);
    if (params?.stage) query.set("stage", params.stage);
    if (params?.urgency) query.set("urgency", params.urgency);
    if (params?.conversationStatus)
      query.set("conversationStatus", params.conversationStatus);
    return authFetch<{ patients: Patient[] }>(
      `/api/patients?${query.toString()}`,
    );
  },

  async getPatient(id: string) {
    return authFetch<{ patient: Patient }>(`/api/patients/${id}`);
  },

  async createPatient(patientData: Partial<Patient>) {
    return authFetch<{
      patient: Patient;
      usageWarning: {
        overLimit: boolean;
        currentCount: number;
        maxAllowed: number;
      };
    }>("/api/patients", {
      method: "POST",
      body: JSON.stringify(patientData),
    });
  },

  async updatePatient(id: string, updates: Partial<Patient>) {
    return authFetch<{ patient: Patient }>(`/api/patients/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  },

  /**
   * Envia ou troca a foto de perfil do paciente. Aceita JPEG, PNG ou
   * WebP, até 3MB. A URL retornada é assinada e temporária (15 min)
   * — a mesma URL não deve ser reaproveitada além disso; ao recarregar
   * a lista de pacientes, uma nova URL válida já vem embutida.
   */
  async uploadPatientPhoto(patientId: string, base64: string, mimetype: string) {
    return authFetch<{ patient: Patient }>(`/api/patients/${patientId}/photo`, {
      method: "POST",
      body: JSON.stringify({ base64, mimetype }),
    });
  },

  async deletePatient(id: string) {
    return authFetch<{ success: boolean; message: string }>(
      `/api/patients/${id}`,
      {
        method: "DELETE",
      },
    );
  },

  async archivePatientConversation(id: string, reason: string) {
    return authFetch<{ patient: Patient }>(`/api/patients/${id}/archive`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  async reopenPatientConversation(id: string) {
    return authFetch<{ patient: Patient }>(`/api/patients/${id}/reopen`, {
      method: "POST",
    });
  },

  // 3. Duplicados & Unificação
  async getDuplicateCandidates() {
    return authFetch<{ duplicates: DuplicateMatch[] }>(
      "/api/patients/duplicates",
    );
  },

  async mergePatients(primaryId: string, secondaryId: string) {
    return authFetch<{ success: boolean; message: string; patient: Patient }>(
      "/api/patients/merge",
      {
        method: "POST",
        body: JSON.stringify({ primaryId, secondaryId }),
      },
    );
  },

  // 4. Chat & Mensagens
  async getChatMessages(patientId: string) {
    return authFetch<{ messages: ChatMessage[] }>(
      `/api/chat/messages?patientId=${patientId}`,
    );
  },

  async sendChatMessage(payload: {
    patientId: string;
    text: string;
    isInternalNote?: boolean;
    sender?: "attendant" | "bot" | "patient";
    channel?: string;
  }) {
    return authFetch<{ message: ChatMessage; whatsappDeliveryError?: string }>(
      "/api/chat/messages",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  /**
   * Transcreve o áudio de uma mensagem já recebida — chamada sob
   * demanda (o usuário clica no botão "Transcrever"), não automática
   * em toda mensagem. A transcrição é salva no backend na primeira
   * chamada; chamadas seguintes retornam do cache (campo `cached`).
   */
  async transcribeAudioMessage(patientId: string, messageId: string) {
    return authFetch<{ transcription: string; cached: boolean }>(
      "/api/chat/messages/transcribe",
      {
        method: "POST",
        body: JSON.stringify({ patientId, messageId }),
      },
    );
  },

  // 5. Inteligência Artificial Dual
  async analyzeMessageTriage(
    messageText: string,
    patientId?: string,
    messagesHistory?: string[],
    forceFallback?: boolean,
  ) {
    return authFetch<{ triage: TriageResult; patient?: Patient }>(
      "/api/analyze-message",
      {
        method: "POST",
        body: JSON.stringify({
          messageText,
          patientId,
          messagesHistory,
          forceFallback,
        }),
      },
    );
  },

  async autoTagMessages(messages: string[], patientId?: string) {
    return authFetch<{ result: AutoTagResult; patient?: Patient }>(
      "/api/ai/auto-tag",
      {
        method: "POST",
        body: JSON.stringify({ messages, patientId }),
      },
    );
  },

  async qualifyLead(patientId: string) {
    return authFetch<{ result: LeadQualificationResult; patient?: Patient }>(
      "/api/ai/qualify-lead",
      {
        method: "POST",
        body: JSON.stringify({ patientId }),
      },
    );
  },

  async analyzeSentiment(patientId: string) {
    return authFetch<{ result: SentimentAnalysisResult; patient?: Patient }>(
      "/api/ai/sentiment-analysis",
      {
        method: "POST",
        body: JSON.stringify({ patientId }),
      },
    );
  },

  // 6. Agendamentos
  async getAppointments(params?: { patientId?: string; date?: string; startDate?: string; endDate?: string; doctorName?: string }) {
    const query = new URLSearchParams();
    if (params?.patientId) query.set("patientId", params.patientId);
    if (params?.date) query.set("date", params.date);
    if (params?.startDate) query.set("startDate", params.startDate);
    if (params?.endDate) query.set("endDate", params.endDate);
    if (params?.doctorName) query.set("doctorName", params.doctorName);
    return authFetch<{ appointments: Appointment[] }>(
      `/api/appointments?${query.toString()}`,
    );
  },

  async createAppointment(appointmentData: Partial<Appointment>) {
    return authFetch<{ appointment: Appointment }>("/api/appointments", {
      method: "POST",
      body: JSON.stringify(appointmentData),
    });
  },

  async updateAppointment(id: string, updates: Partial<Appointment>) {
    return authFetch<{ appointment: Appointment }>("/api/appointments", {
      method: "PUT",
      body: JSON.stringify({ id, ...updates }),
    });
  },

  // 7. Regras de Prioridade (Manchester)
  async getPriorityRules() {
    return authFetch<{ rules: PriorityRule[] }>("/api/rules/priority");
  },

  async createPriorityRule(ruleData: Partial<PriorityRule>) {
    return authFetch<{ rule: PriorityRule }>("/api/rules/priority", {
      method: "POST",
      body: JSON.stringify(ruleData),
    });
  },

  async updatePriorityRule(id: string, updates: Partial<PriorityRule>) {
    return authFetch<{ rule: PriorityRule }>("/api/rules/priority", {
      method: "PUT",
      body: JSON.stringify({ id, ...updates }),
    });
  },

  // 8. Automações
  async getAutomationRules() {
    return authFetch<{ automations: AutomationRule[] }>(
      "/api/rules/automation",
    );
  },

  async createAutomationRule(automationData: Partial<AutomationRule>) {
    return authFetch<{ automation: AutomationRule }>("/api/rules/automation", {
      method: "POST",
      body: JSON.stringify(automationData),
    });
  },

  async updateAutomationRule(id: string, updates: Partial<AutomationRule>) {
    return authFetch<{ automation: AutomationRule }>("/api/rules/automation", {
      method: "PUT",
      body: JSON.stringify({ id, ...updates }),
    });
  },

  // 9. Integrações EHR / PEP
  async getEHRIntegrations() {
    return authFetch<{ integrations: EHRIntegration[] }>("/api/ehr");
  },

  async updateEHRIntegration(
    id: string,
    updates: Partial<EHRIntegration> & { apiKey?: string },
  ) {
    return authFetch<{ integration: EHRIntegration }>("/api/ehr", {
      method: "PUT",
      body: JSON.stringify({ id, ...updates }),
    });
  },

  async syncEHR(id: string) {
    return authFetch<{
      success: boolean;
      message: string;
      syncedAt: string;
      syncedEntitiesCount: { patients: number; appointments: number };
    }>("/api/ehr/sync", {
      method: "POST",
      body: JSON.stringify({ id }),
    });
  },

  // 10. Auditoria LGPD
  async getAuditLogs(params?: { category?: string; search?: string }) {
    const query = new URLSearchParams();
    if (params?.category) query.set("category", params.category);
    if (params?.search) query.set("search", params.search);
    return authFetch<{ logs: AuditLog[] }>(
      `/api/audit-logs?${query.toString()}`,
    );
  },

  async logAuditEvent(
    action: string,
    target: string,
    lgpdCategory: string,
    details?: any,
  ) {
    return authFetch<{ log: AuditLog }>("/api/audit-logs", {
      method: "POST",
      body: JSON.stringify({ action, target, lgpdCategory, details }),
    });
  },

  // 11. Configurações da Clínica
  async getClinicSettings() {
    return authFetch<{
      settings: ClinicSettings;
      permissions: RolePermission[];
      users: User[];
    }>("/api/settings");
  },

  async saveClinicSettings(
    payload: Partial<ClinicSettings> & { rolePermissions?: any[] },
  ) {
    return authFetch<{ success: boolean; settings: ClinicSettings }>(
      "/api/settings",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  /**
   * Persiste os dados de identidade institucional da clínica (Configurações
   * → "1. Identidade & Unidades"). Rota nova nesta migração — no projeto
   * original esses dados existiam só como estado local (identityData),
   * nunca eram de fato salvos, mesmo clicando em "Salvar".
   */
  // 0.5 Perfil do Usuário — rotas novas. Antes, o avatar circular no
  // cabeçalho (iniciais do nome) não tinha nenhuma ação ao clicar.
  async getProfile() {
    return authFetch<{ user: User }>("/api/profile");
  },

  async updateProfile(payload: {
    name?: string;
    crm?: string;
    specialty?: string;
  }) {
    return authFetch<{ user: User }>("/api/profile", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async changePassword(currentPassword: string, newPassword: string) {
    return authFetch<{ success: boolean; message: string }>(
      "/api/profile/password",
      {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      },
    );
  },

  async saveClinicIdentity(payload: Partial<Clinic>) {
    return authFetch<{ clinic: Clinic }>("/api/clinic", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  // 11.4 Gestão de Unidades de Atendimento — rotas novas. Toda clínica
  // tem 1 unidade incluída no plano; unidades extras são contratadas
  // à parte (ver campo limit.extraUnitPriceBRL retornado por getUnits).
  async getUnits() {
    return authFetch<{
      units: Unit[];
      limit: { max: number; used: number; extraUnitPriceBRL: number };
    }>("/api/units");
  },

  async createUnit(payload: {
    name: string;
    address?: string;
    phone?: string;
    horarioFuncionamento?: string;
  }) {
    return authFetch<{ unit: Unit }>("/api/units", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateUnit(
    id: string,
    payload: {
      name?: string;
      address?: string;
      phone?: string;
      horarioFuncionamento?: string;
    },
  ) {
    return authFetch<{ unit: Unit }>("/api/units", {
      method: "PUT",
      body: JSON.stringify({ id, ...payload }),
    });
  },

  async deleteUnit(id: string) {
    return authFetch<{ success: boolean }>(
      `/api/units?id=${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      },
    );
  },

  // 11.5 Gestão de Funis & Etapas — CRUD completo, rotas novas nesta
  // migração (a tela original era só leitura, sem nenhuma destas
  // operações existir de fato).
  async createFunnel(name: string) {
    return authFetch<{ funnel: Funnel; funnels: Funnel[] }>("/api/funnels", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },

  async updateFunnel(
    funnelId: string,
    updates: { name?: string; isDefault?: boolean },
  ) {
    return authFetch<{ funnels: Funnel[] }>("/api/funnels", {
      method: "PUT",
      body: JSON.stringify({ funnelId, ...updates }),
    });
  },

  async deleteFunnel(funnelId: string, force = false) {
    return authFetch<{
      success: boolean;
      funnels: Funnel[];
      patientsReassigned: number;
    }>(
      `/api/funnels?funnelId=${encodeURIComponent(funnelId)}${force ? "&force=true" : ""}`,
      { method: "DELETE" },
    );
  },

  async createFunnelStage(
    funnelId: string,
    stage: {
      name: string;
      color?: string;
      requiredFields?: string[];
      lockAdvanceWithoutRequiredFields?: boolean;
      isExitStage?: boolean;
    },
  ) {
    return authFetch<{ stage: FunnelStage; funnels: Funnel[] }>(
      "/api/funnels/stages",
      {
        method: "POST",
        body: JSON.stringify({ funnelId, ...stage }),
      },
    );
  },

  async updateFunnelStage(
    funnelId: string,
    stageId: string,
    updates: {
      name?: string;
      color?: string;
      order?: number;
      requiredFields?: string[];
      lockAdvanceWithoutRequiredFields?: boolean;
      isExitStage?: boolean;
      conversionGoal?: { minConversionPercent?: number; maxDaysInStage?: number };
      entryAutomation?: { enabled: boolean; messageText: string };
    },
  ) {
    return authFetch<{ funnels: Funnel[] }>("/api/funnels/stages", {
      method: "PUT",
      body: JSON.stringify({ funnelId, stageId, ...updates }),
    });
  },

  async deleteFunnelStage(funnelId: string, stageId: string, force = false) {
    return authFetch<{
      success: boolean;
      funnels: Funnel[];
      patientsReassigned: number;
    }>(
      `/api/funnels/stages?funnelId=${encodeURIComponent(funnelId)}&stageId=${encodeURIComponent(stageId)}${force ? "&force=true" : ""}`,
      { method: "DELETE" },
    );
  },

  /**
   * Métricas reais do funil, calculadas a partir do histórico de
   * transições de etapa (não do volume atual, que só mostra a foto
   * de agora): conversão real por etapa, tempo médio até avançar, e
   * comparação com a meta configurada. Base da Visão Executiva de
   * Jornadas.
   */
  async getFunnelAnalytics(funnelId: string) {
    return authFetch<{
      funnelId: string;
      stages: {
        stageId: string;
        stageName: string;
        enteredCount: number;
        leftCount: number;
        conversionPercent: number | null;
        avgDurationDays: number | null;
        goal: { minConversionPercent?: number; maxDaysInStage?: number } | null;
        meetsConversionGoal: boolean | null;
        meetsDurationGoal: boolean | null;
      }[];
      topLossReasons: { count: number; example: string }[];
    }>(`/api/funnels/${encodeURIComponent(funnelId)}/analytics`);
  },

  // 11.5 Central de Contatos — pacientes, leads e outros contatos
  // unificados. Pacientes aparecem automaticamente (a partir do
  // cadastro real de Patient); leads e outros são criados/editados
  // por aqui, com checagem de duplicidade por nome + telefone juntos
  // (nunca telefone sozinho, já que mais de uma pessoa pode
  // compartilhar o mesmo número).
  async getContacts() {
    return authFetch<{ contacts: Contact[] }>("/api/contacts");
  },

  async createContact(payload: {
    type: 'lead' | 'outro';
    name: string;
    phone?: string;
    email?: string;
    notes?: string;
    leadScore?: number;
    leadStatus?: Contact['leadStatus'];
    tags?: string[];
    /** Vincula o lead direto a uma etapa de um funil real — quando informados (os dois juntos), o lead já nasce como um Patient real (patientStatus: 'lead'), participando do Kanban normalmente. */
    funnelId?: string;
    funnelStage?: string;
    healthInsurance?: string;
    specialty?: string;
  }) {
    return authFetch<{ contact: Contact; patient?: Patient }>("/api/contacts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateContact(payload: {
    id: string;
    name?: string;
    phone?: string;
    email?: string;
    notes?: string;
    leadScore?: number;
    leadStatus?: Contact['leadStatus'];
    tags?: string[];
    /** Vincula um lead simples (Contact) a um funil real — promove ele a Patient (patientStatus: 'lead'). */
    funnelId?: string;
    funnelStage?: string;
  }) {
    return authFetch<{ contact: Contact; patient?: Patient }>("/api/contacts", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async deleteContact(id: string) {
    return authFetch<{ success: boolean }>(`/api/contacts?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async getContactGroups() {
    return authFetch<{ groups: ContactGroup[] }>("/api/contact-groups");
  },

  async createContactGroup(payload: { name: string; description?: string; contactIds?: string[] }) {
    return authFetch<{ group: ContactGroup }>("/api/contact-groups", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateContactGroup(payload: { id: string; name?: string; description?: string; contactIds?: string[] }) {
    return authFetch<{ success: boolean }>("/api/contact-groups", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async deleteContactGroup(id: string) {
    return authFetch<{ success: boolean }>(`/api/contact-groups?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  // 11.8 Chat Interno — conversas entre usuários da equipe (não
  // confundir com ChatMessage, que é conversa com paciente via
  // WhatsApp). Só usuários ATIVOS podem ser encontrados para iniciar
  // uma conversa nova; a primeira mensagem já cria a thread
  // automaticamente, sem passo de convite.
  async getInternalChatThreads() {
    return authFetch<{
      threads: (InternalChatThread & { displayName?: string; unreadCount: number })[];
    }>("/api/internal-chat/threads");
  },

  async getInternalChatMessages(threadId: string) {
    return authFetch<{ messages: InternalChatMessage[] }>(
      `/api/internal-chat/threads/${encodeURIComponent(threadId)}/messages`,
    );
  },

  async sendInternalChatMessage(payload: { threadId?: string; recipientUserId?: string; text: string }) {
    return authFetch<{ message: InternalChatMessage; threadId: string }>("/api/internal-chat/messages", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async createInternalChatGroup(payload: { name: string; participantUserIds: string[] }) {
    return authFetch<{ thread: InternalChatThread }>("/api/internal-chat/groups", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async markInternalChatThreadRead(threadId: string) {
    return authFetch<{ success: boolean; markedCount: number }>(
      `/api/internal-chat/threads/${encodeURIComponent(threadId)}/read`,
      { method: "POST" },
    );
  },

  // 11.9 Grupos de Conversa — diferente de ContactGroup (organização
  // interna) e de InternalChatThread em grupo (conversa entre
  // usuários da equipe). Cobre 2 modos: grupo REAL do WhatsApp (todos
  // se veem) ou disparo em massa/broadcast (cada um recebe
  // individualmente, sem saber dos demais).
  async getConversationGroups() {
    return authFetch<{ groups: ConversationGroup[] }>("/api/conversation-groups");
  },

  async createConversationGroup(payload: {
    name: string;
    mode: 'whatsapp_group' | 'broadcast';
    contactIds: string[];
    description?: string;
    /** Onde o card aparece na fila de Atendimentos — padrão 'destacado' quando omitido. */
    queuePosition?: ConversationGroup['queuePosition'];
    /** Se o card mostra um chat de verdade com respostas, ou fica só como registro — padrão true quando omitido. */
    showReplies?: boolean;
  }) {
    return authFetch<{ group: ConversationGroup }>("/api/conversation-groups", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async deleteConversationGroup(id: string) {
    return authFetch<{ success: boolean; note: string }>(`/api/conversation-groups?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async sendConversationGroupMessage(groupId: string, text: string) {
    return authFetch<{ success: boolean; mode: 'whatsapp_group' | 'broadcast'; sent?: number; failed?: number; errors?: { contactId: string; name: string; message: string }[] }>(
      `/api/conversation-groups/${encodeURIComponent(groupId)}/send`,
      { method: "POST", body: JSON.stringify({ text }) },
    );
  },

  async updateConversationGroup(payload: {
    id: string;
    name?: string;
    queuePosition?: ConversationGroup['queuePosition'];
    showReplies?: boolean;
    silenced?: boolean;
    /** Remove só este contato do grupo — o atendimento normal dele não é afetado. */
    removeContactId?: string;
  }) {
    return authFetch<{ group: ConversationGroup }>("/api/conversation-groups", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async getConversationGroupMessages(groupId: string) {
    return authFetch<{ messages: ConversationGroupMessage[] }>(
      `/api/conversation-groups/${encodeURIComponent(groupId)}/messages`,
    );
  },

  // 11.6 Gestão de Usuários — CRUD completo, restrito a administrador.
  // Rotas novas: antes não existia nenhuma tela dedicada de gestão de
  // equipe — a lista de usuários só aparecia embutida em
  // getClinicSettings(), sem nenhuma ação de criar/editar/desativar.
  // Usuários nunca são excluídos de verdade (ver comentário completo
  // em routes/users.ts do backend) — "remover" aqui é desativar.
  async getUsers() {
    return authFetch<{ users: User[] }>("/api/users");
  },

  async createUser(payload: {
    name: string;
    email: string;
    role: Role;
    additionalRoles?: Role[];
    specialty?: string;
    crm?: string;
    password?: string;
  }) {
    return authFetch<{ user: User; temporaryPassword?: string }>("/api/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateUser(payload: {
    id: string;
    name?: string;
    role?: Role;
    additionalRoles?: Role[];
    customPermissionOverride?: { permittedTabs: TabId[]; grantedActions: SensitiveAction[] };
    specialty?: string;
    crm?: string;
    active?: boolean;
    newPassword?: string;
  }) {
    return authFetch<{ user: User }>("/api/users", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },


  // 12. Webhooks
  async getWebhooks() {
    return authFetch<{ webhooks: Webhook[]; logs: WebhookLog[] }>(
      "/api/webhooks",
    );
  },

  async createWebhook(webhookData: Partial<Webhook>) {
    return authFetch<{ webhook: Webhook }>("/api/webhooks", {
      method: "POST",
      body: JSON.stringify(webhookData),
    });
  },

  async deleteWebhook(id: string) {
    return authFetch<{ success: boolean }>(`/api/webhooks?id=${id}`, {
      method: "DELETE",
    });
  },

  async testWebhook(webhookId: string, event: string) {
    return authFetch<{ success: boolean; message: string; log: WebhookLog }>(
      "/api/webhooks/test",
      {
        method: "POST",
        body: JSON.stringify({ webhookId, event }),
      },
    );
  },

  // 13. Assinatura & Billing
  async getSubscription() {
    return authFetch<{
      subscription: Subscription;
      usageRecords: UsageRecord[];
    }>("/api/subscriptions");
  },

  async updateSubscription(payload: Partial<Subscription>) {
    return authFetch<{ subscription: Subscription }>("/api/subscriptions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // 14. Conexão real com WhatsApp (lib/whatsapp/)
  async connectWhatsApp(options?: {
    authMethod?: "qr" | "phone_number";
    phoneNumber?: string;
  }) {
    return authFetch<{
      status: string;
      qrDataUrl?: string;
      pairingCode?: string;
      error?: string;
    }>("/api/settings/whatsapp-connection", {
      method: "POST",
      body: options ? JSON.stringify(options) : undefined,
    });
  },

  async getWhatsAppConnectionStatus() {
    return authFetch<{
      status: string;
      authMethod?: "qr" | "phone_number";
      qrDataUrl?: string;
      pairingCode?: string;
      connectedNumber?: string;
      lastError?: string;
      historySyncResult?: {
        chatsScanned: number;
        chatsWithUnread: number;
        messagesImported: number;
      };
      historySyncError?: string;
    }>("/api/settings/whatsapp-connection");
  },

  async disconnectWhatsApp() {
    return authFetch<{ status: string }>("/api/settings/whatsapp-connection", {
      method: "DELETE",
    });
  },
};
