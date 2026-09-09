/**
 * Validadores dos campos de "Identidade & Unidades" (Configurações →
 * "1. Identidade & Unidades"). Cada função retorna null quando o
 * valor é válido, ou uma mensagem de erro em português quando não é
 * — para uso direto tanto no feedback visual do formulário quanto em
 * validação de bloqueio antes do submit.
 *
 * Campos vazios NUNCA são tratados como erro aqui — o pedido original
 * era permitir que o cliente deixe em branco o que ainda não tem para
 * preencher depois do login, então a obrigatoriedade (campo vazio =
 * erro) é decidida por REQUIRED_FIELDS abaixo, checada só no submit
 * final, não a cada tecla digitada.
 */

/** CNPJ no formato 00.000.000/0000-00, com validação real dos dígitos verificadores (não só a máscara). */
export function validateCNPJ(value: string): string | null {
  if (!value.trim()) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 14) return "CNPJ deve ter 14 dígitos.";
  if (/^(\d)\1{13}$/.test(digits)) return "CNPJ inválido.";

  const calcCheckDigit = (base: string, weights: number[]): number => {
    const sum = base.split("").reduce((acc, digit, i) => acc + Number(digit) * weights[i], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const first12 = digits.slice(0, 12);
  const d1 = calcCheckDigit(first12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calcCheckDigit(first12 + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  if (digits[12] !== String(d1) || digits[13] !== String(d2)) return "CNPJ inválido — dígitos verificadores não conferem.";
  return null;
}

/** Aplica a máscara 00.000.000/0000-00 conforme o usuário digita. */
export function maskCNPJ(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

/** Código CNES (Datasus) — 7 dígitos numéricos. */
export function validateCNES(value: string): string | null {
  if (!value.trim()) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 7) return "Código CNES deve ter exatamente 7 dígitos.";
  return null;
}

/** Nome do responsável técnico — só exige um mínimo de conteúdo real, sem formato rígido. */
export function validateNome(value: string): string | null {
  if (!value.trim()) return null;
  if (value.trim().length < 3) return "Nome muito curto.";
  if (/\d/.test(value)) return "Nome não deve conter números.";
  return null;
}

/** CRM no formato CRM/UF 000000 (ou variações próximas — o número de dígitos varia por estado). */
export function validateCRM(value: string): string | null {
  if (!value.trim()) return null;
  const pattern = /^CRM\/[A-Z]{2}\s?\d{4,7}$/i;
  if (!pattern.test(value.trim())) return "Formato esperado: CRM/UF 000000 (ex.: CRM/SP 123456).";
  return null;
}

/** Telefone brasileiro — fixo (10 dígitos) ou celular (11 dígitos), com DDD. */
export function validateTelefone(value: string): string | null {
  if (!value.trim()) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 10 && digits.length !== 11) return "Telefone deve ter DDD + número (10 ou 11 dígitos).";
  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return "DDD inválido.";
  return null;
}

/** Aplica a máscara (00) 00000-0000 ou (00) 0000-0000 conforme o tamanho digitado. */
export function maskTelefone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d{4})(\d{0,4})$/, (_, a, b, c) => (c ? `(${a}) ${b}-${c}` : b ? `(${a}) ${b}` : `(${a}`));
  }
  return digits.replace(/^(\d{2})(\d{5})(\d{0,4})$/, (_, a, b, c) => (c ? `(${a}) ${b}-${c}` : `(${a}) ${b}`));
}

/** Endereço — só exige um mínimo de conteúdo para não salvar algo claramente incompleto. */
export function validateEndereco(value: string): string | null {
  if (!value.trim()) return null;
  if (value.trim().length < 10) return "Endereço parece incompleto.";
  return null;
}

export type IdentityFieldKey = "razaoSocial" | "nomeFantasia" | "cnpj" | "cnes" | "rtNome" | "rtCrm" | "telefonePrincipal" | "whatsappAtendimento" | "endereco";

/** Roteia cada campo para seu validador — usado pelo formulário para validar genericamente por nome de campo. */
export function validateIdentityField(field: IdentityFieldKey, value: string): string | null {
  switch (field) {
    case "cnpj":
      return validateCNPJ(value);
    case "cnes":
      return validateCNES(value);
    case "rtNome":
      return validateNome(value);
    case "rtCrm":
      return validateCRM(value);
    case "telefonePrincipal":
    case "whatsappAtendimento":
      return validateTelefone(value);
    case "endereco":
      return validateEndereco(value);
    case "razaoSocial":
    case "nomeFantasia":
      // Sem formato rígido — qualquer texto não vazio é aceito.
      return null;
    default:
      return null;
  }
}

/**
 * Campos considerados obrigatórios para o cadastro de identidade ser
 * dado como "completo" — checados só no momento do submit (não a
 * cada tecla), e cujo erro é uma mensagem diferente ("obrigatório")
 * da validação de formato.
 */
export const REQUIRED_IDENTITY_FIELDS: IdentityFieldKey[] = ["nomeFantasia", "telefonePrincipal"];

/** Valida o formulário inteiro no momento do submit — combina obrigatoriedade e formato. Retorna um mapa de field -> mensagem de erro, vazio se tudo estiver válido. */
export function validateIdentityForm(data: Record<IdentityFieldKey, string>): Partial<Record<IdentityFieldKey, string>> {
  const errors: Partial<Record<IdentityFieldKey, string>> = {};
  for (const field of Object.keys(data) as IdentityFieldKey[]) {
    if (REQUIRED_IDENTITY_FIELDS.includes(field) && !data[field].trim()) {
      errors[field] = "Campo obrigatório.";
      continue;
    }
    const formatError = validateIdentityField(field, data[field]);
    if (formatError) errors[field] = formatError;
  }
  return errors;
}
