'use client';

import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <div className="relative">
        <Loader2 className="w-12 h-12 text-brand-primary animate-spin" />
        <div className="absolute inset-0 bg-brand-primary/10 blur-xl rounded-full" />
      </div>
      <div className="flex flex-col items-center">
        <h2 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)]">Loading System Data</h2>
        <p className="text-sm text-[var(--color-text-muted)] animate-pulse">Initializing grid metrics...</p>
      </div>
      <div className="flex gap-2">
        <div className="w-2 h-2 rounded-full bg-brand-primary animate-bounce [animation-delay:-0.3s]" />
        <div className="w-2 h-2 rounded-full bg-brand-primary animate-bounce [animation-delay:-0.15s]" />
        <div className="w-2 h-2 rounded-full bg-brand-primary animate-bounce" />
      </div>
    </div>
  );
}
