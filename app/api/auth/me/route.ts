import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifyToken } from '@/lib/security/jwt';
import { getDatabase } from '@/lib/db/store';
import { validateFirestoreLogin } from '@/lib/db/firestore';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = extractBearerToken(authHeader);

    if (!token) {
      return NextResponse.json({ error: 'Nenhuma sessão ativa' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.email) {
      return NextResponse.json({ error: 'Sessão inválida ou expirada' }, { status: 401 });
    }

    // Valida se o usuário permanece ativo no Firestore
    const firestoreAuth = await validateFirestoreLogin(payload.email);
    if (!firestoreAuth.success || !firestoreAuth.user) {
      const httpStatus = firestoreAuth.errorCode === 'TRIAL_EXPIRED' ? 403 : 401;
      return NextResponse.json(
        {
          error: firestoreAuth.message || 'Usuário não encontrado ou inativo no banco Firestore',
          errorCode: firestoreAuth.errorCode || 'UNAUTHORIZED',
          trialStatus: (firestoreAuth as any).trialStatus,
        },
        { status: httpStatus }
      );
    }

    const firestoreUser = firestoreAuth.user;
    const db = getDatabase();

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

    const subscription = db.getSubscription(firestoreUser.clinicId);
    const trialStatus = (firestoreAuth as any).trialStatus;
    if (trialStatus && trialStatus.isTrial) {
      subscription.billingStatus = 'em_trial';
      subscription.trialEndsAt = trialStatus.trialEndsAt;
      subscription.trialInfo = trialStatus;
    }
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

    const safeUser = {
      id: firestoreUser.id,
      clinicId: firestoreUser.clinicId,
      name: firestoreUser.name,
      email: firestoreUser.email,
      role: firestoreUser.role,
      crm: firestoreUser.crm,
      specialty: firestoreUser.specialty,
      active: firestoreUser.active,
      authSource: 'firestore' as const,
    };

    return NextResponse.json({
      user: safeUser,
      clinic,
      subscription,
      permissions: rolePermission,
      firestoreValidated: true,
    });
  } catch (err: any) {
    console.error('Erro na validação do /api/auth/me:', err);
    return NextResponse.json(
      { error: 'Falha ao recuperar sessão: ' + (err.message || '') },
      { status: 500 }
    );
  }
}
