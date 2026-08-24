import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/store';
import { authenticateRequest } from '@/lib/server/authHelper';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const search = searchParams.get('search')?.toLowerCase();

  const db = getDatabase();
  let logs = db.auditLogs.filter((l) => l.clinicId === auth.user!.clinicId);

  if (category && category !== 'todos') {
    logs = logs.filter((l) => l.lgpdCategory === category);
  }

  if (search) {
    logs = logs.filter(
      (l) =>
        l.action.toLowerCase().includes(search) ||
        l.target.toLowerCase().includes(search) ||
        l.authorEmail.toLowerCase().includes(search)
    );
  }

  return NextResponse.json({ logs });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  try {
    const body = await req.json();
    const { action, target, lgpdCategory, details } = body;

    const db = getDatabase();
    // Identidade do autor estritamente extraída do token decodificado, ignorando qualquer campo no corpo
    const newLog = {
      id: `aud_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      clinicId: auth.user.clinicId,
      action: action || 'ACAO_AUDITADA',
      target: target || 'Sistema',
      authorEmail: auth.user.email,
      authorRole: auth.user.role,
      ip: req.headers.get('x-forwarded-for') || '127.0.0.1',
      timestamp: new Date().toISOString(),
      details: details || {},
      lgpdCategory: lgpdCategory || 'acesso_dados',
    };

    db.auditLogs.unshift(newLog);

    return NextResponse.json({ log: newLog });
  } catch (err) {
    console.error('Erro ao registrar log:', err);
    return NextResponse.json({ error: 'Erro ao gravar auditoria.' }, { status: 500 });
  }
}
