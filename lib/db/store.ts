import {
  Clinic,
  Subscription,
  UsageRecord,
  User,
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
  Role,
} from '../types';

export class MediFluxDatabaseStore {
  public clinics: Clinic[] = [];
  public subscriptions: Subscription[] = [];
  public usageRecords: UsageRecord[] = [];
  public users: User[] = [];
  public patients: Patient[] = [];
  public chatMessages: ChatMessage[] = [];
  public appointments: Appointment[] = [];
  public priorityRules: PriorityRule[] = [];
  public automationRules: AutomationRule[] = [];
  public ehrIntegrations: EHRIntegration[] = [];
  public auditLogs: AuditLog[] = [];
  public rolePermissions: RolePermission[] = [];
  public webhooks: Webhook[] = [];
  public webhookLogs: WebhookLog[] = [];
  public clinicSettings: ClinicSettings[] = [];

  constructor() {
    this.seed();
  }

  public seed() {
    // Correção de inconsistência de dados: este ID precisa bater com o
    // clinicId dos usuários de demonstração cadastrados no Firestore
    // (INITIAL_TEST_USERS em lib/db/firestore.ts, todos com
    // clinicId: 'clinic_cardiovida_01') — antes estava
    // 'clinic_jardins_01', então qualquer login com uma conta de
    // demonstração real (ex.: admin@cardiovida.com.br) via Firestore
    // nunca via nenhum dos pacientes/mensagens/logs de exemplo abaixo,
    // mesmo o isolamento por clínica funcionando corretamente — o nome
    // da clínica já estava certo ("Clínica CardioVida & Saúde
    // Integrada"), só o id estava desalinhado.
    const defaultClinicId = 'clinic_cardiovida_01';

    // 1. Clinics
    this.clinics = [
      {
        id: defaultClinicId,
        name: 'Clínica CardioVida & Saúde Integrada',
        unit: 'Unidade Jardins - São Paulo',
        cnpj: '18.234.567/0001-89',
        phone: '(11) 3456-7890',
        address: 'Alameda Santos, 1470 - Cerqueira César, São Paulo - SP',
      },
      {
        id: 'clinic_morumbi_02',
        name: 'MediFlux Prime Diagnósticos',
        unit: 'Unidade Morumbi',
        cnpj: '24.987.654/0001-12',
        phone: '(11) 4567-8901',
        address: 'Av. Giovanni Gronchi, 3200 - Morumbi, São Paulo - SP',
      },
    ];

    // 2. Subscriptions
    this.subscriptions = [
      {
        clinicId: defaultClinicId,
        basePlan: 'enterprise',
        addOns: {
          triagem_clinica: true,
          classificacao_automatica: true,
          qualificacao_lead: true,
          analise_sentimento: true,
        },
        billingStatus: 'ativo',
        maxAppointmentsPerMonth: 1000,
        currentPeriodAppointments: 342,
        aiCallsCount: 1280,
        nextBillingAt: '2026-09-01T00:00:00.000Z',
      },
      {
        clinicId: 'clinic_morumbi_02',
        basePlan: 'profissional',
        addOns: {
          triagem_clinica: true,
          classificacao_automatica: false,
          qualificacao_lead: false,
          analise_sentimento: false,
        },
        billingStatus: 'ativo',
        maxAppointmentsPerMonth: 500,
        currentPeriodAppointments: 180,
        aiCallsCount: 420,
        nextBillingAt: '2026-09-05T00:00:00.000Z',
      },
    ];

    // 3. Usage Records
    this.usageRecords = [
      {
        clinicId: defaultClinicId,
        periodKey: '2026-08',
        appointmentsCount: 342,
        aiCallsCount: 1280,
        overLimitFee: 0,
      },
      {
        clinicId: defaultClinicId,
        periodKey: '2026-07',
        appointmentsCount: 890,
        aiCallsCount: 2450,
        overLimitFee: 0,
      },
    ];

    // 4. Users (5 RBAC Roles)
    this.users = [
      {
        id: 'usr_admin_01',
        clinicId: defaultClinicId,
        name: 'Dr. Roberto Vasconcelos',
        email: 'admin@cardiovida.com.br',
        role: 'admin',
        crm: 'CRM/SP 142.890',
        specialty: 'Cardiologia e Gestão Médica',
        active: true,
      },
      {
        id: 'usr_recep_01',
        clinicId: defaultClinicId,
        name: 'Juliana Mendes',
        email: 'recepcao@cardiovida.com.br',
        role: 'recepcao',
        active: true,
      },
      {
        id: 'usr_med_01',
        clinicId: defaultClinicId,
        name: 'Dra. Camila Albuquerque',
        email: 'camila.med@cardiovida.com.br',
        role: 'medico',
        crm: 'CRM/SP 189.432',
        specialty: 'Cardiologia e Arritmias',
        active: true,
      },
      {
        id: 'usr_fin_01',
        clinicId: defaultClinicId,
        name: 'Carlos Eduardo Peixoto',
        email: 'financeiro@cardiovida.com.br',
        role: 'financeiro',
        active: true,
      },
      {
        id: 'usr_terc_01',
        clinicId: defaultClinicId,
        name: 'Lucas Ferreira (Atendimento Noturno)',
        email: 'terceirizado@suportesaude.com.br',
        role: 'terceirizado',
        active: true,
      },
    ];

    // 5. Patients — dados fictícios de demonstração removidos a pedido
    // do usuário. A clínica inicia sem pacientes de exemplo; os
    // registros reais devem vir do cadastro/integração com o EHR.
    this.patients = [];

    // 6. Chat Messages — sem conversas de exemplo, já que não há mais
    // pacientes fictícios para vinculá-las.
    this.chatMessages = [];

    // 7. Appointments — sem agendamentos de exemplo, pelo mesmo motivo.
    this.appointments = [];

    // 8. Priority Rules (Manchester SLA)
    this.priorityRules = [
      {
        id: 'rule_01',
        clinicId: defaultClinicId,
        name: 'Emergência Vermelha - Imediato',
        slaMinutes: 0,
        condition: 'urgency == "critica"',
        manchesterColor: 'vermelho',
        enabled: true,
      },
      {
        id: 'rule_02',
        clinicId: defaultClinicId,
        name: 'Muito Urgente Laranja - 10 min',
        slaMinutes: 10,
        condition: 'urgency == "alta"',
        manchesterColor: 'laranja',
        enabled: true,
      },
      {
        id: 'rule_03',
        clinicId: defaultClinicId,
        name: 'Urgente Amarelo - 60 min',
        slaMinutes: 60,
        condition: 'urgency == "media"',
        manchesterColor: 'amarelo',
        enabled: true,
      },
      {
        id: 'rule_04',
        clinicId: defaultClinicId,
        name: 'Pouco Urgente Verde - 120 min',
        slaMinutes: 120,
        condition: 'urgency == "baixa"',
        manchesterColor: 'verde',
        enabled: true,
      },
    ];

    // 9. Automation Rules
    this.automationRules = [
      {
        id: 'auto_01',
        clinicId: defaultClinicId,
        name: 'Alerta de Triagem Crítica para Plantonista',
        trigger: 'triage.urgency == "critica"',
        actions: ['Disparar SMS e WhatsApp para celular do médico de plantão', 'Emitir sinal sonoro no painel'],
        active: true,
        successRate: 99.4,
        executionCount: 142,
      },
      {
        id: 'auto_02',
        clinicId: defaultClinicId,
        name: 'Lembrete de Confirmação 24h Antes',
        trigger: 'appointment.hours_until == 24',
        actions: ['Enviar mensagem WhatsApp com botões de confirmação Sim/Não'],
        active: true,
        successRate: 96.8,
        executionCount: 890,
      },
      {
        id: 'auto_03',
        clinicId: defaultClinicId,
        name: 'Resgate de Paciente sem Resposta > 15min',
        trigger: 'chat.unanswered_minutes > 15 && stage == "em_triagem"',
        actions: ['Transferir para fila prioritária da Recepção', 'Atribuir tag #AtrasoSLA'],
        active: true,
        successRate: 98.1,
        executionCount: 312,
      },
    ];

    // 10. EHR Integrations (4 Systems)
    this.ehrIntegrations = [
      {
        id: 'ehr_01',
        clinicId: defaultClinicId,
        provider: 'iClinic',
        endpoint: 'https://api.iclinic.com.br/v2/integration',
        maskedKey: '••••••••••••7F92',
        syncDirection: 'bi-directional',
        syncFrequency: 'realtime',
        syncEntities: ['patients', 'appointments', 'prescriptions'],
        lastSyncAt: '2026-08-20T09:25:00.000Z',
        status: 'connected',
      },
      {
        id: 'ehr_02',
        clinicId: defaultClinicId,
        provider: 'TOTVS',
        endpoint: 'https://saude.totvs.com.br/api/tiss/v4',
        maskedKey: '••••••••••••B411',
        syncDirection: 'bi-directional',
        syncFrequency: '5min',
        syncEntities: ['patients', 'appointments', 'guias_tiss'],
        tissConfig: {
          ansCode: '394821',
          tussTableVersion: '2026.02',
          enableAutomaticGuias: true,
        },
        lastSyncAt: '2026-08-20T09:20:00.000Z',
        status: 'connected',
      },
      {
        id: 'ehr_03',
        clinicId: defaultClinicId,
        provider: 'HiDoctor',
        endpoint: 'https://api.hidoctor.com.br/sync',
        maskedKey: '••••••••••••A990',
        syncDirection: 'outbound',
        syncFrequency: 'hourly',
        syncEntities: ['patients', 'appointments'],
        status: 'unconfigured',
      },
      {
        id: 'ehr_04',
        clinicId: defaultClinicId,
        provider: 'Feegow',
        endpoint: 'https://api.feegow.com/v1',
        maskedKey: '••••••••••••C322',
        syncDirection: 'inbound',
        syncFrequency: 'daily',
        syncEntities: ['patients'],
        status: 'unconfigured',
      },
    ];

    // 11. Audit Logs (Immutable) — mantido só o evento genérico de
    // login; as entradas que citavam pacientes fictícios pelo nome
    // (triagem/atualização de cadastro) foram removidas junto com os
    // pacientes de exemplo.
    this.auditLogs = [
      {
        id: 'aud_01',
        clinicId: defaultClinicId,
        action: 'LOGIN_SUCESSO',
        target: 'Sessão JWT iniciada',
        authorEmail: 'admin@cardiovida.com.br',
        authorRole: 'admin',
        ip: '189.40.122.18',
        timestamp: '2026-08-20T08:00:15.000Z',
        lgpdCategory: 'login',
      },
    ];

    // 12. Role Permissions Matrix (2-layer RBAC)
    this.rolePermissions = [
      {
        clinicId: defaultClinicId,
        role: 'admin',
        permittedTabs: [
          'visao_geral',
          'atendimentos',
          'jornadas',
          'pendencias',
          'automacoes',
          'indicadores',
          'configuracoes',
          'auditoria_lgpd',
          'analise_inteligente',
        ],
        grantedActions: [
          'excluir_paciente',
          'unificar_duplicados',
          'exportar_dados_lgpd',
          'alterar_permissoes',
          'configurar_integracoes_pep',
          'gerenciar_cobranca',
          'disparar_webhooks_teste',
          'visualizar_prontuario_sensivel',
        ],
      },
      {
        clinicId: defaultClinicId,
        role: 'recepcao',
        permittedTabs: ['atendimentos', 'jornadas', 'pendencias'],
        grantedActions: ['visualizar_prontuario_sensivel'],
      },
      {
        clinicId: defaultClinicId,
        role: 'financeiro',
        permittedTabs: ['visao_geral', 'pendencias', 'indicadores'],
        grantedActions: ['gerenciar_cobranca'],
      },
      {
        clinicId: defaultClinicId,
        role: 'terceirizado',
        permittedTabs: ['pendencias'],
        grantedActions: [],
      },
      {
        clinicId: defaultClinicId,
        role: 'medico',
        permittedTabs: ['visao_geral', 'atendimentos', 'jornadas', 'pendencias', 'auditoria_lgpd', 'analise_inteligente'],
        grantedActions: ['visualizar_prontuario_sensivel', 'exportar_dados_lgpd'],
      },
    ];

    // 13. Webhooks
    this.webhooks = [
      {
        id: 'wh_01',
        clinicId: defaultClinicId,
        name: 'Webhook Notificação Hospital Central',
        url: 'https://hospitalcentral.med.br/api/incoming/mediflux',
        secret: 'whsec_9938218a09f8c12b',
        active: true,
        events: ['triage.critical', 'patient.created', 'appointment.scheduled'],
        createdAt: '2026-05-10T10:00:00.000Z',
      },
    ];

    // 14. Webhook Logs — resumo genérico, sem citar paciente fictício.
    this.webhookLogs = [
      {
        id: 'whlog_01',
        clinicId: defaultClinicId,
        webhookId: 'wh_01',
        event: 'triage.critical',
        statusCode: 200,
        responseTime: 184,
        timestamp: '2026-08-20T09:30:15.000Z',
        payloadSummary: 'Disparo de alerta vermelho de triagem crítica',
      },
    ];

    // 15. Clinic Settings (10 areas)
    this.clinicSettings = [
      {
        clinicId: defaultClinicId,
        quickResponses: [
          {
            id: 'qr_01',
            shortcut: '/boasvindas',
            title: 'Boas-vindas Padrão',
            text: 'Olá {{patient_name}}! Seja bem-vindo(a) à {{clinic_name}}. Como podemos cuidar da sua saúde hoje?',
            category: 'Geral',
          },
          {
            id: 'qr_02',
            shortcut: '/confirmacao',
            title: 'Confirmação de Consulta',
            text: 'Olá {{patient_name}}, confirmamos sua consulta com {{doctor_name}} para o dia {{appointment_date}} às {{appointment_time}} na {{clinic_unit}}.',
            category: 'Agendamento',
          },
          {
            id: 'qr_03',
            shortcut: '/preparo',
            title: 'Instruções de Exame e Jejum',
            text: 'Olá {{patient_name}}! Para a realização do seu exame de sangue e glicemia, solicitamos jejum prévio de 8 a 12 horas. Água pode ser consumida normalmente.',
            category: 'Exames',
          },
          {
            id: 'qr_04',
            shortcut: '/triagem_encaminhar',
            title: 'Encaminhamento Pronto Atendimento',
            text: '{{patient_name}}, devido aos sintomas descritos, orientamos que procure nossa unidade ou o pronto-socorro mais próximo imediatamente.',
            category: 'Emergência',
          },
        ],
        draftsPolicy: {
          autoSaveSeconds: 3,
          offlineCacheRetentionDays: 7,
          enableLocalEncryptedDrafts: true,
        },
        whatsappAlerts: {
          dutyPhones: ['+5511999990001', '+5511999990002'],
          slaBreachDispatches: true,
          criticalTriageAlerts: true,
        },
        globalNotifications: {
          enableSound: true,
          enablePopups: true,
          manchesterSoundRule: 'vermelho_laranja',
        },
        channels: {
          whatsapp: { enabled: true, number: '+55 11 98877-6655', businessHours: 'Seg-Sex 07h-20h / Sáb 08h-14h' },
          telegram: { enabled: true, botHandle: '@CardioVidaBot', businessHours: '24/7 Triagem Automática' },
          instagram: { enabled: true, profile: '@cardiovida.oficial', businessHours: 'Seg-Sex 08h-18h' },
          site: { enabled: true, widgetColor: '#0ea5e9', businessHours: '24/7 Atendimento Online' },
        },
        funnels: [
          {
            id: 'funnel_principal',
            name: 'Jornada de Atendimento Clínico',
            isDefault: true,
            stages: [
              {
                id: 'novo',
                name: 'Novo Contato',
                color: 'bg-slate-100 text-slate-700 border-slate-300',
                order: 1,
                requiredFields: ['name', 'phone'],
                lockAdvanceWithoutRequiredFields: false,
              },
              {
                id: 'em_triagem',
                name: 'Em Triagem Clínica',
                color: 'bg-amber-50 text-amber-800 border-amber-300',
                order: 2,
                requiredFields: ['name', 'phone', 'specialty'],
                lockAdvanceWithoutRequiredFields: true,
              },
              {
                id: 'aguardando_medico',
                name: 'Aguardando Médico / Encaixe',
                color: 'bg-orange-50 text-orange-800 border-orange-300',
                order: 3,
                requiredFields: ['cpf', 'healthInsurance', 'planNumber'],
                lockAdvanceWithoutRequiredFields: true,
              },
              {
                id: 'agendado',
                name: 'Consulta Agendada',
                color: 'bg-blue-50 text-blue-800 border-blue-300',
                order: 4,
                requiredFields: ['cpf', 'healthInsurance'],
                lockAdvanceWithoutRequiredFields: false,
              },
              {
                id: 'concluido',
                name: 'Atendimento Concluído',
                color: 'bg-emerald-50 text-emerald-800 border-emerald-300',
                order: 5,
                requiredFields: [],
                lockAdvanceWithoutRequiredFields: false,
              },
            ],
          },
        ],
      },
    ];
  }

