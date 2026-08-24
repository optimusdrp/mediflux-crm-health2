import { SignJWT, jwtVerify } from 'jose';
import { Role } from '../types';

// Correção de auditoria (prioridade crítica #3): antes, na ausência de
// JWT_SECRET no ambiente, o código usava uma chave fixa e visível no
// código-fonte ('mediflux-health-crm-production-hmac-sha256-key-secure')
// como segredo de assinatura — e essa variável nunca chegou a ser
// documentada em .env.example, então é provável que nunca tenha sido
// definida em nenhum ambiente real. Qualquer pessoa com acesso a este
// arquivo consegue forjar um token JWT válido para qualquer usuário,
// role ou clínica.
//
// Corrigido para falhar de forma explícita (fail loud) na ausência da
// variável, em vez de continuar silenciosamente com uma chave insegura
// e conhecida. Isso é deliberado: um erro de inicialização é preferível
// a um sistema de autenticação comprometido rodando sem aviso nenhum.
if (!process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET não está definido no ambiente. Defina uma chave secreta forte e única ' +
      'em .env antes de iniciar o servidor — nunca reaproveite o mesmo valor de outro ambiente.'
  );
}

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET);

export interface TokenPayload {
  id: string;
  email: string;
  role: Role;
  clinicId: string;
  name: string;
  [key: string]: unknown;
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return await new SignJWT({
    id: payload.id,
    email: payload.email,
    role: payload.role,
    clinicId: payload.clinicId,
    name: payload.name,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(SECRET_KEY);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload as unknown as TokenPayload;
  } catch (error: any) {
    if (
      error?.code === 'ERR_JWT_EXPIRED' ||
      error?.name === 'JWTExpired' ||
      error?.message?.includes('claim timestamp check failed')
    ) {
      // Token expirado é um ciclo normal de autenticação, não um erro fatal do sistema
      return null;
    }
    console.warn('Verificação de token JWT inválida:', error?.message || error);
    return null;
  }
}

export function extractBearerToken(authHeader?: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7).trim();
}
