import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Petits composants d'interface partagés. Volontairement sans dépendance. */

export function Button({
  variant = "ghost",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger"; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" ? "h-7 px-2 text-xs" : "h-8 px-3 text-sm",
        variant === "primary" && "bg-accent text-white hover:bg-accent-hover",
        variant === "ghost" && "text-ink-muted hover:bg-panel-hover hover:text-ink",
        variant === "danger" && "text-red-300 hover:bg-red-500/15 hover:text-red-200",
        className,
      )}
      {...props}
    />
  );
}

export function IconButton({
  label,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={clsx(
        "inline-flex size-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-panel-hover hover:text-ink disabled:opacity-30",
        className,
      )}
      {...props}
    />
  );
}

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="border-line border-b px-4 py-3">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="font-semibold text-[11px] text-ink-faint uppercase tracking-wider">{title}</h3>
        {actions}
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] items-center gap-2 text-xs">
      <span className="truncate text-ink-muted">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const inputClass =
  "h-7 w-full rounded-md border border-line bg-canvas px-2 text-xs text-ink outline-none focus:border-accent";

export function NumberInput({
  value,
  onChange,
  step = 1,
  min,
  max,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <label className="relative block">
      <input
        type="number"
        className={clsx(inputClass, suffix && "pr-7")}
        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = e.currentTarget.valueAsNumber;
          if (Number.isFinite(v)) onChange(v);
        }}
      />
      {suffix ? (
        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px] text-ink-faint">
          {suffix}
        </span>
      ) : null}
    </label>
  );
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  format = (v: number) => v.toFixed(2),
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        className="w-full accent-accent"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.currentTarget.valueAsNumber)}
      />
      <span className="w-10 shrink-0 text-right text-[11px] text-ink-muted tabular-nums">{format(value)}</span>
    </div>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select className={inputClass} value={value} onChange={(e) => onChange(e.currentTarget.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function TextInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input className={inputClass} value={value} onChange={(e) => onChange(e.currentTarget.value)} />;
}

export function TextArea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      className={clsx(inputClass, "h-auto min-h-16 resize-y py-1.5")}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
    />
  );
}

export function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        className="h-7 w-9 shrink-0 cursor-pointer rounded border border-line bg-transparent"
        value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff"}
        onChange={(e) => onChange(e.currentTarget.value)}
      />
      <input className={inputClass} value={value} onChange={(e) => onChange(e.currentTarget.value)} />
    </div>
  );
}

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <input
      type="checkbox"
      className="size-4 cursor-pointer accent-accent"
      checked={checked}
      onChange={(e) => onChange(e.currentTarget.checked)}
    />
  );
}
