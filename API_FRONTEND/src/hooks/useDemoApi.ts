// ============================================================
// useDemoApi — Reusable hook for demo API calls
// Encapsulates loading, response tracking, and auto-run logic.
// Every demo component uses this instead of duplicating state.
// ============================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ApiResult } from '../lib/deflectApi';

export interface DemoApiState<T> {
  data: T | null;
  responseJson: string | null;
  responseTimeMs: number;
  responseSizeKb: string;
  lastRunTime: Date | null;
  isLoading: boolean;
  mode: 'live' | 'demo' | null;
  runCount: number;
}

export interface DemoApiActions<T> {
  run: () => Promise<void>;
  state: DemoApiState<T>;
}

/**
 * Generic hook for demo API calls.
 *
 * @param apiFn    The async function that calls the real/mock API
 * @param onData   Optional callback fired after each successful call
 *
 * Usage:
 *   const { run, state } = useDemoApi(fetchDeflectRouting);
 */
export function useDemoApi<T>(
  apiFn: () => Promise<ApiResult<T>>,
  onData?: (result: ApiResult<T>) => void,
): DemoApiActions<T> {
  const [data, setData] = useState<T | null>(null);
  const [responseJson, setResponseJson] = useState<string | null>(null);
  const [responseTimeMs, setResponseTimeMs] = useState(0);
  const [responseSizeKb, setResponseSizeKb] = useState('');
  const [lastRunTime, setLastRunTime] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'live' | 'demo' | null>(null);
  const [runCount, setRunCount] = useState(0);

  const run = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await apiFn();
      setData(result.data);
      setResponseJson(JSON.stringify(result.data, null, 2));
      setResponseTimeMs(result.responseTimeMs);
      setResponseSizeKb(`${(result.sizeBytes / 1024).toFixed(1)} kB`);
      setLastRunTime(new Date());
      setMode(result.mode);
      setRunCount(c => c + 1);
      onData?.(result);
    } finally {
      setIsLoading(false);
    }
  }, [apiFn, onData]);

  return {
    run,
    state: { data, responseJson, responseTimeMs, responseSizeKb, lastRunTime, isLoading, mode, runCount },
  };
}

/**
 * Hook for auto-run interval with countdown display.
 */
export function useAutoRun(
  runFn: () => Promise<void>,
  intervalSec: number,
) {
  const [autoRun, setAutoRun] = useState(false);
  const [countdown, setCountdown] = useState(intervalSec);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (autoRun) {
      setCountdown(intervalSec);
      timerRef.current = setInterval(() => {
        runFn();
        setCountdown(intervalSec);
      }, intervalSec * 1000);
      cdRef.current = setInterval(() => {
        setCountdown(p => (p <= 1 ? intervalSec : p - 1));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (cdRef.current) clearInterval(cdRef.current);
    };
  }, [autoRun, intervalSec, runFn]);

  return { autoRun, setAutoRun, countdown };
}
