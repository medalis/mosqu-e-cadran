"use client";
import { forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// ---------- Button ----------
type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; loading?: boolean }>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...rest }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 disabled:cursor-not-allowed disabled:opacity-60",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        variant === "primary" && "bg-gold-600 text-white hover:bg-gold-700",
        variant === "secondary" && "bg-teal-600 text-white hover:bg-teal-700",
        variant === "outline" && "border border-stone-300 bg-white text-stone-800 hover:bg-stone-50",
        variant === "ghost" && "text-stone-700 hover:bg-stone-100",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        className,
      )}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

export function Spinner({ className }: { className?: string }) {
  return <svg className={cn("animate-spin text-current", className ?? "h-5 w-5")} viewBox="0 0 24 24" fill="none" aria-hidden><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>;
}

// ---------- Inputs ----------
const inputCls = "block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-200 disabled:bg-stone-100 aria-[invalid=true]:border-red-400";
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...rest }, ref) => <input ref={ref} className={cn(inputCls, className)} {...rest} />);
Input.displayName = "Input";
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...rest }, ref) => <textarea ref={ref} className={cn(inputCls, "min-h-24", className)} {...rest} />);
Textarea.displayName = "Textarea";
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...rest }, ref) => <select ref={ref} className={cn(inputCls, "pr-8", className)} {...rest}>{children}</select>);
Select.displayName = "Select";
export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }>(({ label, className, ...rest }, ref) => (
  <label className={cn("inline-flex cursor-pointer items-center gap-2 text-sm text-stone-800", className)}>
    <input ref={ref} type="checkbox" className="h-4 w-4 rounded border-stone-300 text-gold-600 accent-gold-600 focus:ring-gold-400" {...rest} />
    <span>{label}</span>
  </label>
));
Checkbox.displayName = "Checkbox";

export function Field({ label, hint, error, children, className, required }: { label: ReactNode; hint?: ReactNode; error?: string; children: ReactNode; className?: string; required?: boolean }) {
  return (
    <div className={cn("space-y-1", className)}>
      <label className="block text-sm font-medium text-stone-700">{label}{required && <span className="text-red-500"> *</span>}</label>
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : hint ? <p className="text-xs text-stone-500">{hint}</p> : null}
    </div>
  );
}

// ---------- Card / Badge ----------
export function Card({ title, description, actions, children, className, padded = true }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cn("rounded-xl border border-stone-200 bg-white shadow-sm", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
          <div>
            {title && <h2 className="text-base font-semibold text-stone-900">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-stone-500">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info" | "gold"; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", tone === "neutral" && "bg-stone-100 text-stone-700", tone === "success" && "bg-teal-50 text-teal-700 ring-1 ring-teal-200", tone === "warning" && "bg-amber-50 text-amber-800 ring-1 ring-amber-200", tone === "danger" && "bg-red-50 text-red-700 ring-1 ring-red-200", tone === "info" && "bg-sky-50 text-sky-700 ring-1 ring-sky-200", tone === "gold" && "bg-gold-50 text-gold-700 ring-1 ring-gold-200", className)}>{children}</span>
  );
}

// ---------- Table ----------
export function Table({ head, children, className }: { head: ReactNode[]; children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto scrollbar-thin", className)}>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-stone-200 bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">{head.map((h, i) => <th key={i} className="px-4 py-2.5 whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-stone-100">{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => <td className={cn("px-4 py-2.5 align-middle", className)}>{children}</td>;

// ---------- States ----------
export function Loading({ label = "Chargement…" }: { label?: string }) {
  return <div className="flex items-center gap-3 py-10 text-sm text-stone-500 justify-center"><Spinner className="h-5 w-5 text-gold-600" />{label}</div>;
}
export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <span>{message}</span>
      {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Réessayer</Button>}
    </div>
  );
}
export function Empty({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-stone-300 px-6 py-10 text-center">
      <div className="text-sm font-medium text-stone-800">{title}</div>
      {description && <div className="max-w-sm text-sm text-stone-500">{description}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ---------- Dialog ----------
export function Dialog({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 p-4 pt-[6vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal className={cn("w-full rounded-xl bg-white shadow-xl", wide ? "max-w-3xl" : "max-w-lg")}>
        <header className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <h3 className="text-base font-semibold text-stone-900">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label="Fermer">✕</button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-stone-100 px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: Array<{ value: T; label: string }> }) {
  return (
    <div className="mb-4 flex gap-1 border-b border-stone-200">
      {items.map((it) => (
        <button key={it.value} onClick={() => onChange(it.value)} className={cn("-mb-px border-b-2 px-4 py-2 text-sm font-medium", value === it.value ? "border-gold-600 text-gold-700" : "border-transparent text-stone-500 hover:text-stone-800")}>{it.label}</button>
      ))}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "gold" | "teal" | "neutral" }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold", tone === "gold" ? "text-gold-700" : tone === "teal" ? "text-teal-700" : "text-stone-900")}>{value}</div>
      {hint && <div className="mt-1 text-xs text-stone-500">{hint}</div>}
    </div>
  );
}
