import { TriageResult, UrgencyLevel } from '../types';

/**
 * Heurísticas Clínicas Baseadas no Protocolo de Manchester e Diretrizes de Emergência
 */

interface ClinicalKeywordRule {
  urgency: UrgencyLevel;
  manchesterCategory: string;
  suggestedProtocol: string;
  slaMinutes: number;
  signals: string[];
  redFlags: string[];
  patterns: RegExp[];
  recommendedAction: string;
  suggestedAttendantResponse: string;
}

const CLINICAL_RULES: ClinicalKeywordRule[] = [
  {
    urgency: 'critica',
    manchesterCategory: 'Vermelho (Emergência - Atendimento Imediato)',
    suggestedProtocol: 'Protocolo de Emergência / Síndrome Coronariana / Ictus / Choque',
    slaMinutes: 0,
    signals: ['Dor torácica súbita em aperto', 'Dispneia grave/asfixia', 'Parada cardiorrespiratória', 'Perda de consciência', 'Sinais focais neurológicos'],
    redFlags: ['Risco iminente de morte', 'Instabilidade hemodinâmica', 'Suspeita de IAM ou AVC'],
    patterns: [
      /dor\s+(no\s+peito|tor[áa]cica|no\s+cora[çc][ãa]o|precordial)/i,
      /falta\s+de\s+ar\s+(grave|s[úu]bita|muito\s+forte|asfixi|sufoc)/i,
      /desmai(ou|o)|perdeu\s+os\s+sentidos|inconsciente|n[ãa]o\s+responde/i,
      /suspeita\s+de\s+avc|boca\s+torta|dorm[êe]ncia\s+subita|perda\s+de\s+for[çc]a/i,
      /sangramento\s+(ativo|incontrol[áa]vel|profuso|hemorragia)/i,
      /convuls[ãa]o|ataque\s+epil[ée]ptico/i,
    ],
    recommendedAction: 'Acionamento IMEDIATO de equipe médica, SAMU (192) ou encaminhamento direto ao Pronto-Socorro com ECG em até 10 min.',
    suggestedAttendantResponse: '⚠️ ATENÇÃO: Identificamos sintomas de alta gravidade clínica. Por favor, dirija-se IMEDIATAMENTE ao Pronto-Socorro mais próximo ou acione o SAMU pelo 192. Nossa equipe médica foi notificada com prioridade máxima.',
  },
  {
    urgency: 'alta',
    manchesterCategory: 'Laranja (Muito Urgente - Até 10 min)',
    suggestedProtocol: 'Protocolo de Dor Intensa Aguda / Síndrome Febril Alta / Cólica Renal',
    slaMinutes: 10,
    signals: ['Febre alta persistente (>39°C)', 'Dor aguda de forte intensidade', 'Crise asmática/broncoespasmo', 'Cólica renal severa', 'Reação anafilática em evolução'],
    redFlags: ['Progressão rápida de sintomas', 'Dor escala EVA 8-10', 'Desidratação ou vômitos incoercíveis'],
    patterns: [
      /febre\s+(alta|39|40|que\s+n[ãa]o\s+passa|persistente)/i,
      /dor\s+(insuport[áa]vel|muito\s+forte|intensa|aguda|severa)/i,
      /c[óo]lica\s+renal|dor\s+nos\s+rins|dor\s+lombar\s+s[úu]bita/i,
      /v[ôo]mitos\s+incessantes|desidrata[çc][ãa]o|n[ãa]o\s+segura\s+[áa]gua/i,
      /rea[çc][ãa]o\s+al[ée]rgica\s+com\s+incha[çc]o|edema\s+de\s+glote/i,
      /queimadura\s+(grave|extensa)|fratura\s+exposta/i,
    ],
    recommendedAction: 'Encaixe clínico prioritário em até 10 minutos. Avaliação de enfermagem e aferição imediata de sinais vitais.',
    suggestedAttendantResponse: 'Entendemos a urgência do seu quadro. Estamos abrindo um encaixe prioritário para avaliação médica imediata. Por favor, compareça à recepção da clínica imediatamente ou confirme seu deslocamento.',
  },
  {
    urgency: 'media',
    manchesterCategory: 'Amarelo (Urgente - Até 60 min)',
    suggestedProtocol: 'Protocolo de Queixa Aguda / Síndrome Gripal / Dúvida Pós-Operatória',
    slaMinutes: 60,
    signals: ['Dor moderada controlável', 'Sintomas gripais com prostração', 'Alergia cutânea localizada', 'Picos hipertensivos assintomáticos'],
    redFlags: ['Persistência por mais de 48h sem melhora'],
    patterns: [
      /dor\s+(moderada|de\s+cabe[çc]a|muscular|de\s+garganta|no\s+est[ôo]mago)/i,
      /febre\s+(baixa|37|38)/i,
      /press[ãa]o\s+(alta|baixa|14|15|16)/i,
      /tosse|coriza|mal\s+estar|gripe/i,
      /diarreia|n[áa]usea|azia/i,
    ],
    recommendedAction: 'Agendamento de consulta no mesmo dia em até 60 minutos ou teleorientação com plantonista.',
    suggestedAttendantResponse: 'Anotamos seus sintomas e estamos verificando a disponibilidade do nosso médico plantonista para atendimento no dia de hoje em até 60 minutos. Como você está se sentindo neste exato momento?',
  },
  {
    urgency: 'baixa',
    manchesterCategory: 'Verde (Pouco Urgente - Até 120 min / Eletivo)',
    suggestedProtocol: 'Protocolo de Atendimento Eletivo / Check-up / Renovação de Receitas',
    slaMinutes: 120,
    signals: ['Exame de rotina preventivo', 'Renovação de prescrição médica', 'Consulta eletiva de especialidade', 'Apresentação de exames de rotina'],
    redFlags: [],
    patterns: [
      /consulta\s+de\s+rotina|check[\s-]?up|preventiv/i,
      /renova[çc][ãa]o\s+de\s+receita|receita\s+controlada|receitu[áa]rio/i,
      /marcar\s+consulta|agendar\s+hor[áa]rio|disponibilidade\s+de\s+agenda/i,
      /retorno\s+m[ée]dico|mostrar\s+exame/i,
      /resultado\s+de\s+exame|laudo/i,
    ],
    recommendedAction: 'Fluxo padrão de agendamento eletivo de acordo com a especialidade desejada e disponibilidade de agenda.',
    suggestedAttendantResponse: 'Olá! Será um prazer ajudar no seu agendamento eletivo. Temos horários disponíveis para os próximos dias com nossos especialistas. Qual período (manhã ou tarde) é melhor para você?',
  },
];