  // Helper anti-IDOR: Busca e valida isolamento por clinicId
  public getPatientById(patientId: string, clinicId: string): Patient | null {
    const patient = this.patients.find((p) => p.id === patientId && p.clinicId === clinicId);
    return patient || null;
  }

  public getSettings(clinicId: string): ClinicSettings {
    let settings = this.clinicSettings.find((s) => s.clinicId === clinicId);
    if (!settings) {
      settings = {
        clinicId,
        quickResponses: [],
        draftsPolicy: { autoSaveSeconds: 3, offlineCacheRetentionDays: 7, enableLocalEncryptedDrafts: true },
        whatsappAlerts: { dutyPhones: [], slaBreachDispatches: true, criticalTriageAlerts: true },
        globalNotifications: { enableSound: true, enablePopups: true, manchesterSoundRule: 'vermelho_laranja' },
        channels: {
          whatsapp: { enabled: true, number: '', businessHours: '08h-18h' },
          telegram: { enabled: false, botHandle: '', businessHours: '08h-18h' },
          instagram: { enabled: false, profile: '', businessHours: '08h-18h' },
          site: { enabled: true, widgetColor: '#0ea5e9', businessHours: '24/7' },
        },
        funnels: [],
      };
      this.clinicSettings.push(settings);
    }
    return settings;
  }

