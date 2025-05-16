'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from 'sonner';

// Define consistent step types to match the InviteCodeHandler
type InviteCodeStep = 'none' | 'input' | 'paymentRequired';

interface InviteCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  step: 'input' | 'paymentRequired';
  setStep: (s: InviteCodeStep) => void;
}

export function InviteCodeModal({ isOpen, onClose, userId, step, setStep }: InviteCodeModalProps) {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inviteCode.trim()) {
      toast.error('Por favor, insira um código de convite válido');
      setFeedback({ type: 'error', message: 'Por favor, insira um código de convite válido.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const response = await fetch('https://n8n-blue.up.railway.app/webhook/b4076b97-47f1-4699-837f-aa8bc4420387', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: inviteCode.trim(), user_id: userId }),
      });

      if (response.status === 201) {
        toast.success('Código validado com sucesso!');
        setFeedback({ type: 'success', message: 'Código validado com sucesso!' });
        setTimeout(() => setStep('paymentRequired'), 2500);
      } else if (response.status === 402) {
        toast.success('Código válido! Prossiga com o pagamento.');
        setStep('paymentRequired');
      } else if (response.status === 404) {
        toast.error('Código inválido ou já utilizado');
        setFeedback({ type: 'error', message: 'Código inválido ou já utilizado. Tente outro código.' });
      } else {
        toast.error('Erro inesperado. Tente novamente.');
        setFeedback({ type: 'error', message: 'Erro inesperado. Tente novamente.' });
      }
    } catch (err) {
      console.error('[ERRO] Falha ao validar código de convite:', err);
      toast.error('Erro ao processar o código. Tente novamente.');
      setFeedback({ type: 'error', message: 'Erro ao processar o código. Tente novamente.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNoCode = () => {
    setShowWaitlistModal(true);
  };

  const handleRedirectHome = () => {
    setShowWaitlistModal(false);
    setStep('none');
    router.push('/');
  };

  const handleClose = () => {
    setStep('none');
    setInviteCode('');
    setFeedback(null);
    setShowWaitlistModal(false);
    onClose();
  };

  return (
    <>
      {/* Modal principal para input inicial */}
      <Dialog open={isOpen && step === 'input' && !showWaitlistModal} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Código de convite</DialogTitle>
            <DialogDescription className="text-center">
              Por enquanto estamos trabalhando em beta privado, insira seu código de convite
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 py-4">
            <Input
              id="inviteCode"
              placeholder="Insira seu código*"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              disabled={isSubmitting}
            />

            <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
              <Button
                type="button"
                onClick={handleNoCode}
                disabled={isSubmitting}
                className="border border-purple-600 text-purple-600 bg-white hover:bg-purple-50 w-full sm:w-auto"
              >
                Não tenho um código
              </Button>

              <Button
                type="submit"
                className="bg-purple-600 hover:bg-purple-700 text-white w-full sm:w-auto"
                disabled={isSubmitting || !inviteCode.trim()}
              >
                {isSubmitting ? 'Enviando...' : 'Enviar'}
              </Button>
            </div>

            {feedback && (
              <div
                className={`text-sm text-center p-2 rounded-md ${
                  feedback.type === 'success'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {feedback.message}
              </div>
            )}
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de pagamento */}
      <Dialog open={isOpen && step === 'paymentRequired'} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Convite validado com sucesso</DialogTitle>
            <DialogDescription className="text-center">
              Seu acesso foi ativado. Agora é necessário realizar o vínculo de pagamento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm text-center text-muted-foreground px-2">
            <p>
              Você foi convidado para o <strong>teste de 7 dias</strong>. Para dar andamento no teste,
              realize um vínculo de pagamento com os mesmos dados de cadastro dessa conta no link abaixo:
            </p>
            <p>
              <a
                href="https://buy.stripe.com/8x2eVe5XkcqOgos7CDenS0p"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 hover:underline font-medium"
              >
                https://buy.stripe.com/8x2eVe5XkcqOgos7CDenS0p
              </a>
            </p>
            <p>
              Você <strong>só será cobrado após o período de teste de 7 dias</strong>.
            </p>
          </div>

          <div className="py-6 flex justify-center">
            <Button
              onClick={handleClose}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Entendi
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de lista de espera */}
      <Dialog open={showWaitlistModal} onOpenChange={(open) => !open && handleRedirectHome()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Sem problemas</DialogTitle>
            <DialogDescription className="text-center">
              Você já está na nossa lista de espera. Te avisamos quando estivermos prontos.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 flex justify-center">
            <Button
              onClick={handleRedirectHome}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Entendi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
