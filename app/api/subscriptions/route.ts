import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/store';
import { authenticateRequest, checkActionPermission } from '@/lib/server/authHelper';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  const db = getDatabase();
  const sub = db.getSubscription(auth.user.clinicId);
  const usageRecords = db.usageRecords.filter((u) => u.clinicId === auth.user!.clinicId);

  return NextResponse.json({
    subscription: sub,
    usageRecords,
  });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  const canManageBilling =
    auth.user.role === 'admin' ||
    auth.user.role === 'financeiro' ||
    checkActionPermission(auth.user.clinicId, auth.user.role, 'gerenciar_cobranca');

  if (!canManageBilling) {
    return NextResponse.json(
      { error: 'Permissão insuficiente para gerenciar cobrança e add-ons.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { addOns, billingStatus, basePlan } = body;

    const db = getDatabase();
    const sub = db.getSubscription(auth.user.clinicId);

    if (addOns) sub.addOns = { ...sub.addOns, ...addOns };
    if (billingStatus) sub.billingStatus = billingStatus;
    if (basePlan) sub.basePlan = basePlan;

    db.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      clinicId: auth.user.clinicId,
      action: 'ALTERACAO_PLANO_OU_ADDONS',
      target: `Plano: ${sub.basePlan} | Status: ${sub.billingStatus}`,
      authorEmail: auth.user.email,
      authorRole: auth.user.role,
      ip: req.headers.get('x-forwarded-for') || '127.0.0.1',
      timestamp: new Date().toISOString(),
      details: { addOns: sub.addOns, billingStatus: sub.billingStatus },
      lgpdCategory: 'alteracao_cadastral',
    });

    return NextResponse.json({ subscription: sub });
  } catch (err) {
    console.error('Erro ao atualizar assinatura:', err);
    return NextResponse.json({ error: 'Falha ao atualizar plano.' }, { status: 500 });
  }
}
