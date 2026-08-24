'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, title: string, message?: string, duration: number = 2500) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newToast: ToastItem = { id, type, title, message, duration };
      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback((title: string, message?: string, duration: number = 2500) => showToast('success', title, message, duration), [showToast]);
  const error = useCallback((title: string, message?: string, duration: number = 2500) => showToast('error', title, message, duration), [showToast]);
  const warning = useCallback((title: string, message?: string, duration: number = 2500) => showToast('warning', title, message, duration), [showToast]);
  const info = useCallback((title: string, message?: string, duration: number = 2500) => showToast('info', title, message, duration), [showToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, success, error, warning, info, removeToast }}>
      {children}
      <div id="mediflux-toast-container" className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-md w-full">
        <AnimatePresence>
          {toasts.map((t) => {
            const iconMap = {
              success: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
              error: <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />,
              warning: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
              info: <Info className="w-5 h-5 text-sky-600 shrink-0" />,
            };

            const borderMap = {
              success: 'border-emerald-200 bg-emerald-50/95 text-emerald-950',
              error: 'border-rose-200 bg-rose-50/95 text-rose-950',
              warning: 'border-amber-200 bg-amber-50/95 text-amber-950',
              info: 'border-sky-200 bg-sky-50/95 text-sky-950',
            };

            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 15, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={`pointer-events-auto relative overflow-hidden flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-md ${borderMap[t.type]}`}
                id={`toast-${t.id}`}
              >
                {iconMap[t.type]}
                <div className="flex-1 text-sm">
                  <div className="font-bold tracking-tight text-xs sm:text-sm">{t.title}</div>
                  {t.message && <div className="mt-0.5 text-xs opacity-90 leading-relaxed font-normal">{t.message}</div>}
                </div>
                <button
                  onClick={() => removeToast(t.id)}
                  className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors shrink-0"
                  aria-label="Fechar notificação"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* 2.5s Visual Progress Countdown Bar */}
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: (t.duration || 2500) / 1000, ease: 'linear' }}
                  className={`absolute bottom-0 left-0 h-1 opacity-70 ${
                    t.type === 'success'
                      ? 'bg-emerald-600'
                      : t.type === 'error'
                      ? 'bg-rose-600'
                      : t.type === 'warning'
                      ? 'bg-amber-600'
                      : 'bg-sky-600'
                  }`}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast deve ser usado dentro de um ToastProvider');
  }
  return ctx;
}
