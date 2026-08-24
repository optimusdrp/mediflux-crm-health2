import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/store';
import { authenticateRequest, checkActionPermission } from '@/lib/server/authHelper';
import { EHRIntegration } from '@/lib/types';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  const db = getDatabase();
  const integrations = db.ehrIntegrations
    .filter((e) => e.clinicId === auth.user!.clinicId)
    .map((e) => ({
      ...e,
      // Garante que o segredo bruto nunca vaze para o frontend
      rawKey: undefined,
    }));

  return NextResponse.json({ integrations });
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  const canConfigure =
    auth.user.role === 'admin' ||
    checkActionPermission(auth.user.clinicId, auth.user.role, 'configurar_integracoes_pep');

  if (!canConfigure) {
    return NextResponse.json(
      { error: 'Permissão insuficiente para alterar integrações de Prontuário Eletrônico (PEP).' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { id, endpoint, apiKey, syncDirection, syncFrequency, syncEntities, tissConfig } = body;

    const db = getDatabase();
    const ehr = db.ehrIntegrations.find((e) => e.id === id && e.clinicId === auth.user!.clinicId);

    if (!ehr) {
      return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });
    }

    if (endpoint) ehr.endpoint = endpoint;
    if (syncDirection) ehr.syncDirection = syncDirection;
    if (syncFrequency) ehr.syncFrequency = syncFrequency;
    if (syncEntities) ehr.syncEntities = syncEntities;
    if (tissConfig) ehr.tissConfig = tissConfig;

    if (apiKey && apiKey.trim() !== '' && !apiKey.startsWith('•••')) {
      const lastFour = apiKey.slice(-4);
      ehr.maskedKey = `••••••••••••${lastFour}`;
      ehr.rawKey = apiKey;
      ehr.status = 'connected';
    }

    db.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      clinicId: auth.user.clinicId,
      action: 'ATUALIZACAO_INTEGRACAO_EHR',
      target: `Provedor: ${ehr.provider}`,
      authorEmail: auth.user.email,
      authorRole: auth.user.role,
      ip: req.headers.get('x-forwarded-for') || '127.0.0.1',
      timestamp: new Date().toISOString(),
      details: { provider: ehr.provider, status: ehr.status },
      lgpdCategory: 'acesso_dados',
    });

    return NextResponse.json({
      integration: {
        ...ehr,
        rawKey: undefined,
      },
    });
  } catch (err) {
    console.error('Erro ao atualizar EHR:', err);
    return NextResponse.json({ error: 'Falha ao salvar configuração EHR.' }, { status: 500 });
  }
}
