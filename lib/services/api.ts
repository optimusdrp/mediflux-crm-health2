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
    }>('/api/auth/login', {
      method: 'POST',
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
    }>('/api/auth/me');
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
    }>('/api/auth/register-trial', {
      method: 'POST',
      body: JSON.stringify(trialData),
    });
  },

  async getDynaliteStatus() {
    return authFetch<{
      status: {
        online: boolean;
        port: number;
        tables: string[];
        userCount: number;
        engine: string;
      };
      totalRegisteredUsers: number;
      users: Array<{
        email: string;
        name: string;
        role: string;
        clinicId: string;
        active: boolean;
      }>;
      timestamp: string;
    }>('/api/auth/dynalite-status');
  },

  async getFirestoreStatus() {
    return authFetch<{
      status: {
        connected: boolean;
        projectId: string;
        databaseId: string;
        collection: string;
        provider: string;
      };
      totalRegisteredUsers: number;
      users: Array<{
        id: string;
        email: string;
        name: string;
        role: string;
        clinicId: string;
        crm?: string;
        specialty?: string;
        active: boolean;
      }>;
      timestamp: string;
    }>('/api/auth/firestore-status');
  },

  async simulateTrial(mode: 'active_7_days' | 'expiring_soon_36h' | 'expiring_soon_12h' | 'expired', email?: string) {
    return authFetch<{
      success: boolean;
      trialStatus?: any;
      message: string;
    }>('/api/auth/simulate-trial', {
      method: 'POST',
      body: JSON.stringify({ mode, email }),
    });
  },

  // 2. Pacientes
  async getPatients(params?: { search?: string; specialty?: string; stage?: string; urgency?: string }) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.specialty) query.set('specialty', params.specialty);
    if (params?.stage) query.set('stage', params.stage);
    if (params?.urgency) query.set('urgency', params.urgency);
    return authFetch<{ patients: Patient[] }>(`/api/patients?${query.toString()}`);
  },

  async getPatient(id: string) {
    return authFetch<{ patient: Patient }>(`/api/patients/${id}`);
  },

  async createPatient(patientData: Partial<Patient>) {
    return authFetch<{
      patient: Patient;
      usageWarning: { overLimit: boolean; currentCount: number; maxAllowed: number };
    }>('/api/patients', {
      method: 'POST',
      body: JSON.stringify(patientData),
    });
  },

  async updatePatient(id: string, updates: Partial<Patient>) {
    return authFetch<{ patient: Patient }>(`/api/patients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deletePatient(id: string) {
    return authFetch<{ success: boolean; message: string }>(`/api/patients/${id}`, {
      method: 'DELETE',
    });
  },

  // 3. Duplicados & Unificação
  async getDuplicateCandidates() {
    return authFetch<{ duplicates: DuplicateMatch[] }>('/api/patients/duplicates');
  },

  async mergePatients(primaryId: string, secondaryId: string) {
    return authFetch<{ success: boolean; message: string; patient: Patient }>('/api/patients/merge', {
      method: 'POST',
      body: JSON.stringify({ primaryId, secondaryId }),
    });
  },

  // 4. Chat & Mensagens
  async getChatMessages(patientId: string) {
    return authFetch<{ messages: ChatMessage[] }>(`/api/chat/messages?patientId=${patientId}`);
  },

  async sendChatMessage(payload: {
    patientId: string;
    text: string;
    isInternalNote?: boolean;
    sender?: 'attendant' | 'bot' | 'patient';
    channel?: string;
  }) {
    return authFetch<{ message: ChatMessage; whatsappDeliveryError?: string }>('/api/chat/messages', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // 5. Inteligência Artificial Dual
  async analyzeMessageTriage(messageText: string, patientId?: string, messagesHistory?: string[], forceFallback?: boolean) {
    return authFetch<{ triage: TriageResult; patient?: Patient }>('/api/analyze-message', {
      method: 'POST',
      body: JSON.stringify({ messageText, patientId, messagesHistory, forceFallback }),
    });
  },

  async autoTagMessages(messages: string[], patientId?: string) {
    return authFetch<{ result: AutoTagResult; patient?: Patient }>('/api/ai/auto-tag', {
      method: 'POST',
      body: JSON.stringify({ messages, patientId }),
    });
  },

  async qualifyLead(patientId: string) {
    return authFetch<{ result: LeadQualificationResult; patient?: Patient }>('/api/ai/qualify-lead', {
      method: 'POST',
      body: JSON.stringify({ patientId }),
    });
  },

  async analyzeSentiment(patientId: string) {
    return authFetch<{ result: SentimentAnalysisResult; patient?: Patient }>('/api/ai/sentiment-analysis', {
      method: 'POST',
      body: JSON.stringify({ patientId }),
    });
  },

  // 6. Agendamentos
  async getAppointments(params?: { patientId?: string; date?: string }) {
    const query = new URLSearchParams();
    if (params?.patientId) query.set('patientId', params.patientId);
    if (params?.date) query.set('date', params.date);
    return authFetch<{ appointments: Appointment[] }>(`/api/appointments?${query.toString()}`);
  },

  async createAppointment(appointmentData: Partial<Appointment>) {
    return authFetch<{ appointment: Appointment }>('/api/appointments', {
      method: 'POST',
      body: JSON.stringify(appointmentData),
    });
  },

  async updateAppointment(id: string, updates: Partial<Appointment>) {
    return authFetch<{ appointment: Appointment }>('/api/appointments', {
      method: 'PUT',
      body: JSON.stringify({ id, ...updates }),
    });
  },

  // 7. Regras de Prioridade (Manchester)
  async getPriorityRules() {
    return authFetch<{ rules: PriorityRule[] }>('/api/rules/priority');
  },

  async createPriorityRule(ruleData: Partial<PriorityRule>) {
    return authFetch<{ rule: PriorityRule }>('/api/rules/priority', {
      method: 'POST',
      body: JSON.stringify(ruleData),
    });
  },

  async updatePriorityRule(id: string, updates: Partial<PriorityRule>) {
    return authFetch<{ rule: PriorityRule }>('/api/rules/priority', {
      method: 'PUT',
      body: JSON.stringify({ id, ...updates }),
    });
  },

  // 8. Automações
  async getAutomationRules() {
    return authFetch<{ automations: AutomationRule[] }>('/api/rules/automation');
  },

  async createAutomationRule(automationData: Partial<AutomationRule>) {
    return authFetch<{ automation: AutomationRule }>('/api/rules/automation', {
      method: 'POST',
      body: JSON.stringify(automationData),
    });
  },

  async updateAutomationRule(id: string, updates: Partial<AutomationRule>) {
    return authFetch<{ automation: AutomationRule }>('/api/rules/automation', {
      method: 'PUT',
      body: JSON.stringify({ id, ...updates }),
    });
  },

  // 9. Integrações EHR / PEP
  async getEHRIntegrations() {
    return authFetch<{ integrations: EHRIntegration[] }>('/api/ehr');
  },

  async updateEHRIntegration(id: string, updates: Partial<EHRIntegration> & { apiKey?: string }) {
    return authFetch<{ integration: EHRIntegration }>('/api/ehr', {
      method: 'PUT',
      body: JSON.stringify({ id, ...updates }),
    });
  },

  async syncEHR(id: string) {
    return authFetch<{
      success: boolean;
      message: string;
      syncedAt: string;
      syncedEntitiesCount: { patients: number; appointments: number };
    }>('/api/ehr/sync', {
      method: 'POST',
      body: JSON.stringify({ id }),
    });
  },

  // 10. Auditoria LGPD
  async getAuditLogs(params?: { category?: string; search?: string }) {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.search) query.set('search', params.search);
    return authFetch<{ logs: AuditLog[] }>(`/api/audit-logs?${query.toString()}`);
  },

  async logAuditEvent(action: string, target: string, lgpdCategory: string, details?: any) {
    return authFetch<{ log: AuditLog }>('/api/audit-logs', {
      method: 'POST',
      body: JSON.stringify({ action, target, lgpdCategory, details }),
    });
  },

  // 11. Configurações da Clínica
  async getClinicSettings() {
    return authFetch<{
      settings: ClinicSettings;
      permissions: RolePermission[];
      users: User[];
    }>('/api/settings');
  },

  async saveClinicSettings(payload: Partial<ClinicSettings> & { rolePermissions?: any[] }) {
    return authFetch<{ success: boolean; settings: ClinicSettings }>('/api/settings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // 11.1 WhatsApp Web.js (Puppeteer Engine & LocalAuth)
  async getWhatsAppWebSession() {
    return authFetch<{
      session: {
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
      };
      library: {
        name: string;
        version: string;
        description: string;
        engine: string;
        supportedFeatures: string[];
      };
    }>('/api/settings/whatsapp-web-js');
  },

  async executeWhatsAppWebAction(action: 'start_client' | 'connect_no_qr' | 'direct_connect' | 'refresh_qr' | 'simulate_scan' | 'disconnect' | 'update_config' | 'test_send' | 'simulate_inbound', config?: any) {
    return authFetch<{
      success: boolean;
      message: string;
      session: any;
      details?: any;
    }>('/api/settings/whatsapp-web-js', {
      method: 'POST',
      body: JSON.stringify({ action, config }),
    });
  },

  // 12. Webhooks
  async getWebhooks() {
    return authFetch<{ webhooks: Webhook[]; logs: WebhookLog[] }>('/api/webhooks');
  },

  async createWebhook(webhookData: Partial<Webhook>) {
    return authFetch<{ webhook: Webhook }>('/api/webhooks', {
      method: 'POST',
      body: JSON.stringify(webhookData),
    });
  },

  async deleteWebhook(id: string) {
    return authFetch<{ success: boolean }>(`/api/webhooks?id=${id}`, {
      method: 'DELETE',
    });
  },

  async testWebhook(webhookId: string, event: string) {
    return authFetch<{ success: boolean; message: string; log: WebhookLog }>('/api/webhooks/test', {
      method: 'POST',
      body: JSON.stringify({ webhookId, event }),
    });
  },

  // 13. Assinatura & Billing
  async getSubscription() {
    return authFetch<{ subscription: Subscription; usageRecords: UsageRecord[] }>('/api/subscriptions');
  },

  async updateSubscription(payload: Partial<Subscription>) {
    return authFetch<{ subscription: Subscription }>('/api/subscriptions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // 14. Conexão real com WhatsApp (lib/whatsapp/)
  async connectWhatsApp(options?: { authMethod?: 'qr' | 'phone_number'; phoneNumber?: string }) {
    return authFetch<{
      status: string;
      qrDataUrl?: string;
      pairingCode?: string;
      error?: string;
    }>('/api/settings/whatsapp-connection', {
      method: 'POST',
      body: options ? JSON.stringify(options) : undefined,
    });
  },

  async getWhatsAppConnectionStatus() {
    return authFetch<{
      status: string;
      authMethod?: 'qr' | 'phone_number';
      qrDataUrl?: string;
      pairingCode?: string;
      connectedNumber?: string;
      lastError?: string;
      historySyncResult?: { chatsScanned: number; chatsWithUnread: number; messagesImported: number };
      historySyncError?: string;
    }>('/api/settings/whatsapp-connection');
  },

  async disconnectWhatsApp() {
    return authFetch<{ status: string }>('/api/settings/whatsapp-connection', { method: 'DELETE' });
  },
};
