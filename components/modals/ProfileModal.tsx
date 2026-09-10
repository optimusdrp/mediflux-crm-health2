'use client';

import React, { useState, useEffect } from 'react';
import { apiService } from '@/lib/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { X, User as UserIcon, Lock, Save, Eye, EyeOff, ShieldCheck } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  medico: 'Profissional de Saúde / Médico',
  recepcao: 'Recepção',
  financeiro: 'Contador / Financeiro',
  terceirizado: 'Terceirizado',
};

/**
 * Página de Perfil do Usuário — NOVA. Antes, o avatar circular
 * (iniciais do nome) no cabeçalho não tinha nenhuma ação ao clicar.
 * Formulário construído com base nos campos que já existem de
 * verdade no cadastro de usuário (name, email, role, crm, specialty
 * — ver StoredUser na Lambda), mais troca de senha (exige a senha
 * atual, nunca permite trocar só por estar autenticado).
 */
export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { user: authUser } = useAuth();
  const { success, error } = useToast();

  const [name, setName] = useState('');
  const [crm, setCrm] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoadingProfile(true);
    apiService
      .getProfile()
      .then((res) => {
        setName(res.user.name || '');
        setCrm(res.user.crm || '');
        setSpecialty(res.user.specialty || '');
      })
      .catch((err: any) => {
        error('Falha ao carregar perfil', err?.message || 'Tente novamente.');
      })
      .finally(() => setIsLoadingProfile(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      error('Nome obrigatório', 'O nome não pode ficar em branco.');
      return;
    }
    setIsSavingProfile(true);
    try {
      await apiService.updateProfile({ name: name.trim(), crm, specialty });
      success('Perfil atualizado', 'Seus dados foram salvos com sucesso.');
    } catch (err: any) {
      error('Falha ao salvar perfil', err?.message || 'Tente novamente.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Preencha todos os campos de senha.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('A confirmação não corresponde à nova senha.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await apiService.changePassword(currentPassword, newPassword);
      success('Senha alterada', 'Sua senha foi atualizada com sucesso.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err?.message || 'Não foi possível trocar a senha.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-bold shrink-0">
              {authUser?.name ? authUser.name.split(' ').map((n) => n[0]).slice(0, 2).join('') : 'DR'}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Meu Perfil</h3>
              <p className="text-xs text-slate-500">{authUser?.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-6 text-xs">
          {/* Dados pessoais */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <UserIcon className="w-4 h-4 text-sky-600" /> Dados Pessoais
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">Nome completo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoadingProfile}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">E-mail</label>
              <input
                type="text"
                value={authUser?.email || ''}
                disabled
                className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-xl text-slate-500"
                title="O e-mail de acesso não pode ser alterado por aqui"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">Perfil de Acesso</label>
              <div className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-slate-50 rounded-xl text-slate-600">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                {ROLE_LABELS[authUser?.role || ''] || authUser?.role}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">CRM (se aplicável)</label>
                <input
                  type="text"
                  placeholder="CRM/UF 000000"
                  value={crm}
                  onChange={(e) => setCrm(e.target.value)}
                  disabled={isLoadingProfile}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Especialidade</label>
                <input
                  type="text"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  disabled={isLoadingProfile}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl disabled:opacity-50"
                />
              </div>
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={isSavingProfile || isLoadingProfile}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" /> {isSavingProfile ? 'Salvando...' : 'Salvar Dados'}
            </button>
          </div>

          <div className="border-t border-slate-200" />

          {/* Troca de senha */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <Lock className="w-4 h-4 text-sky-600" /> Alterar Senha
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">Senha atual</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Nova senha</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Confirmar nova senha</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>

            <button
              onClick={() => setShowPasswords((prev) => !prev)}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 transition-colors"
            >
              {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showPasswords ? 'Ocultar senhas' : 'Mostrar senhas'}
            </button>

            {passwordError && (
              <p className="text-rose-600 font-semibold bg-rose-50 border border-rose-200 rounded-lg p-2">{passwordError}</p>
            )}

            <button
              onClick={handleChangePassword}
              disabled={isChangingPassword}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold transition-colors disabled:opacity-50"
            >
              <Lock className="w-3.5 h-3.5" /> {isChangingPassword ? 'Alterando...' : 'Alterar Senha'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
