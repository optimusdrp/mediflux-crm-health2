/**
 * Sanitizador de Prompts Clínicos
 * Previne tentativas de Prompt Injection, quebra de guardrails médicos e vazamento de instruções do sistema.
 */

export interface SanitizationResult {
  sanitizedText: string;
  injectionDetected: boolean;
  threatLevel: 'none' | 'low' | 'high';
  flags: string[];
}

const INJECTION_PATTERNS: { regex: RegExp; name: string; severity: 'low' | 'high' }[] = [
  { regex: /ignore\s+(all\s+)?(previous|prior)\s+instructions/i, name: 'ignore_instructions', severity: 'high' },
  { regex: /esqueça\s+(todas\s+as\s+)?instruções\s+anteriores/i, name: 'esquece_instrucoes_pt', severity: 'high' },
  { regex: /you\s+are\s+now\s+(a|an|in)\s+mode/i, name: 'jailbreak_persona', severity: 'high' },
  { regex: /system\s+prompt|system\s+instructions/i, name: 'system_leak_probe', severity: 'low' },
  { regex: /override\s+clinical\s+rules/i, name: 'clinical_override', severity: 'high' },
  { regex: /classifique\s+como\s+baixa\s+urgência\s+sempre/i, name: 'triage_hijack', severity: 'high' },
  { regex: /desconsidere\s+os\s+sintomas/i, name: 'symptom_bypass', severity: 'high' },
  { regex: /sudo\s+|admin_mode|bypass_security/i, name: 'cmd_injection', severity: 'high' },
];

export function sanitizeClinicalPrompt(rawInput: string): SanitizationResult {
  if (!rawInput || typeof rawInput !== 'string') {
    return {
      sanitizedText: '',
      injectionDetected: false,
      threatLevel: 'none',
      flags: [],
    };
  }

  const flags: string[] = [];
  let threatLevel: 'none' | 'low' | 'high' = 'none';

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.regex.test(rawInput)) {
      flags.push(pattern.name);
      if (pattern.severity === 'high') {
        threatLevel = 'high';
      } else if (threatLevel === 'none') {
        threatLevel = 'low';
      }
    }
  }

  // Remove caracteres de controle estranhos mantendo acentuação e pontuação padrão em português
  const sanitizedText = rawInput
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .trim();

  return {
    sanitizedText,
    injectionDetected: flags.length > 0,
    threatLevel,
    flags,
  };
}
