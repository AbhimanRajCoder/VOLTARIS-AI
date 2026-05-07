'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ZoneContextType {
  selectedZone: string;
  setSelectedZone: (zone: string) => void;
}

const ZoneContext = createContext<ZoneContextType | undefined>(undefined);

export const zones = Array.from({ length: 10 }, (_, i) => `Z${String(i + 1).padStart(2, '0')}`);

export function ZoneProvider({ children }: { children: ReactNode }) {
  const [selectedZone, setSelectedZone] = useState("Z01");

  return (
    <ZoneContext.Provider value={{ selectedZone, setSelectedZone }}>
      {children}
    </ZoneContext.Provider>
  );
}

export function useZone() {
  const context = useContext(ZoneContext);
  if (context === undefined) {
    throw new Error('useZone must be used within a ZoneProvider');
  }
  return context;
}
