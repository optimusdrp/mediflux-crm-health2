import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/store';
import { signToken } from '@/lib/security/jwt';
import { User, Clinic, Subscription, RolePermission } from '@/lib/types';
import { registerTrialFirestoreUser } from '@/lib/db/firestore';
import { createFirebaseCustomToken } from '@/lib/security/firebaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      email,
      phone,
      clinicName,
      specialty,
      teamSize,
      password,
      acceptTerms,
    } = body;

    if (!name || !email || !clinicName) {
      return NextResponse.json(
        { error: 'Por favor, preencha os campos obrigatórios: Nome, E-mail e Nome da Clínica.' },
        { status: 400 }
      );
    }

    if (!acceptTerms) {
      return NextResponse.json(
        { error: 'É necessário concordar com os Termos de Uso e Política de Privacidade (LGPD).' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Cadastra no Firestore
    const firestoreResult = await registerTrialFirestoreUser({
      name: name.trim(),
      email: normalizedEmail,
      clinicName: clinicName.trim(),
      phone,
      specialty,
      password,
    });

    if (!firestoreResult.success || !firestoreResult.user) {
      return NextResponse.json(
        { error: firestoreResult.message || 'Falha ao salvar no Firestore.' },
        { status: 500 }
      );
    }

    const firestoreUser = firestoreResult.user;
    const newClinicId = firestoreResult.clinicId || `clinic_trial_${Date.now()}`;
    const timestamp = Date.now();

    // 2. Sincroniza clínica no store
    const newClinic: Clinic = {
      id: newClinicId,
      name: clinicName.trim(),
      unit: 'Unidade Principal (Trial 7 Dias)',
      cnpj: 'Pendente (Trial 7 Dias)',
      phone: phone || '(11) 99999-0000',
      address: 'Ambiente Cloud Firestore Dedicado',
    };
    db.clinics.push(newClinic);

    // 3. Assinatura Trial de 7 dias com acesso Enterprise
    const trialExpiration = new Date(timestamp + 7 * 24 * 60 * 60 * 1000).toISOString();
    const newSubscription: Subscription = {
      clinicId: newClinicId,
      basePlan: 'enterprise',
      addOns: {
        triagem_clinica: true,
        classificacao_automatica: true,
        qualificacao_lead: true,
        analise_sentimento: true,
      },
      billingStatus: 'em_trial',
      maxAppointmentsPerMonth: 1000,
      currentPeriodAppointments: 0,
      aiCallsCount: 0,
      nextBillingAt: trialExpiration,
      trialEndsAt: trialExpiration,
    };
    db.subscriptions.push(newSubscription);

    // 4. Usuário no Store Local
    const newUser: User = {
      id: firestoreUser.id,
      clinicId: newClinicId,
      name: name.trim(),
      email: normalizedEmail,
      role: 'admin',
      specialty: specialty || 'Gestão Clínica e Atendimento',
      crm: specialty ? `CRM/SP ${Math.floor(100000 + Math.random() * 900000)}` : undefined,
      active: true,
    };
    db.users.push(newUser);

    // 5. Permissões RBAC
    const newRolePermission: RolePermission = {
      clinicId: newClinicId,
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
    };
    db.rolePermissions.push(newRolePermission);

    // 6. Token JWT assinado
    const token = await signToken({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      clinicId: newUser.clinicId,
      name: newUser.name,
    });

    // 6.1 Integração de Firebase Authentication (correção de auditoria
    // #4) — ver o mesmo passo em app/api/auth/login/route.ts para a
    // explicação completa.
    const firebaseToken = await createFirebaseCustomToken(newUser.id, newClinicId);

    // 7. Auditoria LGPD
    db.auditLogs.unshift({
      id: `aud_trial_${timestamp}`,
      clinicId: newClinicId,
      action: 'TRIAL_CRIADO_FIRESTORE_7_DIAS',
      target: `Conta Trial cadastrada no Firestore: ${clinicName} (${teamSize || '1-5'} atendentes)`,
      authorEmail: newUser.email,
      authorRole: newUser.role,
      ip: req.headers.get('x-forwarded-for') || '127.0.0.1',
      timestamp: new Date().toISOString(),
      lgpdCategory: 'consentimento',
    });

    // Correção de inconsistência: as demais rotas de autenticação
    // (login, me) constroem um objeto "seguro" explícito antes de
    // devolver ao cliente, campo a campo, em vez de expor o registro
    // interno inteiro — mais robusto a longo prazo, porque um campo
    // sensível adicionado no futuro ao tipo User não vazaria por
    // engano nesta rota específica. O tipo User atual não tem nenhum
    // campo sensível hoje (não é o mesmo objeto que carrega
    // passwordHash/passwordSalt — esses só existem em
    // FirestoreUserRecord, interno a lib/db/firestore.ts), então isto
    // não corrige um vazamento ativo, só alinha o padrão.
    const safeUser = {
      id: newUser.id,
      clinicId: newUser.clinicId,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      crm: newUser.crm,
      specialty: newUser.specialty,
      active: newUser.active,
    };

    return NextResponse.json({
      token,
      firebaseToken,
      user: safeUser,
      clinic: newClinic,
      subscription: newSubscription,
      permissions: newRolePermission,
      trialDaysRemaining: 7,
      trialExpiresAt: trialExpiration,
      firestoreValidated: true,
      message: 'Cadastro de teste de 7 dias realizado e persistido com sucesso no Firestore!',
    });
  } catch (err: any) {
    console.error('Erro no cadastro trial com Firestore:', err);
    return NextResponse.json(
      { error: 'Falha ao processar o cadastro no Firestore: ' + (err.message || '') },
      { status: 500 }
    );
  }
}
