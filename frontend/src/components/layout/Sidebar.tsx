'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Calendar, 
  Map as MapIcon, 
  Bell, 
  FileText, 
  Zap,
  Shield
} from 'lucide-react';
import { useGridAlerts } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import { useIsMounted } from '@/hooks/useIsMounted';

export default function Sidebar() {
  const pathname = usePathname();
  const { data: alerts } = useGridAlerts('CRITICAL');
  const { t } = useTranslation();
  const isMounted = useIsMounted();
  
  const hasAlerts = alerts && alerts.length > 0;

  const navItems = [
    { name: t('nav.dashboard'), href: '/dashboard', icon: LayoutDashboard },
    { name: t('nav.forecast'), href: '/forecast', icon: TrendingUp },
    { name: t('nav.scheduler'), href: '/scheduler', icon: Calendar },
    { name: t('nav.infraMap'), href: '/infra-map', icon: MapIcon },
    // { name: t('nav.simulate'), href: '/simulate', icon: Zap },
    // { name: 'Control Center', href: '/control', icon: Shield },
    { name: t('nav.alerts'), href: '/alerts', icon: Bell },
    { name: t('nav.reports'), href: '/reports', icon: FileText },
  ];

  // Stable random ID generated once on client
  const [terminalId] = useState(() => 
    `0x${Math.random().toString(16).substring(2, 8).toUpperCase()}`
  );

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[240px] bg-white border-r border-slate-200 flex flex-col z-50">
      {/* Logo */}
      <div className="h-16 flex items-center px-8 border-b border-slate-50">
        <div className="w-8 h-8 rounded-xl bg-[var(--color-brand-primary)] flex items-center justify-center mr-3 shadow-lg shadow-blue-500/20">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-[16px] font-black tracking-tight text-slate-900 uppercase italic">GridWise</span>
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest -mt-1">{t('nav.controlSystem')}</span>
        </div>
      </div>
 
      {/* Navigation */}
      <nav className="flex-1 py-8 px-4 flex flex-col">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] px-4 mb-4">{t('nav.intelligence')}</span>
        <div className="flex flex-col gap-1.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (pathname === '/' && item.href === '/dashboard');
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? 'bg-slate-100 text-slate-900' 
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <item.icon className={`w-4 h-4 mr-3 transition-colors ${isActive ? 'text-[var(--color-brand-primary)]' : 'text-slate-400 group-hover:text-slate-600'}`} />
                <span className="font-bold text-[13px] tracking-tight">{item.name}</span>
                {item.href === '/alerts' && hasAlerts && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)] animate-pulse" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
 
      {/* Footer Status */}
      <div className="p-6 border-t border-slate-100 bg-slate-50/50">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('nav.networkStatus')}</span>
            <div className={`w-2 h-2 rounded-full ${hasAlerts ? 'bg-red-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.2)]'}`} />
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-200">
            <div className="text-[10px] text-slate-400 font-bold mb-1">{t('nav.authenticatedTerminal')}</div>
            <div className="text-[11px] text-slate-900 font-mono flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              {isMounted ? terminalId : '0x......'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
