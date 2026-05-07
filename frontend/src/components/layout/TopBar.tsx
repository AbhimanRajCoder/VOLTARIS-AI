'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { MapPin, Languages, ExternalLink } from 'lucide-react';
import { useZone, zones } from '@/context/ZoneContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useLanguage } from '@/context/LanguageContext';
import { useLiveLoad } from '@/hooks/useLiveLoad';

export default function TopBar() {
  const pathname = usePathname();
  const { selectedZone, setSelectedZone } = useZone();
  const { t } = useTranslation();
  const { language, toggleLanguage } = useLanguage();
  const { connectionStatus } = useLiveLoad();
  const [time, setTime] = useState<Date | null>(null);
  const [apiOk, setApiOk] = useState<boolean | null>(null);

  const routeNames: Record<string, string> = {
    '/dashboard': t('nav.dashboard'),
    '/forecast': t('nav.forecast'),
    '/scheduler': t('nav.scheduler'),
    '/infra-map': t('nav.infraMap'),
    '/alerts': t('nav.alerts'),
    '/reports': t('nav.reports'),
    '/simulate': t('nav.simulate')
  };

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Lightweight health check
  useEffect(() => {
    const checkApi = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8000'}/health`, { signal: AbortSignal.timeout(3000) });
        setApiOk(res.ok);
      } catch {
        setApiOk(false);
      }
    };
    checkApi();
    const interval = setInterval(checkApi, 30000);
    return () => clearInterval(interval);
  }, []);

  const title = routeNames[pathname] || 'GridWise';

  const getStatusBadge = () => {
    if (connectionStatus === 'connecting') {
      return (
        <div className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 animate-pulse">
          {t('common.reconnecting')}
        </div>
      );
    }
    if (connectionStatus === 'connected' && apiOk) {
      return (
        <div className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[var(--color-success)]/10 text-[var(--color-success)]">
          {t('common.live')}
        </div>
      );
    }
    return (
      <div className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[var(--color-danger)]/10 text-[var(--color-danger)]">
        {t('common.offline')}
      </div>
    );
  };

  return (
    <header className="fixed top-0 left-[240px] right-0 h-16 bg-white/70 backdrop-blur-md border-b border-[var(--color-border-subtle)] flex items-center justify-between px-8 z-40">
      <div className="flex items-center gap-8">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-[15px] font-bold text-[var(--color-text-primary)] tracking-tight">
              {title}
            </h1>
            {getStatusBadge()}
          </div>
        </div>

        <div className="w-px h-8 bg-[var(--color-border-subtle)]" />

        {/* Global Zone Selector */}
        <div className="flex items-center gap-2 bg-gray-100/50  px-3 py-1.5 rounded-lg border border-[var(--color-border-subtle)]">
          <MapPin size={14} className="text-[var(--color-accent)]" />
          <span className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t('common.zone')}:</span>
          <select 
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="bg-transparent text-[13px] font-bold text-[var(--color-text-primary)] focus:outline-none cursor-pointer"
          >
            {zones.map(z => (
              <option key={`topbar-zone-${z}`} value={z} className="bg-white ">{z}</option>
            ))}
          </select>
        </div>
      </div>
 
      <div className="flex items-center gap-6">
        {/* API Docs Link */}
        <a
          href="https://voltaris-ai.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white text-slate-700 hover:bg-slate-50 transition-colors border border-[var(--color-border-subtle)] shadow-sm"
        >
          <ExternalLink size={14} className="text-[var(--color-accent)]" />
          <span className="text-[11px] font-black tracking-wider uppercase">
            API Docs
          </span>
        </a>

        {/* Language Toggle */}
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors border border-slate-700 shadow-sm"
        >
          <Languages size={14} className="text-blue-400" />
          <span className="text-[11px] font-black tracking-wider uppercase">
            {language === 'en' ? 'ಕನ್ನಡ' : 'English'}
          </span>
        </button>

        <div className="w-px h-8 bg-[var(--color-border-subtle)]" />

        {/* Date/Time */}
        <div className="flex flex-col items-end">
          <div className="text-[13px] font-bold text-[var(--color-text-primary)] tabular-nums">
            {time ? format(time, 'HH:mm:ss') : '...'}
          </div>
          <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
            {time ? format(time, language === 'kn' ? 'EEE, MMM dd' : 'EEE, MMM dd') : '...'}
          </div>
        </div>
        
        <div className="w-px h-8 bg-[var(--color-border-subtle)]" />
        
        {/* User Context (Mock but looks real) */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-[10px] font-bold text-white border-2 border-white shadow-sm">
            AD
          </div>
        </div>
      </div>
    </header>
  );
}
