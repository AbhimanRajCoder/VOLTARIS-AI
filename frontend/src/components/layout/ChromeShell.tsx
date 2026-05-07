'use client';

import { ChatWidget } from '@/components/chat/ChatWidget';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import { usePathname } from 'next/navigation';

export default function ChromeShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSoftDeflectDocs = pathname?.startsWith('/docs/soft-deflect');

  if (isSoftDeflectDocs) {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      <TopBar />
      <main className="pl-[240px] pt-14 h-full overflow-auto">
        <div className="animate-fade-in">
          {children}
        </div>
      </main>
      <ChatWidget />
    </>
  );
}

