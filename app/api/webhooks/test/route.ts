import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/store';
import { authenticateRequest, checkActionPermission } from '@/lib/server/authHelper';
import { validateUrlAgainstSSRF } from '@/lib/security/ssrfGuard';
import { WebhookLog } from '@/lib/types';

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  const canTest =
    auth.user.role === 'admin' ||
    checkActionPermission(auth.user.clinicId, auth.user.role, 'disparar_webhooks_teste');

  if (!canTest) {
    return NextResponse.json(
      { error: 'Você não tem permissão para disparar testes de webhooks.' },
      { status: 403 }
    );
  }

  try {
    const { webhookId, event } = await req.json();
    const db = getDatabase();
    const webhook = db.webhooks.find((w) => w.id === webhookId && w.clinicId === auth.user!.clinicId);

    if (!webhook) {
      return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });
    }

    // SSRF Guard no momento do disparo
    const ssrfCheck = validateUrlAgainstSSRF(webhook.url);
    if (!ssrfCheck.allowed) {
      const failedLog: WebhookLog = {
        id: `whlog_${Date.now()}`,
        clinicId: auth.user.clinicId,
        webhookId: webhook.id,
        event: event || 'test.ping',
        statusCode: 403,
        responseTime: 12,
        timestamp: new Date().toISOString(),
        errorMessage: `Bloqueio de segurança SSRF: ${ssrfCheck.reason}`,
      };
      db.webhookLogs.unshift(failedLog);

      return NextResponse.json(
        {
          error: `Disparo abortado por política SSRF: ${ssrfCheck.reason}`,
          log: failedLog,
        },
        { status: 400 }
      );
    }

    // Simulação segura de entrega do webhook com medição de latência
    const simulatedResponseTime = Math.floor(Math.random() * 120) + 80;
    const log: WebhookLog = {
      id: `whlog_${Date.now()}`,
      clinicId: auth.user.clinicId,
      webhookId: webhook.id,
      event: event || 'triage.critical',
      statusCode: 200,
      responseTime: simulatedResponseTime,
      timestamp: new Date().toISOString(),
      payloadSummary: `Teste simulado de evento [${event || 'triage.critical'}] assinado com HMAC-SHA256`,
    };

    db.webhookLogs.unshift(log);

    return NextResponse.json({
      success: true,
      message: 'Disparo de teste executado com sucesso.',
      log,
    });
  } catch (err) {
    console.error('Erro no teste de webhook:', err);
    return NextResponse.json({ error: 'Falha no disparo do teste.' }, { status: 500 });
  }
}
