import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/store';
import { authenticateRequest, checkActionPermission } from '@/lib/server/authHelper';
import { validateUrlAgainstSSRF } from '@/lib/security/ssrfGuard';
import { Webhook } from '@/lib/types';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  const db = getDatabase();
  const webhooks = db.webhooks.filter((w) => w.clinicId === auth.user!.clinicId);
  const logs = db.webhookLogs.filter((l) => l.clinicId === auth.user!.clinicId);

  return NextResponse.json({ webhooks, logs });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  try {
    const body = await req.json();
    const { name, url, events, active } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL do Webhook é obrigatória.' }, { status: 400 });
    }

    // SSRF Guard no cadastro
    const ssrfCheck = validateUrlAgainstSSRF(url);
    if (!ssrfCheck.allowed) {
      return NextResponse.json(
        {
          error: `URL bloqueada por política de segurança SSRF: ${ssrfCheck.reason}`,
          blocked: true,
        },
        { status: 400 }
      );
    }

    const db = getDatabase();
    const newWebhook: Webhook = {
      id: `wh_${Date.now()}`,
      clinicId: auth.user.clinicId,
      name: name || 'Novo Endpoint Webhook',
      url,
      secret: `whsec_${Math.random().toString(36).substring(2, 18)}`,
      active: active !== undefined ? active : true,
      events: Array.isArray(events) ? events : ['triage.critical', 'patient.created'],
      createdAt: new Date().toISOString(),
    };

    db.webhooks.push(newWebhook);

    return NextResponse.json({ webhook: newWebhook });
  } catch (err) {
    console.error('Erro ao cadastrar webhook:', err);
    return NextResponse.json({ error: 'Falha ao salvar webhook.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID do webhook é obrigatório.' }, { status: 400 });
  }

  const db = getDatabase();
  db.webhooks = db.webhooks.filter((w) => !(w.id === id && w.clinicId === auth.user!.clinicId));

  return NextResponse.json({ success: true });
}
