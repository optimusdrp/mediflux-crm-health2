/**
 * SSRF Guard - Proteção contra Server-Side Request Forgery
 * Bloqueia endereços IP privados, loopback, link-local e metadados de nuvem (AWS/GCP: 169.254.169.254)
 */

export interface SSRFValidationResult {
  allowed: boolean;
  reason?: string;
  hostname?: string;
}

const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.169.254', // AWS/GCP Instance Metadata
  'metadata.google.internal',
  'instance-data',
]);

export function validateUrlAgainstSSRF(rawUrl: string): SSRFValidationResult {
  try {
    const parsed = new URL(rawUrl);

    // Exige estritamente HTTP ou HTTPS
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        allowed: false,
        reason: `Protocolo inválido ou não seguro: ${parsed.protocol}. Apenas http: e https: são permitidos.`,
      };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Verificação explícita de nomes bloqueados
    if (BLOCKED_HOSTS.has(hostname)) {
      return {
        allowed: false,
        reason: `Destino bloqueado por política de segurança SSRF: ${hostname}`,
        hostname,
      };
    }

    // Validação de ranges IPv4 privados (RFC 1918 e Link-Local)
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipMatch = hostname.match(ipv4Regex);

    if (ipMatch) {
      const [, octet1Str, octet2Str] = ipMatch;
      const octet1 = parseInt(octet1Str, 10);
      const octet2 = parseInt(octet2Str, 10);

      // 127.0.0.0/8 (Loopback)
      if (octet1 === 127) {
        return { allowed: false, reason: 'Endereço Loopback (127.0.0.0/8) bloqueado.', hostname };
      }

      // 10.0.0.0/8 (Privado)
      if (octet1 === 10) {
        return { allowed: false, reason: 'Rede privada (10.0.0.0/8) bloqueada.', hostname };
      }

      // 172.16.0.0/12 (Privado)
      if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) {
        return { allowed: false, reason: 'Rede privada (172.16.0.0/12) bloqueada.', hostname };
      }

      // 192.168.0.0/16 (Privado)
      if (octet1 === 192 && octet2 === 168) {
        return { allowed: false, reason: 'Rede privada (192.168.0.0/16) bloqueada.', hostname };
      }

      // 169.254.0.0/16 (Link-Local / Metadata)
      if (octet1 === 169 && octet2 === 254) {
        return { allowed: false, reason: 'Endereço Link-Local / Metadata (169.254.0.0/16) bloqueado.', hostname };
      }

      // 0.0.0.0/8
      if (octet1 === 0) {
        return { allowed: false, reason: 'Endereço não roteável bloqueado.', hostname };
      }
    }

    return { allowed: true, hostname };
  } catch {
    return { allowed: false, reason: 'URL malformatada ou inválida.' };
  }
}
