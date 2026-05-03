"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastTone = "success" | "error" | "info";

interface Toast {
  id: string;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  notify: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, tone: ToastTone = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev, { id, tone, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4500);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[70] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
        {toasts.map((toast, index) => (
          <div
            key={toast.id}
            style={{ animationDelay: `${index * 80}ms` }}
            className={`reveal-up rounded-sm border px-4 py-3 text-xs shadow-lg backdrop-blur-sm transition-soft ${
              toast.tone === "success"
                ? "border-[#2a7a4a] bg-[#111111ea]"
                : toast.tone === "error"
                  ? "border-[#7a2a2a] bg-[#111111ea]"
                  : "border-[#1e1e1e] bg-[#111111ea]"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
