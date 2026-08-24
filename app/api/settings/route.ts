import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/store';
import { authenticateRequest } from '@/lib/server/authHelper';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  const db = getDatabase();
  const settings = db.getSettings(auth.user.clinicId);
  const permissions = db.rolePermissions.filter((rp) => rp.clinicId === auth.user!.clinicId);
  const users = db.users.filter((u) => u.clinicId === auth.user!.clinicId);

  return NextResponse.json({
    settings,
    permissions,
    users,
  });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  if (auth.user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Apenas o Administrador pode modificar as configurações centrais da clínica.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const db = getDatabase();
    const currentSettings = db.getSettings(auth.user.clinicId);

    // Atualiza os blocos enviados
    if (body.quickResponses) currentSettings.quickResponses = body.quickResponses;
    if (body.draftsPolicy) currentSettings.draftsPolicy = body.draftsPolicy;
    if (body.whatsappAlerts) currentSettings.whatsappAlerts = body.whatsappAlerts;
    if (body.globalNotifications) currentSettings.globalNotifications = body.globalNotifications;
    if (body.channels) currentSettings.channels = body.channels;
    if (body.funnels) currentSettings.funnels = body.funnels;

    // Se foram enviadas alterações de permissões RBAC
    if (body.rolePermissions && Array.isArray(body.rolePermissions)) {
      body.rolePermissions.forEach((rp: { role: string; permittedTabs: string[]; grantedActions: string[] }) => {
        const existing = db.rolePermissions.find(
          (p) => p.clinicId === auth.user!.clinicId && p.role === rp.role
        );
        if (existing) {
          existing.permittedTabs = rp.permittedTabs as any;
          existing.grantedActions = rp.grantedActions as any;
        }
      });
    }

    db.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      clinicId: auth.user.clinicId,
      action: 'ATUALIZACAO_CONFIGURACOES_CLINICA',
      target: 'Painel Administrativo (10 Áreas)',
      authorEmail: auth.user.email,
      authorRole: auth.user.role,
      ip: req.headers.get('x-forwarded-for') || '127.0.0.1',
      timestamp: new Date().toISOString(),
      details: { updatedSections: Object.keys(body) },
      lgpdCategory: 'alteracao_cadastral',
    });

    return NextResponse.json({ success: true, settings: currentSettings });
  } catch (err) {
    console.error('Erro ao salvar configurações:', err);
    return NextResponse.json({ error: 'Falha ao gravar configurações.' }, { status: 500 });
  }
}