  public getSubscription(clinicId: string): Subscription {
    let sub = this.subscriptions.find((s) => s.clinicId === clinicId);
    if (!sub) {
      const isTrial = clinicId.includes('trial');
      sub = {
        clinicId,
        basePlan: 'enterprise',
        addOns: {
          triagem_clinica: true,
          classificacao_automatica: true,
          qualificacao_lead: true,
          analise_sentimento: true,
        },
        billingStatus: isTrial ? 'em_trial' : 'ativo',
        maxAppointmentsPerMonth: 1000,
        currentPeriodAppointments: 0,
        aiCallsCount: 0,
        trialEndsAt: isTrial ? new Date(Date.now() + 7 * 86400000).toISOString() : undefined,
        nextBillingAt: new Date(Date.now() + (isTrial ? 7 : 30) * 86400000).toISOString(),
      };
      this.subscriptions.push(sub);
    }
    return sub;
  }

  public findDuplicateCandidates(clinicId: string): DuplicateMatch[] {
    const clinicPatients = this.patients.filter((p) => p.clinicId === clinicId);
    const matches: DuplicateMatch[] = [];
    const processedPairs = new Set<string>();

    for (let i = 0; i < clinicPatients.length; i++) {
      for (let j = i + 1; j < clinicPatients.length; j++) {
        const p1 = clinicPatients[i];
        const p2 = clinicPatients[j];
        const pairKey = [p1.id, p2.id].sort().join(':');

        if (processedPairs.has(pairKey)) continue;

        let confidence = 0;
        let matchReason: DuplicateMatch['matchReason'] = 'nome_similar';

        const cleanCpf1 = p1.cpf.replace(/\D/g, '');
        const cleanCpf2 = p2.cpf.replace(/\D/g, '');
        const cleanPhone1 = p1.phone.replace(/\D/g, '');
        const cleanPhone2 = p2.phone.replace(/\D/g, '');

        if (cleanCpf1 && cleanCpf2 && cleanCpf1 === cleanCpf2) {
          confidence += 80;
          matchReason = 'cpf_exato';
        }

        if (cleanPhone1 && cleanPhone2 && cleanPhone1 === cleanPhone2) {
          confidence += 50;
          if (confidence > 80) matchReason = 'multiplos_fatores';
          else matchReason = 'telefone_exato';
        }

        const nameSimilarity = calculateNameSimilarity(p1.name, p2.name);
        if (nameSimilarity > 0.75) {
          confidence += Math.round(nameSimilarity * 40);
          if (confidence > 80 && matchReason === 'nome_similar') {
            matchReason = 'nome_similar';
          }
        }

        if (confidence >= 60) {
          processedPairs.add(pairKey);
          matches.push({
            primaryPatient: p1,
            duplicateCandidate: p2,
            matchReason,
            confidenceScore: Math.min(confidence, 99),
          });
        }
      }
    }

    return matches;
  }

