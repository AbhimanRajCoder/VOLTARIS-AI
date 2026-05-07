'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, AlertCircle, RefreshCw, Zap } from 'lucide-react';

const getHealthUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
  const baseUrl = envUrl.replace('/api', '');
  // Ensure we use http/https for fetch, even if ws/wss was provided
  if (baseUrl.startsWith('ws')) {
    return baseUrl.replace(/^ws/, 'http') + '/health';
  }
  return baseUrl + '/health';
};

const API_HEALTH_URL = getHealthUrl();

export default function SystemHealthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'online' | 'offline'>('loading');
  const [isRetrying, setIsRetrying] = useState(false);
  const retryCountRef = useRef(0);
  const maxInitialRetries = 3;

  const checkHealth = useCallback(async (isManual: boolean = false) => {
    if (isManual) {
      setIsRetrying(true);
    }
    
    try {
      // Use no-cache to ensure we're getting fresh status
      const res = await fetch(API_HEALTH_URL, { 
        cache: 'no-store',
        mode: 'cors', // Explicitly set cors mode
        signal: AbortSignal.timeout(5000) 
      });
      
      if (res.ok) {
        setStatus('online');
        retryCountRef.current = 0;
      } else {
        throw new Error(`Health check returned ${res.status}`);
      }
    } catch (err) {
      console.warn(`Health check attempt ${retryCountRef.current + 1} failed:`, err);
      
      if (!isManual && retryCountRef.current < maxInitialRetries) {
        retryCountRef.current += 1;
        // Wait 1.5s before retrying automatically
        setTimeout(() => checkHealth(false), 1500);
      } else {
        setStatus('offline');
      }
    } finally {
      if (isManual) {
        setIsRetrying(false);
      }
    }
  }, []);

  useEffect(() => {
    checkHealth(false);
  }, [checkHealth]);

  if (status === 'loading') {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900 text-white">
        <div className="relative mb-8">
          <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-2xl animate-pulse" />
          <div className="relative w-20 h-20 rounded-3xl bg-blue-600 flex items-center justify-center shadow-2xl shadow-blue-500/50">
            <Zap className="w-10 h-10 text-white fill-current animate-bounce" />
          </div>
        </div>
        <h1 className="text-2xl font-black italic tracking-tighter uppercase mb-2">GridWise</h1>
        <div className="flex flex-col items-center gap-2">
           <div className="flex items-center gap-3 text-slate-400 font-bold text-xs uppercase tracking-[0.3em]">
             <Loader2 className="w-4 h-4 animate-spin" />
             Synchronizing Intelligence
           </div>
           {retryCountRef.current > 0 && (
             <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">
               Handshake Attempt {retryCountRef.current}/{maxInitialRetries}
             </p>
           )}
        </div>
      </div>
    );
  }

  if (status === 'offline') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/10 backdrop-blur-md p-6">
        <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300">
          <div className="p-10 text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Connection Failure</h2>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">
                Unable to establish a secure link with the GridWise backend telemetry service.
              </p>
            </div>

            <div className="p-4 bg-red-50 rounded-2xl border border-red-100 text-left">
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                <p className="text-[11px] font-bold text-red-800 uppercase tracking-wide">
                  Backend Service: Offline (localhost:8000)
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                retryCountRef.current = 0;
                checkHealth(true);
              }}
              disabled={isRetrying}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl disabled:opacity-50 group"
            >
              {isRetrying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
              )}
              {isRetrying ? 'Attempting Reconnect...' : 'Try Again'}
            </button>
          </div>
          
          <div className="bg-slate-50 py-4 px-10 text-center border-t border-slate-100">
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
               Network Protocol: HTTP/2 (TLS Required)
             </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
