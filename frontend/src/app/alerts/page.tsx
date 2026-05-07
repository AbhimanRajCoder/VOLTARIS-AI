'use client';

import { useState } from 'react';
import { useGridAlerts } from '@/lib/api';
import { ShieldAlert, AlertTriangle, Info, CheckCircle2, Check, Clock, AlertCircle } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { formatDistanceToNow } from 'date-fns';
import { acknowledgeAlert } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';

import { useZone } from '@/context/ZoneContext';

type FilterType = 'all' | 'critical' | 'warning' | 'info' | 'unresolved';

export default function AlertsPage() {
  const { selectedZone } = useZone();
  const { t } = useTranslation();
  const [filter, setFilter] = useState<FilterType>('unresolved');
  const severityParam = filter === 'critical' ? 'CRITICAL' : filter === 'warning' ? 'WARNING' : filter === 'info' ? 'INFO' : undefined;
  const { data: alertsData, isLoading: alertsLoading, error: alertsError, mutate } = useGridAlerts(severityParam, selectedZone);
  
  if (alertsError) {
    return (
      <div className="max-w-5xl mx-auto p-6 h-full flex items-center justify-center min-h-[400px]">
        <div className="border border-red-200 bg-red-50  rounded-lg p-8 text-center space-y-4 max-w-md shadow-sm w-full">
          <div className="w-12 h-12 rounded-full bg-red-100  flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6 text-red-600 " />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-red-800 ">{t('alerts.failedToLoad')}</h2>
            <p className="text-sm text-red-600  mt-1">{t('alerts.checkConnection')}</p>
          </div>
          <button 
            onClick={() => mutate()}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            {t('alerts.retry')}
          </button>
        </div>
      </div>
    );
  }

  const alerts = alertsData || [];

  const filteredAlerts = alerts.filter(a => {
    if (filter === 'unresolved') return !a.resolved;
    if (filter === 'critical') return a.severity === 'CRITICAL';
    if (filter === 'warning') return a.severity === 'WARNING';
    if (filter === 'info') return a.severity === 'INFO';
    return true; // 'all'
  }).sort((a, b) => new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime());

  const handleAcknowledge = async (alert_id: string) => {
    // Optimistic update
    const previousAlerts = [...alerts];
    mutate(
      alerts.map(a => a.alert_id === alert_id ? { ...a, acknowledged: true, resolved: true } : a),
      false
    );
    
    try {
      await acknowledgeAlert(alert_id);
      mutate(); // Revalidate to get fresh state from server
    } catch (error) {
      console.error("Failed to acknowledge alert:", error);
      mutate(previousAlerts, false); // Rollback
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return <ShieldAlert className="w-5 h-5 text-[var(--color-danger)]" />;
      case 'WARNING': return <AlertTriangle className="w-5 h-5 text-[var(--color-warning)]" />;
      case 'INFO': return <Info className="w-5 h-5 text-[var(--color-chart-blue)]" />;
      default: return null;
    }
  };

  const getSeverityDot = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-danger)] animate-pulse" />;
      case 'WARNING': return <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-warning)]" />;
      case 'INFO': return <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-chart-blue)]" />;
      default: return null;
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 flex flex-col h-full">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">{t('alerts.title')}</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">{t('alerts.subtitle', { zone: selectedZone })}</p>
        </div>
        
        <div className="flex p-1 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-lg shadow-sm overflow-x-auto max-w-full hide-scrollbar">
          {(['all', 'unresolved', 'critical', 'warning', 'info'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-all ${
                filter === f 
                  ? 'bg-[var(--color-accent)] text-white shadow-sm' 
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)]'
              }`}
            >
              {t(`alerts.${f}` as any)}
            </button>
          ))}
        </div>
      </div>

      {/* Alert Feed */}
      <div className="flex-1 card overflow-hidden flex flex-col shadow-sm">
        {alertsLoading ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 w-full animate-pulse bg-gray-200  rounded-lg" />
            ))}
          </div>
        ) : filteredAlerts.length > 0 ? (
          <div className="flex-1 overflow-y-auto">
            {filteredAlerts.map((alert) => (
              <div 
                key={alert.alert_id} 
                className={`flex flex-col sm:flex-row gap-4 p-5 border-b border-[var(--color-border-subtle)] transition-all ${
                  alert.severity === 'CRITICAL' ? 'border-l-4 border-l-[var(--color-danger)]' :
                  alert.severity === 'WARNING' ? 'border-l-4 border-l-[var(--color-warning)]' :
                  'border-l-4 border-l-[var(--color-chart-blue)]'
                } ${
                  alert.acknowledged ? 'opacity-50 bg-[var(--color-bg-surface)]' : 'bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-surface)]'
                }`}
              >
                {/* Left: Icon & Dot */}
                <div className="hidden sm:block relative pt-1">
                  {getSeverityIcon(alert.severity)}
                  <div className="absolute -top-1 -right-1">
                    {getSeverityDot(alert.severity)}
                  </div>
                </div>

                {/* Center: Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={alert.severity.toLowerCase() as any} label={alert.zone_id} />
                    <span className="text-[15px] font-semibold text-[var(--color-text-primary)]">{alert.message}</span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs font-medium text-[var(--color-text-muted)] mb-3">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDistanceToNow(new Date(alert.triggered_at), { addSuffix: true })}
                    </div>
                  </div>

                  {alert.recommended_action && (
                    <div className="p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-md inline-block max-w-full">
                      <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest block mb-1">{t('dashboard.recommendedActionTitle')}</span>
                      <p className="text-sm text-[var(--color-text-primary)] font-medium">"{alert.recommended_action}"</p>
                    </div>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start mt-4 sm:mt-0 sm:ml-4">
                  <div className="sm:hidden relative flex items-center">
                    {getSeverityIcon(alert.severity)}
                    <div className="absolute -top-1 -right-1">
                      {getSeverityDot(alert.severity)}
                    </div>
                  </div>
                  {alert.acknowledged ? (
                    <div className="flex items-center gap-1.5 text-sm text-[var(--color-success)] font-bold tracking-wide uppercase mt-1">
                      <Check className="w-4 h-4" />
                      {t('alerts.acknowledged')}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAcknowledge(alert.alert_id)}
                      className="px-4 py-2 bg-[var(--color-bg-primary)] hover:bg-[var(--color-accent)] hover:text-white border border-[var(--color-border-subtle)] hover:border-[var(--color-accent)] text-[var(--color-text-primary)] text-sm font-semibold rounded-md transition-colors shadow-sm"
                    >
                      {t('alerts.acknowledge')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-[var(--color-bg-surface)]">
            <div className="w-16 h-16 rounded-full bg-[var(--color-success)]/10 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-[var(--color-success)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t('alerts.allClear')}</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">{t('alerts.noActiveAlerts')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
