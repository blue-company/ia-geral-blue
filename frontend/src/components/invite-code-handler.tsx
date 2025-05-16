"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { InviteCodeModal } from './invite-code-modal';

export function InviteCodeHandler() {
  const [user, setUser] = useState<any>(null);
  const [step, setStep] = useState<'none' | 'input' | 'paymentRequired'>('none');
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
    };
  }, []);

  const handleClose = () => {
    console.log('[INFO] Modal fechado pelo usuário');
    setStep('none');
  };

  if (!user || step === 'none') return null;

  return (
    <InviteCodeModal
      isOpen={step !== 'none'}
      onClose={handleClose}
      userId={user.id}
      step={step}
      setStep={setStep}
    />
  );
}
