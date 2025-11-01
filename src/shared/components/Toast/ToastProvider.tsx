import { createContext, useCallback, useContext, useMemo, useState, type FC, type ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export type Toast = {
  id: string;
  type: ToastType;
  title?: string;
  message?: string;
  duration?: number;
};

type ToastContextValue = {
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const genId = () => Math.random().toString(36).slice(2, 9);

export const ToastProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = genId();
    const t: Toast = { id, duration: 3500, ...toast };
    setToasts((prev) => [...prev, t]);
    if (t.duration && t.duration > 0) {
      window.setTimeout(() => removeToast(id), t.duration);
    }
    return id;
  }, [removeToast]);

  const value = useMemo(() => ({ addToast, removeToast }), [addToast, removeToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toaster */}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-96 max-w-[calc(100%-2rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={[
              'pointer-events-auto flex items-start gap-3 rounded-lg border p-3 shadow-lg backdrop-blur',
              t.type === 'success' ? 'border-emerald-200 bg-emerald-50/90 text-emerald-900' :
              t.type === 'error' ? 'border-rose-200 bg-rose-50/90 text-rose-900' :
              'border-slate-200 bg-white/90 text-slate-900',
            ].join(' ')}
          >
            <div className="mt-0.5">
              {t.type === 'success' ? '✅' : t.type === 'error' ? '⚠️' : 'ℹ️'}
            </div>
            <div className="flex-1">
              {t.title ? <p className="text-sm font-semibold">{t.title}</p> : null}
              {t.message ? <p className="text-sm opacity-80">{t.message}</p> : null}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="ml-2 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-black/5"
            >
              Cerrar
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider');
  return ctx;
};

export default ToastProvider;