/**
 * Fallback Heurístico Local quando os provedores externos de IA estão indisponíveis
 */
export function executeLocalHeuristicTriage(messageText: string, startTime: number): TriageResult {
  const normalized = messageText.toLowerCase();
  const detectedSignals: string[] = [];
  const detectedRedFlags: string[] = [];

  let matchedUrgency: UrgencyLevel | null = null;
  let matchedRule: ClinicalKeywordRule | null = null;

  for (const rule of CLINICAL_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(normalized)) {
        matchedUrgency = rule.urgency;
        matchedRule = rule;
        detectedSignals.push(...rule.signals);
        detectedRedFlags.push(...rule.redFlags);
        break;
      }
    }
    if (matchedUrgency) break;
  }

  // REGRA DE OURO #1: Dúvida / Ambiguidade NUNCA resulta em baixa urgência silenciosa.
  // Padrão obrigatório na dúvida: 'media'
  const finalUrgency: UrgencyLevel = matchedUrgency || 'media';
  const finalCategory = matchedRule?.manchesterCategory || 'Amarelo (Urgente / Dúvida Heurística - 60 min)';
  const finalProtocol = matchedRule?.suggestedProtocol || 'Protocolo de Investigação de Queixa Clínica Indefinida';
  const finalSla = matchedRule ? matchedRule.slaMinutes : 60;
  const finalSignals = detectedSignals.length > 0 ? Array.from(new Set(detectedSignals)) : ['Sintoma ambíguo ou não especificado'];
  const finalRedFlags = detectedRedFlags.length > 0 ? Array.from(new Set(detectedRedFlags)) : [];
  const finalAction = matchedRule?.recommendedAction || 'Avaliação médica presencial ou por teleatendimento recomendada em até 60 minutos.';
  const finalAttendantResponse = matchedRule?.suggestedAttendantResponse || 'Olá! Registramos seu contato. Um profissional de enfermagem ou atendente entrará em contato em instantes para direcionar seu atendimento com segurança.';

  const colorMap: Record<UrgencyLevel, 'vermelho' | 'laranja' | 'amarelo' | 'verde' | 'azul'> = {
    critica: 'vermelho',
    alta: 'laranja',
    media: 'amarelo',
    baixa: 'verde',
  };

  // REGRA DE OURO #2: requiresHumanReview = true SEMPRE forçado no fallback local
  const requiresHumanReview = true;
  const guardrailTriggered = true;
  const guardrailReason = 'Exigência de validação humana mandatória devido ao acionamento do Fallback Heurístico Local de contingência.';

  return {
    urgency: finalUrgency,
    confidence: matchedUrgency ? 0.75 : 0.5,
    clinicalSignals: finalSignals,
    redFlags: finalRedFlags,
    recommendedAction: finalAction,
    suggestedProtocol: finalProtocol,
    slaMinutes: finalSla,
    manchesterCategory: finalCategory,
    manchesterColor: colorMap[finalUrgency] || 'amarelo',
    requiresHumanReview,
    guardrailTriggered,
    guardrailReason,
    suggestedAttendantResponse: finalAttendantResponse,
    providerUsed: 'Fallback Heurístico Local',
    executionTimeMs: Date.now() - startTime,
    reasoning: matchedUrgency
      ? `Identificado padrão clínico de ${matchedUrgency.toUpperCase()} urgência via análise heurística local com guardrail ativo.`
      : 'Mensagem ambígua ou sem padrão claro detectado. Aplicado guardrail de segurança padrão (Urgência Média) com validação médica obrigatória.',
  };
}

