import { clsx } from 'clsx';

type BadgeVariant = 'critical' | 'warning' | 'info' | 'normal' | 'success';

interface BadgeProps {
  variant: BadgeVariant;
  label: string;
  className?: string;
}

export default function Badge({ variant, label, className }: BadgeProps) {
  const variantStyles = {
    critical: 'bg-[#dc26261a] text-[var(--color-danger)] border border-[#dc262633]',
    warning: 'bg-[#d976061a] text-[var(--color-warning)] border border-[#d9760633]',
    info: 'bg-[#2563eb1a] text-[var(--color-chart-blue)] border border-[#2563eb33]',
    normal: 'bg-[#16a34a1a] text-[var(--color-success)] border border-[#16a34a33]',
    success: 'bg-[#16a34a1a] text-[var(--color-success)] border border-[#16a34a33]',
  };

  return (
    <span className={clsx(
      'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide uppercase',
      variantStyles[variant],
      className
    )}>
      {label}
    </span>
  );
}
