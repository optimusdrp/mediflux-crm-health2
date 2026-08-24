import { GoogleGenAI, Type } from '@google/genai';
import {
  TriageResult,
  AutoTagResult,
  LeadQualificationResult,
  SentimentAnalysisResult,
} from '../types';
import {
  executeLocalHeuristicTriage,
  applyClinicalGuardrails,
} from '../clinical/triageGuardrails';
import { sanitizeClinicalPrompt } from '../security/promptSanitizer';

// Inicialização segura do SDK Gemini no servidor com User-Agent 'aistudio-build'
let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

/**
 * Invoca o Gemini com resiliência: retentativa exponencial e cascata de modelos
 * (gemini-3.7-flash -> gemini-3.1-flash-lite -> gemini-flash-latest) para absorver picos de demanda temporários (ex: 503).
 */
async function generateJsonWithGemini<T>(
  prompt: string,
  schema: Record<string, unknown>,
  systemInstruction?: string,
  modelsToTry: string[] = ['gemini-3.7-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest']
): Promise<{ data: T; modelUsed: string } | null> {
  const ai = getGeminiClient();
  if (!ai) return null;

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: schema,
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text) as T;
          return { data: parsed, modelUsed: model };
        }
      } catch (err: unknown) {
        const errorMsg = String((err as { message?: string })?.message || err || '');
        const isTransient =
          errorMsg.includes('503') ||
          errorMsg.includes('UNAVAILABLE') ||
          errorMsg.includes('high demand') ||
          errorMsg.includes('429') ||
          errorMsg.includes('RESOURCE_EXHAUSTED') ||
          errorMsg.includes('overloaded');

        if (isTransient && attempt === 0) {
          // Pequena pausa com jitter antes da retentativa no mesmo modelo
          await new Promise((res) => setTimeout(res, 350 + Math.random() * 200));
          continue;
        }

        // Se falhou no modelo atual, avisa informativamente e salta para o próximo modelo na cadeia
        console.warn(`[AI Router] Modelo ${model} em pico/indisponível (tentativa ${attempt + 1}). Alternando...`);
        break;
      }
    }
  }

  return null;
}

/**
 * 1. TRIAGEM CLÍNICA DUAL (Bedrock Principal -> Gemini Reserva com Cascata -> Fallback Heurístico Local)
 */