/**
 * Aplica os Guardrails Clínicos Estritos sobre o resultado de qualquer provedor
 */
export function applyClinicalGuardrails(result: TriageResult): TriageResult {
  const isHighOrCritical = result.urgency === 'critica' || result.urgency === 'alta';
  const isFallback = result.providerUsed === 'Fallback Heurístico Local';
  const isLowConfidence = typeof result.confidence === 'number' && result.confidence < 0.7;

  // Guardrail 1: Urgência Alta/Crítica exige revisão humana obrigatória
  // Guardrail 2: Fallback Heurístico Local exige revisão humana obrigatória
  // Guardrail 3: Baixa confiança da IA exige revisão humana obrigatória
  const shouldRequireHumanReview = isHighOrCritical || isFallback || isLowConfidence || result.requiresHumanReview;
  const guardrailTriggered = shouldRequireHumanReview;

  let guardrailReason: string | undefined;
  if (isHighOrCritical) {
    guardrailReason = `Exigência de revisão clínica humana mandatória: Classificação de Urgência ${result.urgency.toUpperCase()} (Protocolo de Manchester).`;
  } else if (isFallback) {
    guardrailReason = 'Exigência de revisão humana obrigatória: Resposta gerada via Fallback Heurístico Local.';
  } else if (isLowConfidence) {
    guardrailReason = 'Exigência de revisão humana obrigatória: Baixo índice de confiança estatística da IA (< 70%).';
  } else if (result.requiresHumanReview) {
    guardrailReason = 'Revisão humana solicitada pelo motor clínico de inteligência artificial.';
  }

  const colorMap: Record<UrgencyLevel, 'vermelho' | 'laranja' | 'amarelo' | 'verde' | 'azul'> = {
    critica: 'vermelho',
    alta: 'laranja',
    media: 'amarelo',
    baixa: 'verde',
  };

  const slaMap: Record<UrgencyLevel, number> = {
    critica: 0,
    alta: 10,
    media: 60,
    baixa: 120,
  };

  const protocolMap: Record<UrgencyLevel, string> = {
    critica: 'Protocolo Manchester Vermelho: Emergência / Risco Iminente',
    alta: 'Protocolo Manchester Laranja: Muito Urgente / Encaixe Rápido',
    media: 'Protocolo Manchester Amarelo: Urgente / Consulta no Dia',
    baixa: 'Protocolo Manchester Verde: Atendimento Eletivo / Rotina',
  };

  return {
    ...result,
    manchesterColor: result.manchesterColor || colorMap[result.urgency] || 'amarelo',
    slaMinutes: typeof result.slaMinutes === 'number' ? result.slaMinutes : slaMap[result.urgency] ?? 60,
    suggestedProtocol: result.suggestedProtocol || protocolMap[result.urgency] || 'Protocolo Clínico Padrão',
    requiresHumanReview: shouldRequireHumanReview,
    guardrailTriggered,
    guardrailReason: guardrailReason || result.guardrailReason,
    redFlags: result.redFlags && result.redFlags.length > 0 ? result.redFlags : (isHighOrCritical ? ['Sinais vitais/sintomas demandam vigilância'] : []),
  };
}
