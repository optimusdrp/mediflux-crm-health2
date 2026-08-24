'use client';

import React, { useState, useEffect } from 'react';
import { AutomationRule } from '@/lib/types';
import { apiService } from '@/lib/services/api';
import { useToast } from '@/contexts/ToastContext';
import {
  Zap,
  Plus,
  CheckCircle2,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  MessageSquare,
  Clock,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

export function AutomacoesView() {
  const { success, error, info } = useToast();
  const [automations, setAutomations] = useState<AutomationRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New automation modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTrigger, setNewTrigger] = useState('mensagem_recebida');
  const [newAction, setNewAction] = useState('executar_triagem_ia');

  useEffect(() => {
    let isMounted = true;
    const fetchAutomations = async () => {
      try {
        const res = await apiService.getAutomationRules();
        if (isMounted) {
          setAutomations(res.automations || []);
        }
      } catch {
        // Ignora silenciosamente para preservar regras locais
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    fetchAutomations();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggle = async (rule: AutomationRule) => {
    try {
      const res = await apiService.updateAutomationRule(rule.id, { active: !rule.active });
      setAutomations((prev) => prev.map((a) => (a.id === rule.id ? res.automation : a)));
      info('Automação Atualizada', `${rule.name} ${!rule.active ? 'ativada' : 'pausada'}.`);
    } catch (err: any) {
      error('Erro ao alternar automação', err.message);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const res = await apiService.createAutomationRule({
        name: newName,
        trigger: newTrigger,
        actions: [newAction],
        active: true,
      });

      setAutomations((prev) => [...prev, res.automation]);
      success('Automação Criada', 'Fluxo automatizado configurado com sucesso.');
      setIsModalOpen(false);
      setNewName('');
    } catch (err: any) {
      error('Erro ao criar automação', err.message);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-slate-900">Automações Clínicas & Roteamento</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Gatilhos inteligentes para lembretes de consulta, classificação Manchester automática e follow-ups.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Nova Regra de Automação
        </button>
      </div>

      {/* Grid of Automation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {automations.map((a) => (
          <div
            key={a.id}
            className={`p-5 rounded-2xl border transition-all ${
              a.active ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-50 border-slate-200 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    a.active ? 'bg-amber-50 text-amber-600' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900">{a.name}</h4>
                  <span className="text-[10px] text-slate-400 font-mono">ID: {a.id}</span>
                </div>
              </div>

              <button
                onClick={() => handleToggle(a)}
                className="text-slate-600 hover:text-slate-900 transition-colors"
                title={a.active ? 'Pausar automação' : 'Ativar automação'}
              >
                {a.active ? (
                  <ToggleRight className="w-8 h-8 text-sky-600" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-slate-400" />
                )}
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1.5 mb-4">
              <div className="flex items-center gap-2 text-slate-600">
                <span className="font-semibold text-slate-800">Gatilho:</span>
                <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px] font-mono">
                  {a.trigger}
                </span>
              </div>
              <div className="flex items-start gap-2 text-slate-600">
                <span className="font-semibold text-slate-800 shrink-0">Ações:</span>
                <div className="flex flex-wrap gap-1">
                  {a.actions.map((act, idx) => (
                    <span
                      key={idx}
                      className="bg-sky-50 text-sky-800 border border-sky-200 px-2 py-0.5 rounded text-[11px]"
                    >
                      {act}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Performance Footer */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Taxa de Sucesso: <strong>{a.successRate}%</strong></span>
              </div>
              <div>
                <span>{a.executionCount} execuções registradas</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Nova Automação */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Configurar Nova Automação</h3>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome do Fluxo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Confirmação de Consulta 24h antes"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Evento de Disparo (Trigger)</label>
                <select
                  value={newTrigger}
                  onChange={(e) => setNewTrigger(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="mensagem_recebida">Nova Mensagem Recebida</option>
                  <option value="paciente_criado">Novo Paciente Cadastrado</option>
                  <option value="consulta_agendada">Consulta Agendada no PEP</option>
                  <option value="urgencia_alta_detectada">Urgência Alta/Crítica Detectada</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ação Automatizada</label>
                <select
                  value={newAction}
                  onChange={(e) => setNewAction(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="executar_triagem_ia">Disparar Triagem Clínica Dual IA</option>
                  <option value="enviar_mensagem_whatsapp">Enviar WhatsApp de Boas-Vindas</option>
                  <option value="notificar_equipe_medica">Notificar Médico Plantonista</option>
                  <option value="solicitar_documentos">Enviar Link de Documentos LGPD</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold"
                >
                  Salvar Regra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
