/**
 * Whitelist de campos para criação e atualização de entidades (Anti-Mass Assignment)
 */

export const PATIENT_ALLOWED_CREATE_FIELDS = [
  'name',
  'phone',
  'cpf',
  'birthDate',
  'healthInsurance',
  'planNumber',
  'specialty',
  'funnelStage',
  'funnelId',
  'urgency',
  'checklist',
  'notes',
  'tags',
  'originChannel',
  'assignedUserId',
];

export const PATIENT_ALLOWED_UPDATE_FIELDS = [
  'name',
  'phone',
  'cpf',
  'birthDate',
  'healthInsurance',
  'planNumber',
  'specialty',
  'funnelStage',
  'funnelId',
  'urgency',
  'checklist',
  'notes',
  'tags',
  'assignedUserId',
  'originChannel',
  'leadScore',
  'sentiment',
  'aiSummary',
  'requiresHumanReview',
];

// Campos permitidos na aba "Dados Cadastrais" do chat (edição não-destrutiva sem afetar o funil/urgência)
export const PATIENT_CADASTRO_EDIT_FIELDS = [
  'name',
  'phone',
  'cpf',
  'birthDate',
  'healthInsurance',
  'planNumber',
  'specialty',
  'notes',
];

export function filterAllowedFields<T = Record<string, unknown>>(
  input: Record<string, unknown>,
  allowedFields: string[]
): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in input && input[field] !== undefined) {
      result[field] = input[field];
    }
  }
  return result as Partial<T>;
}
