import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/store';
import { signToken } from '@/lib/security/jwt';
import { validateFirestoreLogin } from '@/lib/db/firestore';
import { createFirebaseCustomToken } from '@/lib/security/firebaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    const normalizedEmail = (email || '').toLowerCase().trim();

    if (!normalizedEmail) {
      return NextResponse.json(
        { error: 'Por favor, informe seu e-mail de acesso.' },
        { status: 400 }
      );
    }

    if (password === undefined || password === null || (typeof password === 'string' && !password.trim())) {
      return NextResponse.json(
        { error: 'Por favor, informe sua senha de acesso.' },
        { status: 400 }
      );
    }

    // 1. VALIDAÇÃO OBRIGATÓRIA NO BANCO DE DADOS FIRESTORE
    const firestoreAuth = await validateFirestoreLogin(normalizedEmail, password);

    if (!firestoreAuth.success || !firestoreAuth.user) {
      // Registra tentativa com falha no log de auditoria
      const db = getDatabase();
      db.auditLogs.unshift({
        id: `aud_fail_${Date.now()}`,
        clinicId: 'unknown',
        action: 'LOGIN_FALHA_FIRESTORE',
        target: `Tentativa de login não autorizada (${firestoreAuth.errorCode || 'NAO_CADASTRADO'}): ${normalizedEmail}`,
        authorEmail: normalizedEmail,
        authorRole: 'terceirizado',
        ip: req.headers.get('x-forwarded-for') || '127.0.0.1',
        timestamp: new Date().toISOString(),
        lgpdCategory: 'login',
      });

      const httpStatus = firestoreAuth.errorCode === 'TRIAL_EXPIRED' ? 403 : 401;

      return NextResponse.json(
        {
          error: firestoreAuth.message,
          errorCode: firestoreAuth.errorCode || 'USER_NOT_REGISTERED_IN_FIRESTORE',
          trialStatus: (firestoreAuth as any).trialStatus,
          firestoreValidated: false,
        },
        { status: httpStatus }
      );
    }

    const firestoreUser = firestoreAuth.user;
    const db = getDatabase();

    // 2. Localiza ou sincroniza a clínica no store local
    let clinic = db.clinics.find((c) => c.id === firestoreUser.clinicId);
    if (!clinic) {
      const isTrial = firestoreUser.clinicId.includes('trial');
      clinic = {
        id: firestoreUser.clinicId,
        name: isTrial ? 'Clínica MediFlux & CardioVida (Trial 7 Dias)' : 'CardioVida Centro Integrado de Cardiologia',
        unit: isTrial ? 'Unidade Prime (Ambiente de Teste Ativo)' : 'Unidade Jardins - SP',
        cnpj: isTrial ? '45.981.234/0001-88' : '12.345.678/0001-90',
        phone: isTrial ? '(11) 98765-4321' : '(11) 3088-9000',
        address: isTrial ? 'Av. Paulista, 2100 - Bela Vista, São Paulo/SP' : 'Av. Brigadeiro Luís Antônio, 4500 - Jardins, São Paulo/SP',
      };
      db.clinics.push(clinic);
    }

    // 3. Localiza ou inicializa a assinatura
    const subscription = db.getSubscription(firestoreUser.clinicId);
    const trialStatus = (firestoreAuth as any).trialStatus;
    if (trialStatus && trialStatus.isTrial) {
      subscription.billingStatus = 'em_trial';
      subscription.trialEndsAt = trialStatus.trialEndsAt;
      subscription.trialInfo = trialStatus;
    }

    // 4. Localiza ou cria permissões RBAC
    let rolePermission = db.rolePermissions.find(
      (rp) => rp.clinicId === firestoreUser.clinicId && rp.role === firestoreUser.role
    );

    if (!rolePermission) {
      rolePermission = {
        clinicId: firestoreUser.clinicId,
        role: firestoreUser.role,
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
        grantedActions: ['exportar_dados_lgpd', 'visualizar_prontuario_sensivel'],
      };
      db.rolePermissions.push(rolePermission);
    }

    // 5. Gera token JWT assinado com metadados do Firestore
    const token = await signToken({
      id: firestoreUser.id,
      email: firestoreUser.email,
      role: firestoreUser.role,
      clinicId: firestoreUser.clinicId,
      name: firestoreUser.name,
    });

    // 5.1 Integração de Firebase Authentication (correção de auditoria
    // #4 — regras do Firestore): gera um custom token do Firebase para
    // este usuário, agora que a senha já foi validada por
    // verifyPassword() acima. O front-end troca esse token por uma
    // sessão real do Firebase via signInWithCustomToken(), o que
    // preenche request.auth nas firestore.rules — sem isso, as regras
    // nunca conseguem diferenciar um usuário autenticado de um
    // anônimo. "Melhor esforço": se a Service Account não estiver
    // configurada neste ambiente, firebaseToken vem null e o login
    // pelo JWT próprio continua funcionando normalmente — só a proteção
    // extra do Firestore fica indisponível até a Service Account ser
    // configurada.
    const firebaseToken = await createFirebaseCustomToken(firestoreUser.id, firestoreUser.clinicId);

    // 6. Registra log imutável de auditoria LGPD
    db.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      clinicId: firestoreUser.clinicId,
      action: 'LOGIN_SUCESSO_FIRESTORE',
      target: `Sessão autenticada via Google Cloud Firestore (${firestoreUser.role.toUpperCase()})`,
      authorEmail: firestoreUser.email,
      authorRole: firestoreUser.role,
      ip: req.headers.get('x-forwarded-for') || '127.0.0.1',
      timestamp: new Date().toISOString(),
      lgpdCategory: 'login',
    });

    const safeUser = {
      id: firestoreUser.id,
      clinicId: firestoreUser.clinicId,
      name: firestoreUser.name,
      email: firestoreUser.email,
      role: firestoreUser.role,
      crm: firestoreUser.crm,
      specialty: firestoreUser.specialty,
      active: firestoreUser.active,
      authSource: 'firestore',
    };

    return NextResponse.json({
      token,
      firebaseToken,
      user: safeUser,
      clinic,
      subscription,
      permissions: rolePermission,
      firestoreValidated: true,
      authMessage: firestoreAuth.message,
    });
  } catch (err: any) {
    console.error('Erro na rota de login com Firestore:', err);
    return NextResponse.json(
      { error: 'Falha no processamento da autenticação via Firestore: ' + (err.message || '') },
      { status: 500 }
    );
  }
}