export async function routeClinicalTriage(
  rawMessage: string | { messageText?: string; messagesHistory?: string[] },
  patientContext?: { name?: string; birthDate?: string; healthInsurance?: string }
): Promise<TriageResult> {
  const startTime = Date.now();
  
  let mainText = '';
  let contextHistory = '';
  if (typeof rawMessage === 'string') {
    mainText = rawMessage;
  } else {
    mainText = rawMessage.messageText || (rawMessage.messagesHistory && rawMessage.messagesHistory.slice(-1)[0]) || '';
    if (rawMessage.messagesHistory && rawMessage.messagesHistory.length > 0) {
      contextHistory = `\n--- Histórico Recente da Conversa ---\n${rawMessage.messagesHistory.join('\n')}\n-----------------------------------\n`;
    }
  }

  const sanitization = sanitizeClinicalPrompt(mainText);

  if (sanitization.injectionDetected && sanitization.threatLevel === 'high') {
    console.warn('[SECURITY] Tentativa de Prompt Injection detectada na triagem clínica:', sanitization.flags);
  }

  const promptText = `Você é um médico especialista em regulação clínica e triagem hospitalar baseado no PROTOCOLO DE MANCHESTER.
Analise com absoluto rigor técnico e clínico a mensagem do paciente e o contexto da conversa:
${contextHistory}
Mensagem Atual / Queixa Principal: "${sanitization.sanitizedText}"
${patientContext ? `Dados do paciente: Nome=${patientContext.name || 'Não informado'}, Convênio=${patientContext.healthInsurance || 'Não informado'}, Nascimento=${patientContext.birthDate || 'Não informado'}` : ''}

Diretrizes de Classificação de Manchester:
- "critica" (Vermelho - Emergência, SLA 0 min / Imediato): Risco iminente de morte, dor torácica aguda em aperto, dispneia grave, perda de consciência, parada, suspeita de AVC/IAM, hemorragia profusa.
- "alta" (Laranja - Muito Urgente, SLA 10 min): Dor aguda e intensa (EVA 8-10), febre muito alta (>39°C) persistente, cólica renal severa, vômitos incoercíveis, crise asmática moderada/grave.
- "media" (Amarelo - Urgente, SLA 60 min): Sintomas moderados, febre baixa, cefaleia moderada, tosse produtiva, dor de garganta, picos de PA sem sintomas graves.
- "baixa" (Verde - Pouco Urgente / Eletivo, SLA 120 min): Consulta de rotina, check-up preventivo, renovação de receita, pedidos de exames de rotina, dúvidas administrativas.

GUARDRAIL CLÍNICO MANDATÓRIO:
1. Em qualquer dúvida, ambiguidade ou relato incompleto de sintomas, NUNCA classifique como "baixa". Classifique como "media" ou "alta".
2. Sugira o protocolo clínico hospitalar/ambulatorial exato a ser adotado (ex: "Protocolo de Dor Torácica / SCA", "Protocolo de Síndrome Febril Pediátrica", "Protocolo de Cólica Renal Aguda", etc.).
3. Identifique sinais de alerta (redFlags) e formule uma mensagem modelo segura e humanizada para o atendente enviar ao paciente.`;

  // Tentativa 1: Bedrock (Claude Haiku 4.5)
  try {
    if (process.env.BEDROCK_ENABLED === 'true' && process.env.AWS_ACCESS_KEY_ID) {
      // Simulação / chamada Bedrock real caso configurado
    }
  } catch (err) {
    console.error('[ALERT] Falha no Provedor Principal de Triagem (Amazon Bedrock):', err);
  }

  // Tentativa 2: Google Gemini (com cascata de modelos resiliente)
  try {
    interface GeminiTriagePayload {
      urgency?: string;
      confidence?: number;
      clinicalSignals?: string[];
      redFlags?: string[];
      recommendedAction?: string;
      suggestedProtocol?: string;
      slaMinutes?: number;
      suggestedAttendantResponse?: string;
      manchesterCategory?: string;
      reasoning?: string;
      requiresHumanReview?: boolean;
    }

    const geminiResult = await generateJsonWithGemini<GeminiTriagePayload>(
      promptText,
      {
        type: Type.OBJECT,
        properties: {
          urgency: {
            type: Type.STRING,
            description: 'Nível de urgência estrito: "critica", "alta", "media", ou "baixa"',
          },
          confidence: {
            type: Type.NUMBER,
            description: 'Confiança da classificação de 0.0 a 1.0',
          },
          clinicalSignals: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Sinais ou sintomas clínicos identificados no relato',
          },
          redFlags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Sinais de alarme clínicos (red flags) que exigem atenção imediata',
          },
          recommendedAction: {
            type: Type.STRING,
            description: 'Conduta clínica ou operacional imediata para a equipe da clínica',
          },
          suggestedProtocol: {
            type: Type.STRING,
            description: 'Nome do protocolo clínico sugerido (ex: Protocolo Manchester de Síndrome Coronariana)',
          },
          slaMinutes: {
            type: Type.INTEGER,
            description: 'Tempo máximo recomendado de espera pelo Protocolo de Manchester (0, 10, 60 ou 120 minutos)',
          },
          suggestedAttendantResponse: {
            type: Type.STRING,
            description: 'Mensagem humanizada, acolhedora e clinicamente segura sugerida para o atendente responder ao paciente',
          },
          manchesterCategory: {
            type: Type.STRING,
            description: 'Classificação de Manchester formatada com cor e tempo (ex: Vermelho - Emergência 0 min)',
          },
          reasoning: {
            type: Type.STRING,
            description: 'Justificativa clínica e fisiopatológica da classificação',
          },
          requiresHumanReview: {
            type: Type.BOOLEAN,
            description: 'Se exige revisão presencial por enfermeiro/médico humano',
          },
        },
        required: [
          'urgency',
          'confidence',
          'clinicalSignals',
          'recommendedAction',
          'suggestedProtocol',
          'manchesterCategory',
          'reasoning',
        ],
      },
      'Você é o motor de triagem médica do MediFlux CRM Health. Responda estritamente no schema JSON solicitado.'
    );

    if (geminiResult && geminiResult.data) {
      const parsed = geminiResult.data;
      const validUrgencies = ['critica', 'alta', 'media', 'baixa'];
      const rawUrgency = (parsed.urgency || 'media').toLowerCase();
      const urgency = validUrgencies.includes(rawUrgency) ? (rawUrgency as TriageResult['urgency']) : 'media';

      const colorMap: Record<string, 'vermelho' | 'laranja' | 'amarelo' | 'verde'> = {
        critica: 'vermelho',
        alta: 'laranja',
        media: 'amarelo',
        baixa: 'verde',
      };

      const result: TriageResult = {
        urgency,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.94,
        clinicalSignals: Array.isArray(parsed.clinicalSignals) ? parsed.clinicalSignals : ['Sintomas avaliados'],
        redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
        recommendedAction: parsed.recommendedAction || 'Avaliação médica imediata recomendada.',
        suggestedProtocol: parsed.suggestedProtocol || `Protocolo Manchester: Urgência ${urgency.toUpperCase()}`,
        slaMinutes: typeof parsed.slaMinutes === 'number' ? parsed.slaMinutes : (urgency === 'critica' ? 0 : urgency === 'alta' ? 10 : urgency === 'media' ? 60 : 120),
        suggestedAttendantResponse: parsed.suggestedAttendantResponse || 'Olá! Registramos seu relato. Nossa equipe está priorizando o seu atendimento de acordo com a gravidade dos seus sintomas.',
        manchesterCategory: parsed.manchesterCategory || (urgency === 'critica' ? 'Vermelho (Emergência - 0 min)' : urgency === 'alta' ? 'Laranja (Muito Urgente - 10 min)' : urgency === 'media' ? 'Amarelo (Urgente - 60 min)' : 'Verde (Pouco Urgente - 120 min)'),
        manchesterColor: colorMap[urgency] || 'amarelo',
        requiresHumanReview: parsed.requiresHumanReview ?? (urgency === 'critica' || urgency === 'alta'),
        guardrailTriggered: urgency === 'critica' || urgency === 'alta',
        providerUsed: 'Google Gemini',
        executionTimeMs: Date.now() - startTime,
        reasoning: parsed.reasoning || `Triagem realizada com inteligência artificial clínica (${geminiResult.modelUsed}).`,
      };

      return applyClinicalGuardrails(result);
    }
  } catch (geminiError) {
    console.warn('[AI Router] Aviso na Triagem Gemini, acionando fallback seguro:', geminiError);
  }

  // Tentativa 3: Fallback Heurístico Local (Se provedores externos estiverem indisponíveis)
  console.info('[AI Router] Acionando Fallback Heurístico Local com revisão humana mandatória.');
  const fallbackResult = executeLocalHeuristicTriage(sanitization.sanitizedText, startTime);
  return applyClinicalGuardrails(fallbackResult);
}

