import React, { useEffect, useState } from 'react';
import { PromptLimitModal } from './prompt-limit-modal';
import { createClient } from '@/lib/supabase/client';

interface PromptLimitHandlerProps {
  showLimitModal: boolean;
  onClose: () => void;
}

export function PromptLimitHandler({ showLimitModal, onClose }: PromptLimitHandlerProps) {
  const [user, setUser] = useState<any>(null);

  // Obter o usuário atual para o modal de limite de prompts
  useEffect(() => {
    const supabase = createClient();
    
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      } catch (error) {
        console.error('Erro ao obter usuário:', error);
      }
    };

    getUser();

    const authListener = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      authListener.data.subscription.unsubscribe();
    };
  }, []);

  if (!user) return null;

  return (
    <PromptLimitModal
      isOpen={showLimitModal}
      onClose={onClose}
      userId={user.id}
    />
  );
}
