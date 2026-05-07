import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { ElementType } from 'react';

interface KPICardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  subtitle?: string;
  icon: ElementType;
  accentColor?: string;
}

export default function KPICard({
  title,
  value,
  unit,
  trend,
  subtitle,
  icon: Icon,
  accentColor = 'var(--color-accent)'
}: KPICardProps) {
  return (
    <div 
      className="card p-5 group relative overflow-hidden"
    >
      {/* Background Glow */}
      <div 
        className="absolute -right-4 -top-4 w-24 h-24 blur-3xl opacity-10 rounded-full" 
        style={{ backgroundColor: accentColor }}
      />
      
      <div className="flex items-start justify-between relative z-10">
        <h3 className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{title}</h3>
        <div className="p-2 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] shadow-sm group-hover:scale-110 transition-transform duration-300">
          <Icon className="w-4 h-4" style={{ color: accentColor }} />
        </div>
      </div>
      
      <div className="mt-4 flex items-baseline gap-1 relative z-10">
        <span className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight tabular-nums animate-count-up">
          {value}
        </span>
        {unit && <span className="text-xs font-semibold text-[var(--color-text-muted)] ml-1">{unit}</span>}
      </div>
 
      {subtitle && (
        <div className="flex items-center mt-3 text-xs font-medium relative z-10">
          {trend === 'up' && <div className="flex items-center text-[var(--color-success)] bg-[var(--color-success)]/10 px-1.5 py-0.5 rounded-full mr-2">
            <ArrowUpRight className="w-3 h-3 mr-0.5" />
          </div>}
          {trend === 'down' && <div className="flex items-center text-[var(--color-danger)] bg-[var(--color-danger)]/10 px-1.5 py-0.5 rounded-full mr-2">
            <ArrowDownRight className="w-3 h-3 mr-0.5" />
          </div>}
          <span className="text-[var(--color-text-secondary)]">{subtitle}</span>
        </div>
      )}
    </div>
  );
}
