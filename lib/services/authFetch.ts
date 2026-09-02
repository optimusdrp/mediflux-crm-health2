export class FeatureNotAvailableError extends Error {
  public feature: string;
  constructor(feature: string, message: string) {
    super(message);
    this.name = 'FeatureNotAvailableError';
    this.feature = feature;
  }
}

/**
 * Prefixa chamadas que começam com '/api/...' com a URL real do backend
 * (a Lambda core-api, exposta via API Gateway), quando configurada.
 *
 * Contexto desta mudança (migração AWS): o front-end original chamava
 * suas próprias API Routes internas do Next.js (mesmo domínio, caminho
 * relativo '/api/...'). Agora o backend roda separado, numa Lambda
 * própria — então precisamos montar a URL absoluta. Mudança feita aqui,
 * dentro de authFetch(), e não nas ~46 chamadas em lib/services/api.ts,
 * para não precisar tocar em cada uma delas.
 *
 * Além do domínio, os caminhos também mudam de prefixo: as rotas da
 * Lambda não usam o prefixo '/api' (ex.: '/patients', não
 * '/api/patients') — ver src/handler.ts da Lambda. Esse ajuste de
 * prefixo também é feito aqui.
 */
function resolveApiUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (typeof input !== 'string' || !input.startsWith('/api/')) return input;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) return input; // sem variável configurada, mantém o comportamento original (rota relativa)
  const pathWithoutApiPrefix = input.replace(/^\/api/, '');
  return `${baseUrl.replace(/\/$/, '')}${pathWithoutApiPrefix}`;
}

export async function authFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  retries = 2
): Promise<T> {
  const resolvedInput = resolveApiUrl(input);
  const token = typeof window !== 'undefined' ? localStorage.getItem('mediflux_jwt_token') : null;

  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type') && (!init?.body || typeof init.body === 'string')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(resolvedInput, {
      ...init,
      headers,
    });
  } catch (err: any) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      return authFetch<T>(input, init, retries - 1);
    }
    throw new Error(err.message || 'Falha na comunicação com o servidor.');
  }

  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('mediflux_jwt_token');
      window.dispatchEvent(new CustomEvent('mediflux:unauthorized'));
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Sessão expirada. Faça login novamente.');
  }

  if (response.status === 403) {
    const errorData = await response.json().catch(() => ({}));
    if (errorData.blocked && errorData.feature) {
      throw new FeatureNotAvailableError(
        errorData.feature,
        errorData.error || 'Este recurso de inteligência artificial não está incluso no plano da clínica.'
      );
    }
    throw new Error(errorData.error || 'Acesso negado: permissão insuficiente.');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Erro na requisição (${response.status})`);
  }

  return response.json() as Promise<T>;
}
