'use client';

import React, { useState, useEffect } from 'react';
import { AuditLog, LGPDCategory } from '@/lib/types';
import { apiService } from '@/lib/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  ShieldCheck,
  Search,
  Filter,
  Download,
  UserCheck,
  Lock,
  FileSpreadsheet,
  AlertCircle,
  Eye,
} from 'lucide-react';

export function AuditoriaLGPDView() {
  const { user, hasActionPermission } = useAuth();
  const { success, error, info } = useToast();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [category, setCategory] = useState<string>('todos');
  const [search, setSearch] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchLogs = async () => {
      try {
        const res = await apiService.getAuditLogs({ category, search });
        if (isMounted) {
          setLogs(res.logs || []);
        }
      } catch {
        // Fallback silencioso sem travar visualização
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchLogs();
    return () => {
      isMounted = false;
    };
  }, [category, search]);

  const handleExport = () => {
    const jsonStr = JSON.stringify(logs, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mediflux_auditoria_lgpd_${Date.now()}.json`;
    a.click();
    success('Exportação Concluída', 'Relatório imutável de não-repúdio gerado com sucesso.');
  };

  const categoryBadge: Record<LGPDCategory, { label: string; color: string }> = {
    acesso_dados: { label: 'Acesso a Dados', color: 'bg-sky-50 text-sky-800 border-sky-200' },
    alteracao_cadastral: { label: 'Alteração Cadastral', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
    consentimento: { label: 'Consentimento', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    exclusao: { label: 'Exclusão / Anonimização', color: 'bg-rose-50 text-rose-800 border-rose-200' },
    exportacao: { label: 'Exportação de Dados', color: 'bg-amber-50 text-amber-800 border-amber-200' },
    unificacao: { label: 'Unificação de Prontuário', color: 'bg-purple-50 text-purple-800 border-purple-200' },
    login: { label: 'Autenticação / Login', color: 'bg-slate-100 text-slate-800 border-slate-300' },
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">Trilha de Auditoria & Conformidade LGPD</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro imutável de não-repúdio: rastreamento de acessos, edições, exportações e termos de consentimento.
          </p>
        </div>

        <button
          onClick={handleExport}
          className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5"
        >
          <Download className="w-4 h-4 text-slate-500" /> Exportar Log de Não-Repúdio
        </button>
      </div>

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por ação, paciente ou email do autor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 w-full sm:w-auto"
        >
          <option value="todos">Todas as Categorias LGPD</option>
          <option value="acesso_dados">Acesso a Dados</option>
          <option value="alteracao_cadastral">Alteração Cadastral</option>
          <option value="consentimento">Consentimento</option>
          <option value="exclusao">Exclusão / Anonimização</option>
        </select>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">Ação Executada</th>
                <th className="p-3.5">Alvo / Paciente</th>
                <th className="p-3.5">Autor (Extraído do JWT)</th>
                <th className="p-3.5">IP de Origem</th>
                <th className="p-3.5">Categoria LGPD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Nenhum registro de auditoria encontrado com os filtros informados.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const cat = (log.lgpdCategory && categoryBadge[log.lgpdCategory]) || categoryBadge.acesso_dados;

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                      </td>
                      <td className="p-3.5 font-bold text-slate-900">{log.action}</td>
                      <td className="p-3.5 text-slate-800">{log.target}</td>
                      <td className="p-3.5">
                        <div className="font-medium text-slate-900">{log.authorEmail}</div>
                        <div className="text-[10px] text-slate-400 uppercase">{log.authorRole}</div>
                      </td>
                      <td className="p-3.5 font-mono text-[11px] text-slate-500">{log.ip}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${cat.color}`}>
                          {cat.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
