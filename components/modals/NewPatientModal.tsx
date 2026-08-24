'use client';

import React, { useState } from 'react';
import { Patient } from '@/lib/types';
import { apiService } from '@/lib/services/api';
import { useToast } from '@/contexts/ToastContext';
import { UserPlus, X, AlertTriangle, ShieldCheck } from 'lucide-react';

interface NewPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPatientCreated: (patient: Patient) => void;
}

export function NewPatientModal({ isOpen, onClose, onPatientCreated }: NewPatientModalProps) {
  const { success, error, warning } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    cpf: '',
    birthDate: '',
    healthInsurance: 'Unimed',
    planNumber: '',
    specialty: 'Cardiologia',
    originChannel: 'whatsapp' as const,
    urgency: 'media' as const,
    notes: '',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) {
      error('Campos obrigatórios', 'Por favor preencha nome e telefone.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiService.createPatient(formData);
      success('Paciente Cadastrado', `${response.patient.name} foi inserido no sistema com sucesso.`);

      if (response.usageWarning?.overLimit) {
        warning(
          'Limite de Atendimentos Excedido',
          `Sua clínica atingiu ${response.usageWarning.currentCount} / ${response.usageWarning.maxAllowed} atendimentos no período.`
        );
      }

      onPatientCreated(response.patient);
      onClose();
    } catch (err: any) {
      error('Falha no Cadastro', err.message || 'Erro ao criar novo paciente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Novo Atendimento / Paciente</h3>
              <p className="text-xs text-slate-400">Cadastro compatível com normas de segurança e LGPD</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nome Completo *</label>
            <input
              type="text"
              required
              placeholder="Ex: João da Silva Santos"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Telefone / WhatsApp *</label>
              <input
                type="text"
                required
                placeholder="(11) 98765-4321"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">CPF (Opcional)</label>
              <input
                type="text"
                placeholder="123.456.789-00"
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Convênio / Pagamento</label>
              <select
                value={formData.healthInsurance}
                onChange={(e) => setFormData({ ...formData, healthInsurance: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              >
                <option value="Particular">Particular</option>
                <option value="Unimed">Unimed</option>
                <option value="Bradesco Saúde">Bradesco Saúde</option>
                <option value="SulAmérica">SulAmérica</option>
                <option value="Amil">Amil</option>
                <option value="Porto Seguro">Porto Seguro</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Especialidade Desejada</label>
              <select
                value={formData.specialty}
                onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              >
                <option value="Cardiologia">Cardiologia</option>
                <option value="Dermatologia">Dermatologia</option>
                <option value="Ortopedia">Ortopedia</option>
                <option value="Ginecologia">Ginecologia</option>
                <option value="Neurologia">Neurologia</option>
                <option value="Clínica Geral">Clínica Geral</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Canal de Origem</label>
              <select
                value={formData.originChannel}
                onChange={(e) => setFormData({ ...formData, originChannel: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              >
                <option value="whatsapp">WhatsApp Oficial</option>
                <option value="instagram">Instagram Direct</option>
                <option value="webchat">WebChat Portal</option>
                <option value="telefone">Ligação Telefônica</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Urgência Inicial</label>
              <select
                value={formData.urgency}
                onChange={(e) => setFormData({ ...formData, urgency: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              >
                <option value="baixa">Baixa (Rotina/Verde)</option>
                <option value="media">Média (Amarelo)</option>
                <option value="alta">Alta (Laranja)</option>
                <option value="critica">Crítica (Vermelho)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Queixa Principal / Observações</label>
            <textarea
              rows={3}
              placeholder="Descreva a queixa do paciente ou motivo do contato..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="px-6 py-4 -mx-6 -mb-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold shadow-xs transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Cadastrando...' : 'Criar Atendimento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
