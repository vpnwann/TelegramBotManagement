import { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import clsx from "clsx";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none",
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm",
        variant === "primary" &&
          "bg-accent text-white hover:bg-accent-deep",
        variant === "secondary" &&
          "bg-surface text-ink border border-line hover:border-ink-muted",
        variant === "ghost" && "text-ink-muted hover:text-ink hover:bg-canvas",
        variant === "danger" &&
          "bg-surface text-danger border border-line hover:bg-danger-soft hover:border-danger",
        className
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 focus:border-accent",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={clsx(
        "w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 focus:border-accent",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx(
        "w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent",
        className
      )}
      {...props}
    />
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-ink-muted">{children}</label>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={clsx("rounded border border-line bg-surface", className)}>{children}</div>
  );
}

export function StatNumber({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <div className="text-2xl font-semibold tabular-nums text-ink">{value}</div>
      <div className="mt-1 text-xs text-ink-muted">{label}</div>
    </Card>
  );
}

const statusStyles: Record<string, string> = {
  active: "bg-success-soft text-success",
  sent: "bg-success-soft text-success",
  inactive: "bg-line text-ink-muted",
  draft: "bg-line text-ink-muted",
  cancelled: "bg-line text-ink-muted",
  scheduled: "bg-warning-soft text-warning",
  sending: "bg-accent-soft text-accent-deep",
  pending: "bg-warning-soft text-warning",
  failed: "bg-danger-soft text-danger",
};

export function StatusBadge({ status }: { status: string }) {
  const style = statusStyles[status] || "bg-line text-ink-muted";
  return (
    <span className={clsx("inline-flex items-center rounded px-2 py-0.5 text-xs font-medium capitalize", style)}>
      {status}
    </span>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint && <p className="max-w-xs text-xs text-ink-muted">{hint}</p>}
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