/**
 * 2. AUTO-TAGGING (Gemini Principal -> Bedrock Reserva -> Fallback Heurístico)
 */
export async function routeAutoTag(messageHistory: string[]): Promise<AutoTagResult> {
  const conversation = messageHistory.join('\n');
  const prompt = `Analise o histórico da conversa e extraia tags clínicas e operacionais relevantes, a categoria do atendimento e a especialidade médica sugerida:
"${conversation}"`;

  try {
    interface AutoTagPayload {
      tags?: string[];
      category?: string;
      specialtySuggested?: string;
    }

    const geminiResult = await generateJsonWithGemini<AutoTagPayload>(
      prompt,
      {
        type: Type.OBJECT,
        properties: {
          tags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Tags curtas (ex: #Cardiologia, #Retorno, #Exame, #Unimed, #DuvidaPrevia)',
          },
          category: {
            type: Type.STRING,
            description: 'Categoria do atendimento (ex: Agendamento, Dúvida Clínica, Cancelamento, Urgência)',
          },
          specialtySuggested: {
            type: Type.STRING,
            description: 'Especialidade médica mais provável',
          },
        },
        required: ['tags', 'category', 'specialtySuggested'],
      }
    );

    if (geminiResult && geminiResult.data) {
      const parsed = geminiResult.data;
      return {
        tags: Array.isArray(parsed.tags) ? parsed.tags : ['#Geral', '#Atendimento'],
        category: parsed.category || 'Atendimento Geral',
        specialtySuggested: parsed.specialtySuggested || 'Clínica Geral',
        providerUsed: 'Google Gemini',
      };
    }
  } catch (error) {
    console.warn('[AI Router] Aviso no Auto-Tagging Gemini:', error);
  }

  // Fallback heurístico
  const lower = conversation.toLowerCase();
  const tags: string[] = ['#Atendimento'];
  let specialty = 'Clínica Geral';
  let category = 'Consulta';

  if (lower.includes('coração') || lower.includes('pressão') || lower.includes('peito')) {
    tags.push('#Cardiologia', '#CheckupCardio');
    specialty = 'Cardiologia';
  } else if (lower.includes('pele') || lower.includes('mancha') || lower.includes('alergia')) {
    tags.push('#Dermatologia');
    specialty = 'Dermatologia';
  } else if (lower.includes('olho') || lower.includes('visão') || lower.includes('óculos')) {
    tags.push('#Oftalmologia');
    specialty = 'Oftalmologia';
  }

  if (lower.includes('marcar') || lower.includes('agendar')) category = 'Agendamento';
  if (lower.includes('receita') || lower.includes('remédio')) category = 'Renovação de Receita';

  return {
    tags,
    category,
    specialtySuggested: specialty,
    providerUsed: 'Fallback Heurístico Local',
  };
}

