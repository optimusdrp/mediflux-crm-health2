import { Patient, SlaAlertRule, ClinicSettings } from './types';

/**
 * Resolve qual SlaAlertRule vale para um paciente específico, dado o
 * conjunto de regras configuradas na clínica. A regra mais específica
 * que combina com o paciente é a escolhida — "mais específica" aqui
 * significa mais dimensões preenchidas (urgência, sentimento, funil,
 * etapa) que batem com o paciente; uma regra com todos os campos de
 * dimensão vazios serve como "padrão geral" e só é usada quando
 * nenhuma regra mais específica combina.
 *
 * Retorna null se nenhuma regra (nem geral) estiver configurada e
 * habilitada — nesse caso, o chamador decide o fallback (ex.:
 * ClinicSettings.whatsappAlerts.slaAlertMinutes, ou um padrão fixo).
 */
export function resolveSlaRuleForPatient(patient: Patient, rules: SlaAlertRule[]): SlaAlertRule | null {
  const enabledRules = rules.filter((r) => r.enabled);

  const matching = enabledRules.filter((r) => {
    if (r.urgency && r.urgency !== patient.urgency) return false;
    if (r.sentiment && r.sentiment !== patient.sentiment) return false;
    if (r.funnelId && r.funnelId !== patient.funnelId) return false;
    if (r.stageId && r.stageId !== patient.funnelStage) return false;
    return true;
  });

  if (matching.length === 0) return null;

  // Especificidade = quantas dimensões a regra preenche. Em empate,
  // a primeira regra da lista (ordem em que o admin cadastrou) vence
  // — previsível e sem ambiguidade extra para explicar ao usuário.
  const specificity = (r: SlaAlertRule) => [r.urgency, r.sentiment, r.funnelId, r.stageId].filter(Boolean).length;
  return matching.reduce((best, current) => (specificity(current) > specificity(best) ? current : best));
}

/**
 * Limite de minutos parado a aplicar para este paciente — resolve a
 * regra segmentada mais específica; se nenhuma existir, cai para o
 * limite global de whatsappAlerts.slaAlertMinutes; se nem esse
 * existir, usa 240 minutos (4 horas) como último recurso.
 */
export function getStalledLimitMinutes(patient: Patient, settings: Pick<ClinicSettings, 'slaAlertRules' | 'whatsappAlerts'>): number {
  const rule = resolveSlaRuleForPatient(patient, settings.slaAlertRules || []);
  if (rule) return rule.maxMinutesStalled;
  if (settings.whatsappAlerts?.slaAlertMinutes) return settings.whatsappAlerts.slaAlertMinutes;
  return 240;
}

/** Minutos desde a última interação do paciente — mesma unidade usada por toda a lógica de SLA (não mais dias, que escondia atrasos de poucas horas). */
export function minutesSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60));
}

/** Formata um total de minutos de forma legível: "42 min", "3h 15min", "2 dias". */
export function formatMinutesElapsed(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  if (hours < 24) return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days} dia${days !== 1 ? 's' : ''}`;
}
