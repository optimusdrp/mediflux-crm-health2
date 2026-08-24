import { NextRequest } from 'next/server';
import { extractBearerToken, verifyToken, TokenPayload } from '../security/jwt';
import { getDatabase } from '../db/store';
import { SensitiveAction, TabId } from '../types';

export interface AuthContextResult {
  authenticated: boolean;
  user?: TokenPayload;
  error?: string;
  status?: number;
}

export async function authenticateRequest(req: NextRequest): Promise<AuthContextResult> {
  const authHeader = req.headers.get('authorization');
  const token = extractBearerToken(authHeader);

  // Correção de auditoria (prioridade crítica #1): antes, a ausência de
  // token era tratada como "ambiente local de teste" e autenticava
  // automaticamente como o primeiro usuário do banco (db.users[0],
  // tipicamente o Administrador) — um bypass de autenticação real,
  // confirmado em produção via chamadas HTTP sem nenhum header
  // Authorization (GET/POST em /api/patients, /api/audit-logs
  // devolvendo dados reais de pacientes e logs sem nenhuma credencial).
  //
  // Toda rota de API deste projeto depende deste único helper para
  // autenticação — não existe um middleware.ts central — então a
  // ausência de token precisa ser rejeitada aqui, sempre, sem exceção
  // implícita. Um ambiente de desenvolvimento que realmente precise
  // pular login deve fazer isso de forma explícita (ex.: um usuário de
  // teste com credenciais próprias), nunca como comportamento padrão do
  // helper de autenticação.
  if (!token) {
    return {
      authenticated: false,
      error: 'Não autenticado. Informe um token de acesso válido no cabeçalho Authorization.',
      status: 401,
    };
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return {
      authenticated: false,
      error: 'Token de autenticação inválido ou expirado.',
      status: 401,
    };
  }

  return {
    authenticated: true,
    user: payload,
  };
}

export function checkFeatureAddon(
  clinicId: string,
  feature: 'triagem_clinica' | 'classificacao_automatica' | 'qualificacao_lead' | 'analise_sentimento'
): boolean {
  const db = getDatabase();
  const sub = db.getSubscription(clinicId);

  // Inadimplência bloqueia exclusivamente os Add-ons de IA
  if (sub.billingStatus === 'inadimplente') {
    return false;
  }

  return !!sub.addOns[feature];
}

export function checkActionPermission(
  clinicId: string,
  role: string,
  action: SensitiveAction
): boolean {
  const db = getDatabase();
  const perm = db.rolePermissions.find((rp) => rp.clinicId === clinicId && rp.role === role);
  if (!perm) return false;
  return perm.grantedActions.includes(action);
}

export function checkTabPermission(
  clinicId: string,
  role: string,
  tab: TabId
): boolean {
  const db = getDatabase();
  const perm = db.rolePermissions.find((rp) => rp.clinicId === clinicId && rp.role === role);
  if (!perm) return false;
  return perm.permittedTabs.includes(tab);
}