  public mergePatients(
    primaryId: string,
    secondaryId: string,
    clinicId: string,
    authorEmail: string,
    authorRole: Role
  ): { success: boolean; primaryPatient?: Patient; error?: string } {
    const primary = this.getPatientById(primaryId, clinicId);
    const secondary = this.getPatientById(secondaryId, clinicId);

    if (!primary || !secondary) {
      return { success: false, error: 'Registro não encontrado' };
    }

    // Mescla dados não preenchidos do secundário no primário
    if (!primary.cpf && secondary.cpf) primary.cpf = secondary.cpf;
    if (!primary.birthDate && secondary.birthDate) primary.birthDate = secondary.birthDate;
    if (!primary.healthInsurance && secondary.healthInsurance) primary.healthInsurance = secondary.healthInsurance;
    if (!primary.planNumber && secondary.planNumber) primary.planNumber = secondary.planNumber;
    if (!primary.notes) primary.notes = secondary.notes;
    else if (secondary.notes && !primary.notes.includes(secondary.notes)) {
      primary.notes += `\n[Histórico mesclado]: ${secondary.notes}`;
    }

    // Mescla tags
    const combinedTags = Array.from(new Set([...primary.tags, ...secondary.tags]));
    primary.tags = combinedTags;

    // Redireciona mensagens do chat para o paciente principal
    this.chatMessages.forEach((msg) => {
      if (msg.patientId === secondaryId && msg.clinicId === clinicId) {
        msg.patientId = primaryId;
      }
    });

    // Redireciona agendamentos
    this.appointments.forEach((apt) => {
      if (apt.patientId === secondaryId && apt.clinicId === clinicId) {
        apt.patientId = primaryId;
        apt.patientName = primary.name;
      }
    });

    // Exclui o secundário
    this.patients = this.patients.filter((p) => p.id !== secondaryId);

    // Registra log imutável de auditoria
    this.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      clinicId,
      action: 'UNIFICACAO_PACIENTES_DUPLICADOS',
      target: `Primário: ${primary.id} (${primary.name}) | Excluído: ${secondary.id} (${secondary.name})`,
      authorEmail,
      authorRole,
      ip: '127.0.0.1',
      timestamp: new Date().toISOString(),
      details: { primaryId, secondaryId, primaryName: primary.name },
      lgpdCategory: 'unificacao',
    });

    return { success: true, primaryPatient: primary };
  }
}

function calculateNameSimilarity(a: string, b: string): number {
  const normA = a.toLowerCase().trim().replace(/\s+/g, ' ');
  const normB = b.toLowerCase().trim().replace(/\s+/g, ' ');
  if (normA === normB) return 1.0;

  const wordsA = normA.split(' ');
  const wordsB = normB.split(' ');
  let common = 0;

  for (const w of wordsA) {
    if (w.length > 2 && wordsB.includes(w)) common++;
  }

  const maxWords = Math.max(wordsA.length, wordsB.length);
  return maxWords > 0 ? common / maxWords : 0;
}

// Instância Singleton do banco de dados na memória do servidor
declare global {
  var __mediflux_db__: MediFluxDatabaseStore | undefined;
}

export function getDatabase(): MediFluxDatabaseStore {
  if (!global.__mediflux_db__) {
    global.__mediflux_db__ = new MediFluxDatabaseStore();
  }
  return global.__mediflux_db__;
}