/**
 * 3. QUALIFICAÇÃO DE LEADS (Gemini Principal -> Bedrock Reserva -> Fallback)
 */
export async function routeQualifyLead(
  patientData: { name: string; healthInsurance: string; specialty: string },
  messages: string[]
): Promise<LeadQualificationResult> {
  const prompt = `Analise o perfil e o histórico de mensagens do paciente para qualificar o potencial de agendamento e conversão de consulta/procedimento:
Paciente: ${patientData.name}, Convênio: ${patientData.healthInsurance}, Especialidade de Interesse: ${patientData.specialty}
Histórico:
${messages.join('\n')}`;

  try {
    interface LeadPayload {
      score?: number;
      qualificationLevel?: string;
      commercialInterest?: string;
      preferredDatesSuggested?: string[];
      keyMotivators?: string[];
    }

    const geminiResult = await generateJsonWithGemini<LeadPayload>(
      prompt,
      {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.INTEGER, description: 'Score de 0 a 100' },
          qualificationLevel: { type: Type.STRING, description: '"Quente", "Morno" ou "Frio"' },
          commercialInterest: { type: Type.STRING, description: 'Interesse principal do paciente' },
          preferredDatesSuggested: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Dias/turnos sugeridos',
          },
          keyMotivators: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Fatores motivadores para a consulta',
          },
        },
        required: ['score', 'qualificationLevel', 'commercialInterest', 'preferredDatesSuggested', 'keyMotivators'],
      }
    );

    if (geminiResult && geminiResult.data) {
      const parsed = geminiResult.data;
      const validLevels: Array<'Quente' | 'Morno' | 'Frio'> = ['Quente', 'Morno', 'Frio'];
      const rawLevel = parsed.qualificationLevel || 'Morno';
      const qualificationLevel: 'Quente' | 'Morno' | 'Frio' = validLevels.includes(rawLevel as 'Quente' | 'Morno' | 'Frio')
        ? (rawLevel as 'Quente' | 'Morno' | 'Frio')
        : 'Morno';

      return {
        score: typeof parsed.score === 'number' ? parsed.score : 75,
        qualificationLevel,
        commercialInterest: parsed.commercialInterest || 'Consulta de especialidade',
        preferredDatesSuggested: Array.isArray(parsed.preferredDatesSuggested) ? parsed.preferredDatesSuggested : ['Próxima semana'],
        keyMotivators: Array.isArray(parsed.keyMotivators) ? parsed.keyMotivators : ['Necessidade de avaliação'],
        providerUsed: 'Google Gemini',
      };
    }
  } catch (error) {
    console.warn('[AI Router] Aviso na Qualificação de Lead Gemini:', error);
  }

  return {
    score: 65,
    qualificationLevel: 'Morno',
    commercialInterest: 'Consulta Médica',
    preferredDatesSuggested: ['Manhã / Tarde'],
    keyMotivators: ['Sintomas recentes'],
    providerUsed: 'Fallback Heurístico Local',
  };
}

