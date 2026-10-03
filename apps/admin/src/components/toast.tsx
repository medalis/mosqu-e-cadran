"use client";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "success" | "error" | "info";
interface Toast { id: number; tone: Tone; title: string; description?: string }
interface Ctx { toast: (t: Omit<Toast, "id">) => void; success: (title: string, description?: string) => void; error: (title: string, description?: string) => void }

const ToastCtx = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++seq.current;
    setItems((xs) => [...xs, { ...t, id }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), t.tone === "error" ? 7000 : 4000);
  }, []);
  const value = useMemo<Ctx>(() => ({ toast, success: (title, description) => toast({ tone: "success", title, description }), error: (title, description) => toast({ tone: "error", title, description }) }), [toast]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-80 flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} role="status" className={cn("pointer-events-auto rounded-lg border bg-white p-3 text-sm shadow-lg", t.tone === "success" && "border-teal-200", t.tone === "error" && "border-red-200", t.tone === "info" && "border-stone-200")}>
            <div className="flex items-start gap-2">
              <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", t.tone === "success" && "bg-teal-500", t.tone === "error" && "bg-red-500", t.tone === "info" && "bg-stone-400")} />
              <div className="min-w-0">
                <div className="font-medium text-stone-900">{t.title}</div>
                {t.description && <div className="mt-0.5 text-stone-600 break-words">{t.description}</div>}
              </div>
              <button onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))} className="ml-auto text-stone-400 hover:text-stone-700" aria-label="Fermer">×</button>
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast hors ToastProvider");
  return ctx;
}
