'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import { SiteHeader } from "@/components/thread/thread-site-header";
import { ChatInput } from '@/components/thread/chat-input/chat-input';
import Image from 'next/image';

interface LoadingThreadProps {
  message?: string;
}

export function LoadingThread({ message = '' }: LoadingThreadProps) {
  // Estado para controlar a animação dos esqueletos
  const [progress, setProgress] = useState(0);
  
  // Efeito para animar os esqueletos
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => (prev < 100 ? prev + 1 : 0));
    }, 100);
    
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="flex flex-col h-screen">
      <SiteHeader 
        threadId="temp-loading"
        projectId=""
        projectName="Inicializando agente..."
        onViewFiles={() => {}}
        onToggleSidePanel={() => {}}
        isMobileView={false}
      />
      
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto p-4 pb-24 space-y-6">
          {/* User message */}
          {message && (
            <div className="flex flex-col gap-2 max-w-3xl mx-auto">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium">Você</span>
                </div>
                <div className="flex-1 bg-muted/40 rounded-lg p-4">
                  <p className="text-sm">{message}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Loading message */}
          <div className="flex flex-col gap-2 max-w-3xl mx-auto">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 mt-2 rounded-md flex items-center justify-center overflow-hidden ml-auto mr-2">
                <Image src="/agent_eye_buddy.png" alt="Thanus" width={35} height={35} className="object-contain opacity-70" priority unoptimized />
              </div>
              <div className="flex-1">
                <div className="inline-flex max-w-[90%] rounded-lg bg-muted/5 px-4 py-3 text-sm">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <p className="text-sm font-medium">Inicializando o agente, por favor aguarde...</p>
                    </div>
                    <p className="text-sm text-primary/80 italic mt-2">Thanus está prestes a te surpreender...</p>
                    <div className="mt-4 space-y-3">
                      <Skeleton className="h-4 w-full" style={{ width: `${Math.max(30, Math.min(75, 75 - (progress % 40)))}%` }} />
                      <Skeleton className="h-4" style={{ width: `${Math.max(20, Math.min(90, 50 + (progress % 40)))}%` }} />
                      <Skeleton className="h-4" style={{ width: `${Math.max(40, Math.min(95, 70 - (progress % 30)))}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Input area (disabled) */}
        <div className="p-4 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 fixed bottom-0 w-full">
          <div className="max-w-3xl mx-auto">
            <div className="relative">
              <div className="flex items-center gap-2 border rounded-lg p-2 bg-background shadow-sm">
                <div className="flex-1 flex items-center min-h-[40px]">
                  <p className="text-sm text-muted-foreground">Thanus está prestes a te surpreender...</p>
                </div>
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-md flex items-center justify-center bg-muted/30">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
