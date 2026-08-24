export class FeatureNotAvailableError extends Error {
  public feature: string;
  constructor(feature: string, message: string) {
    super(message);
    this.name = 'FeatureNotAvailableError';
    this.feature = feature;
  }
}

export async function authFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  retries = 2
): Promise<T> {
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
    response = await fetch(input, {
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