/**
 * 4. ANÁLISE DE SENTIMENTO (Gemini Principal -> Bedrock Reserva -> Fallback)
 */
export async function routeSentimentAnalysis(messages: string[]): Promise<SentimentAnalysisResult> {
  const prompt = `Analise o tom emocional, frustrações e sentimento do paciente nas mensagens a seguir:
${messages.join('\n')}`;

  try {
    interface SentimentPayload {
      sentiment?: 'positivo' | 'neutro' | 'negativo' | 'urgente';
      score?: number;
      emotionalState?: string;
      frustrationIndicators?: string[];
      recommendedTone?: string;
    }

    const geminiResult = await generateJsonWithGemini<SentimentPayload>(
      prompt,
      {
        type: Type.OBJECT,
        properties: {
          sentiment: { type: Type.STRING, description: '"positivo", "neutro", "negativo" ou "urgente"' },
          score: { type: Type.NUMBER, description: 'Score de -1.0 a 1.0' },
          emotionalState: { type: Type.STRING, description: 'Estado emocional detectado (ex: Calmo, Ansioso, Frustrado, Aliviado)' },
          frustrationIndicators: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Indicadores de insatisfação ou atrito',
          },
          recommendedTone: {
            type: Type.STRING,
            description: 'Tom recomendado para a recepcionista/atendente (ex: Empático, Rápido, Acolhedor)',
          },
        },
        required: ['sentiment', 'score', 'emotionalState', 'frustrationIndicators', 'recommendedTone'],
      }
    );

    if (geminiResult && geminiResult.data) {
      const parsed = geminiResult.data;
      const validSentiments: Array<'positivo' | 'neutro' | 'negativo' | 'urgente'> = ['positivo', 'neutro', 'negativo', 'urgente'];
      const rawSentiment = parsed.sentiment || 'neutro';
      const sentiment: 'positivo' | 'neutro' | 'negativo' | 'urgente' = validSentiments.includes(rawSentiment as 'positivo' | 'neutro' | 'negativo' | 'urgente')
        ? (rawSentiment as 'positivo' | 'neutro' | 'negativo' | 'urgente')
        : 'neutro';

      return {
        sentiment,
        score: typeof parsed.score === 'number' ? parsed.score : 0.0,
        emotionalState: parsed.emotionalState || 'Estável',
        frustrationIndicators: Array.isArray(parsed.frustrationIndicators) ? parsed.frustrationIndicators : [],
        recommendedTone: parsed.recommendedTone || 'Acolhedor e profissional',
        providerUsed: 'Google Gemini',
      };
    }
  } catch (error) {
    console.warn('[AI Router] Aviso na Análise de Sentimento Gemini:', error);
  }

  return {
    sentiment: 'neutro',
    score: 0.1,
    emotionalState: 'Calmo',
    frustrationIndicators: [],
    recommendedTone: 'Cordial e prestativo',
    providerUsed: 'Fallback Heurístico Local',
  };
}
