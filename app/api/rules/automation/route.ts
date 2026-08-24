import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/store';
import { authenticateRequest } from '@/lib/server/authHelper';
import { AutomationRule } from '@/lib/types';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  const db = getDatabase();
  const automations = db.automationRules.filter((r) => r.clinicId === auth.user!.clinicId);
  return NextResponse.json({ automations });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  try {
    const body = await req.json();
    const { name, trigger, actions, active } = body;

    const db = getDatabase();
    const newRule: AutomationRule = {
      id: `auto_${Date.now()}`,
      clinicId: auth.user.clinicId,
      name: name || 'Nova Automação',
      trigger: trigger || 'custom',
      actions: Array.isArray(actions) ? actions : ['Notificar equipe'],
      active: active !== undefined ? active : true,
      successRate: 100,
      executionCount: 0,
    };

    db.automationRules.push(newRule);
    return NextResponse.json({ automation: newRule });
  } catch (err) {
    console.error('Erro ao criar automação:', err);
    return NextResponse.json({ error: 'Falha ao salvar automação.' }, { status: 500 });
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
    const rule = db.automationRules.find((r) => r.id === id && r.clinicId === auth.user!.clinicId);
    if (!rule) {
      return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });
    }

    Object.assign(rule, updates);
    return NextResponse.json({ automation: rule });
  } catch (err) {
    console.error('Erro ao atualizar automação:', err);
    return NextResponse.json({ error: 'Falha ao atualizar automação.' }, { status: 500 });
  }
}
