// use-toast.tsx
import { X } from 'lucide-react';
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

export interface ToastProps {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
  duration?: number;
  onClose?: () => void;
}

interface ToastContextValue {
  toast: (props: ToastProps) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface Toast extends ToastProps {
  id: string;
}

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // Stable identity: `toast` is used in effect dependency arrays across the app,
  // so recreating it each render would re-trigger those effects.
  const toast = useCallback(
    (props: ToastProps) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: Toast = { id, ...props };

      setToasts(prev => [...prev, newToast]);

      // Auto dismiss after duration
      if (props.duration !== 0) {
        setTimeout(() => {
          dismissToast(id);
        }, props.duration || 5000);
      }
    },
    [dismissToast]
  );

  const contextValue = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {/* Toast container - fixed at the bottom right */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[10050] flex flex-col gap-2">
          {toasts.map(t => (
            <div
              key={t.id}
              className={`p-4 rounded-md shadow-md transition-all duration-300 ease-in-out flex items-start gap-3 
                ${t.variant === 'destructive' ? 'bg-red-100 text-red-900' : 'bg-white text-gray-900 border'}`}
              style={{ minWidth: '300px', maxWidth: '500px' }}
            >
              <div className="flex-1">
                {t.title && <h3 className="font-medium">{t.title}</h3>}
                {t.description && <p className="text-sm opacity-80 mt-1">{t.description}</p>}
              </div>
              <button
                onClick={() => {
                  dismissToast(t.id);
                  t.onClose?.();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
};

export default useToast;
