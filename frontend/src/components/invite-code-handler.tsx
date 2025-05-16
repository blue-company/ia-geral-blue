"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { InviteCodeModal } from './invite-code-modal';

// Define step types to ensure consistency across components
type InviteCodeStep = 'none' | 'input' | 'paymentRequired';

interface EventData {
  detail: {
    step: Exclude<InviteCodeStep, 'none'> // All steps except 'none'
  }
}

export function InviteCodeHandler() {
  const [user, setUser] = useState<any>(null);
  const [step, setStep] = useState<InviteCodeStep>('none');
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();

        if (currentUser) {
          console.log(`[INFO] Usuário autenticado: ${currentUser.id}`);
          setUser(currentUser);

          const response = await fetch(`https://n8n-blue.up.railway.app/webhook/ab889841-79cf-4dd2-a149-21734f5d97a5?user_id=${currentUser.id}`);

          if (response.status === 200) {
            console.log(`[INFO] Convite válido para o usuário ${currentUser.id}. Nenhum modal será exibido.`);
            setStep('none');
          } else if (response.status === 404) {
            console.log(`[INFO] Nenhum convite encontrado. Exibindo modal de código.`);
            setStep('input');
          } else if (response.status === 402) {
            console.log(`[INFO] Convite encontrado, mas pendente de pagamento. Exibindo modal de pagamento.`);
            setStep('paymentRequired');
          } else {
            console.warn(`[WARN] Resposta inesperada da API de verificação: ${response.status}`);
            setStep('none');
          }
        }
      } catch (error) {
        console.error('[ERRO] Erro ao verificar convite do usuário via API:', error);
      }
    };

    getUser();
    
    // Listen for custom event to show modals from error handling
    const handleNeedsInviteCode = (event: CustomEvent<EventData['detail']>) => {
      console.log(`[INFO] Recebido evento needsInviteCode com step: ${event.detail.step}`);
      setStep(event.detail.step);
    };

    // Add event listener for the custom event
    window.addEventListener('needsInviteCode', handleNeedsInviteCode as EventListener);

    const authListener = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          console.log(`[EVENTO] Usuário fez login: ${session.user.id}`);
          setUser(session.user);
          getUser();
        }
      }
    );

    return () => {
      authListener.data.subscription.unsubscribe();
      window.removeEventListener('needsInviteCode', handleNeedsInviteCode as EventListener);
    };
  }, []);

  const handleClose = () => {
    console.log('[INFO] Modal fechado pelo usuário');
    setStep('none');
  };

  // Não mostrar nada se não houver usuário ou se o step for 'none'
  if (!user || step === 'none' as InviteCodeStep) return null;

  // Como step não é 'none' aqui (verificado pela condição acima)
  // Podemos afirmar ao TypeScript que step é do tipo que o InviteCodeModal aceita
  const currentStep = step as Exclude<InviteCodeStep, 'none'>;
  
  return (
    <InviteCodeModal
      isOpen={step !== 'none'}
      onClose={handleClose}
      userId={user.id}
      step={currentStep}
      setStep={setStep}
    />
  );
}
