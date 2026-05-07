import { useState, useEffect, useRef, useCallback } from 'react';

const getWsUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
  if (envUrl.startsWith('ws')) return envUrl;
  return envUrl.replace(/^http/, 'ws');
};

const WS_URL = getWsUrl();

interface LiveLoadFrame {
  zone_id: string;
  timestamp: string;
  load_kw: number;
  ev_share_pct: number;
  confidence_lo: number;
  confidence_hi: number;
  status: 'CRITICAL' | 'WARNING' | 'NORMAL';
}

interface LiveLoadData {
  current_load_kw: number;
  ev_share_pct: number;
  status: string;
  timestamp: string;
  allZones: LiveLoadFrame[];
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export function useLiveLoad(zone_id?: string) {
  const [data, setData] = useState<LiveLoadData | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [error, setError] = useState<Error | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const attemptCount = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const processMessage = useCallback((event: MessageEvent) => {
    try {
      const parsed = JSON.parse(event.data);
      
      // Reset attempt counter on successful message received
      attemptCount.current = 0;
      setConnectionStatus("connected");

      // Handle initial connection message
      if (parsed.type === 'connected') {
        return;
      }
      
      // Handle load update frames
      if (parsed.type === 'load_update' && Array.isArray(parsed.data)) {
        const frames: LiveLoadFrame[] = parsed.data;
        
        // Find zone-specific data if zone_id provided, otherwise use first
        const zoneFrame = zone_id 
          ? frames.find(f => f.zone_id === zone_id)
          : frames[0];
        
        if (zoneFrame) {
          setData({
            current_load_kw: zoneFrame.load_kw,
            ev_share_pct: zoneFrame.ev_share_pct,
            status: zoneFrame.status,
            timestamp: zoneFrame.timestamp,
            allZones: frames,
          });
        }
      }
    } catch (e) {
      console.error("Failed to parse websocket message", e);
    }
  }, [zone_id]);

  const connect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const url = zone_id ? `${WS_URL}/ws/live-load?zone_id=${zone_id}` : `${WS_URL}/ws/live-load`;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    setConnectionStatus("connecting");

    ws.onopen = () => {
      setConnectionStatus("connected");
      setError(null);
      // Note: attemptCount is reset on first message received
    };

    ws.onmessage = (event) => {
      processMessage(event);
    };

    ws.onerror = () => {
      setConnectionStatus("disconnected");
    };

    ws.onclose = () => {
      setConnectionStatus("disconnected");
      
      // Exponential backoff: Math.min(1000 * 2^attempt, 30000)
      const delay = Math.min(1000 * Math.pow(2, attemptCount.current), 30000);
      attemptCount.current += 1;
      
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    };
  }, [zone_id, processMessage]);

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return { data, connectionStatus, connected: connectionStatus === "connected", error };
}
