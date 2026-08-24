import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/store';
import { authenticateRequest } from '@/lib/server/authHelper';
import { PriorityRule } from '@/lib/types';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  const db = getDatabase();
  const rules = db.priorityRules.filter((r) => r.clinicId === auth.user!.clinicId);
  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  try {
    const body = await req.json();
    const { name, slaMinutes, condition, manchesterColor, enabled } = body;

    const db = getDatabase();
    const newRule: PriorityRule = {
      id: `rule_${Date.now()}`,
      clinicId: auth.user.clinicId,
      name: name || 'Nova Regra SLA',
      slaMinutes: Number(slaMinutes) || 30,
      condition: condition || 'urgency == "media"',
      manchesterColor: manchesterColor || 'amarelo',
      enabled: enabled !== undefined ? enabled : true,
    };

    db.priorityRules.push(newRule);
    return NextResponse.json({ rule: newRule });
  } catch (err) {
    console.error('Erro ao criar regra de prioridade:', err);
    return NextResponse.json({ error: 'Falha ao salvar regra.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    const db = getDatabase();
    const rule = db.priorityRules.find((r) => r.id === id && r.clinicId === auth.user!.clinicId);
    if (!rule) {
      return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });
    }

    Object.assign(rule, updates);
    return NextResponse.json({ rule });
  } catch (err) {
    console.error('Erro ao atualizar regra de prioridade:', err);
    return NextResponse.json({ error: 'Falha ao atualizar regra.' }, { status: 500 });
  }
}
