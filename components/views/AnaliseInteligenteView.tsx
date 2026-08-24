'use client';

import React, { useState } from 'react';
import { apiService } from '@/lib/services/api';
import { TriageResult, AutoTagResult, LeadQualificationResult, SentimentAnalysisResult } from '@/lib/types';
import { useToast } from '@/contexts/ToastContext';
import {
  Sparkles,
  HeartPulse,
  Tags,
  TrendingUp,
  Smile,
  AlertTriangle,
  CheckCircle2,
  Send,
  Zap,
  ShieldCheck,
} from 'lucide-react';

export function AnaliseInteligenteView() {
  const { success, error, warning } = useToast();

  const [activeTab, setActiveTab] = useState<'triagem' | 'tags' | 'leads' | 'sentimento'>('triagem');

  // Triagem state
  const [triageText, setTriageText] = useState(
    'Paciente relata dor torácica intensa em aperto há 40 minutos, irradiando para o braço esquerdo, acompanhada de sudorese fria e falta de ar.'
  );
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [isAnalyzingTriage, setIsAnalyzingTriage] = useState(false);

  // Auto-tag state
  const [tagsInput, setTagsInput] = useState(
    'Olá, gostaria de agendar uma consulta com cardiologista para fazer eletrocardiograma e teste ergométrico. Tenho convênio Unimed.'
  );
  const [tagsResult, setTagsResult] = useState<AutoTagResult | null>(null);
  const [isAnalyzingTags, setIsAnalyzingTags] = useState(false);

  // Preset Clinical Examples
  const presets = [
    {
      title: 'Dor Torácica Crítica (Manchester Vermelho/Laranja)',
      text: 'Paciente relata dor no peito súbita em aperto, sudorese fria e irradiação para o membro superior esquerdo.',
    },
    {
      title: 'Febre Pediátrica Urgente (Manchester Amarelo)',
      text: 'Criança de 3 anos com febre de 39°C persistente há 2 dias, recusa alimentar e choro contínuo.',
    },
    {
      title: 'Consulta de Rotina / Preventiva (Manchester Verde)',
      text: 'Boa tarde! Gostaria de agendar um check-up preventivo com cardiologista para o próximo mês.',
    },
  ];

  const handleRunTriage = async () => {
    if (!triageText.trim()) return;
    setIsAnalyzingTriage(true);
    try {
      const res = await apiService.analyzeMessageTriage(triageText);
      setTriageResult(res.triage);
      success('Triagem IA Executada', `Resultado: ${res.triage.manchesterCategory} (${res.triage.urgency.toUpperCase()})`);
    } catch (err: any) {
      if (err.name === 'FeatureNotAvailableError') {
        warning('Recurso Não Incluso', err.message);
      } else {
        error('Erro na Triagem', err.message);
      }
    } finally {
      setIsAnalyzingTriage(false);
    }
  };

  const handleRunTags = async () => {
    if (!tagsInput.trim()) return;
    setIsAnalyzingTags(true);
    try {
      const res = await apiService.autoTagMessages([tagsInput]);
      setTagsResult(res.result);
      success('Classificação Concluída', `${res.result.tags.length} tags identificadas.`);
    } catch (err: any) {
      error('Erro ao gerar tags', err.message);
    } finally {
      setIsAnalyzingTags(false);
    }
  };

  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    vermelho: { bg: 'bg-red-600', text: 'text-red-700', border: 'border-red-200 bg-red-50' },
    laranja: { bg: 'bg-orange-500', text: 'text-orange-700', border: 'border-orange-200 bg-orange-50' },
    amarelo: { bg: 'bg-amber-400', text: 'text-amber-800', border: 'border-amber-200 bg-amber-50' },
    verde: { bg: 'bg-emerald-500', text: 'text-emerald-700', border: 'border-emerald-200 bg-emerald-50' },
    azul: { bg: 'bg-sky-500', text: 'text-sky-700', border: 'border-sky-200 bg-sky-50' },
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <h2 className="text-lg font-bold text-slate-900">Laboratório de Inteligência Artificial & Triagem Dual</h2>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          Ambiente de teste e homologação do roteador dual (Bedrock + Gemini + Heurística Manchester) com guardrails clínicos.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('triagem')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'triagem'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <HeartPulse className="w-3.5 h-3.5" /> 1. Triagem Clínica Manchester
        </button>

        <button
          onClick={() => setActiveTab('tags')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'tags'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Tags className="w-3.5 h-3.5" /> 2. Auto-Tagging & Especialidades
        </button>
      </div>

      {/* Tab 1: Triagem Clínica Dual */}
      {activeTab === 'triagem' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Sandbox */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
              Simulador de Queixa Clínica do Paciente
            </h3>

            {/* Presets */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400">Exemplos rápidos de teste:</span>
              <div className="flex flex-col gap-1.5">
                {presets.map((pr, idx) => (
                  <button
                    key={idx}
                    onClick={() => setTriageText(pr.text)}
                    className="text-left p-2 bg-slate-50 hover:bg-purple-50 text-slate-700 hover:text-purple-900 border border-slate-200 rounded-lg text-[11px] transition-colors"
                  >
                    <strong>{pr.title}:</strong> {pr.text.slice(0, 75)}...
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-xs text-slate-700 mb-1">
                Texto / Relato da Queixa do Paciente:
              </label>
              <textarea
                rows={5}
                value={triageText}
                onChange={(e) => setTriageText(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                placeholder="Insira os sintomas ou queixa do paciente..."
              />
            </div>

            <button
              onClick={handleRunTriage}
              disabled={isAnalyzingTriage}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {isAnalyzingTriage ? 'Roteando Provedores de IA...' : 'Processar Triagem Clínica Dual IA'}
            </button>
          </div>

          {/* Result Output Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider mb-3">
                Resultado da Avaliação Clínica & Guardrails
              </h3>

              {triageResult ? (
                <div className="space-y-4 text-xs">
                  {/* Manchester Badge Banner */}
                  <div
                    className={`p-4 rounded-xl border ${
                      colorMap[triageResult.manchesterColor || 'verde']?.border || 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-3.5 h-3.5 rounded-full ${
                            colorMap[triageResult.manchesterColor || 'verde']?.bg || 'bg-slate-500'
                          }`}
                        />
                        <span className="font-extrabold text-sm uppercase">
                          {triageResult.manchesterCategory}
                        </span>
                      </div>
                      <span className="font-bold uppercase text-[11px] px-2 py-0.5 rounded bg-white border">
                        Urgência: {triageResult.urgency}
                      </span>
                    </div>

                    <div className="mt-2 text-slate-800 leading-relaxed font-medium">
                      {triageResult.recommendedAction}
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[11px] text-slate-400">Provedor Utilizado:</span>
                      <div className="font-bold text-purple-800 uppercase mt-0.5">
                        {triageResult.providerUsed}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[11px] text-slate-400">Confiança do Diagnóstico:</span>
                      <div className="font-bold text-slate-800 mt-0.5">
                        {Math.round(triageResult.confidence * 100)}%
                      </div>
                    </div>
                  </div>

                  {/* Guardrail: Human review */}
                  <div
                    className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                      triageResult.requiresHumanReview
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    }`}
                  >
                    {triageResult.requiresHumanReview ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                    <div>
                      <div className="font-bold">
                        {triageResult.requiresHumanReview
                          ? 'Revisão Humana Obrigatória (Guardrail Ativo)'
                          : 'Caso de Rotina Liberado para Atendimento'}
                      </div>
                      <div className="text-[11px] opacity-80 mt-0.5">
                        {triageResult.requiresHumanReview
                          ? 'O sistema bloqueou disparo automático sem aprovação de um médico ou atendente.'
                          : 'Pode ser respondido automaticamente conforme regras da clínica.'}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400 text-xs">
                  Clique em &quot;Processar Triagem Clínica&quot; para visualizar a análise detalhada.
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Protocolo de Manchester Validado
              </span>
              <span>Gemini 2.5 Flash / Bedrock Claude 3.5</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Auto-tagging */}
      {activeTab === 'tags' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
              Classificação Automática de Tags & Especialidades
            </h3>

            <div>
              <label className="block font-semibold text-xs text-slate-700 mb-1">
                Mensagem do Paciente:
              </label>
              <textarea
                rows={4}
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
              />
            </div>

            <button
              onClick={handleRunTags}
              disabled={isAnalyzingTags}
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Tags className="w-4 h-4" />
              {isAnalyzingTags ? 'Extraindo Tags...' : 'Gerar Tags Automáticas'}
            </button>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider mb-3">
              Tags & Especialidade Identificada
            </h3>

            {tagsResult ? (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-sky-50 rounded-xl border border-sky-200">
                  <span className="text-slate-500">Especialidade Sugerida:</span>
                  <div className="font-bold text-sm text-sky-900 mt-0.5">
                    {tagsResult.specialtySuggested || 'Clínica Geral'}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 font-semibold mb-2 block">Tags Extraídas:</span>
                  <div className="flex flex-wrap gap-2">
                    {tagsResult.tags.map((t, idx) => (
                      <span
                        key={idx}
                        className="bg-purple-100 text-purple-900 px-2.5 py-1 rounded-lg font-bold text-xs"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400 text-xs">
                Insira o texto e clique em &quot;Gerar Tags Automáticas&quot;.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
