import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Mail, Gift, Copy, Check } from "lucide-react";
import { registerInvite, getMaxPromptsPerDay, getExtraPromptsPerInvite, getRemainingPrompts, generateInviteLink } from '@/lib/prompt-limiter';
import { toast } from 'sonner';

interface PromptLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export function PromptLimitModal({ isOpen, onClose, userId }: PromptLimitModalProps) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [remainingPrompts, setRemainingPrompts] = useState(0);

  const maxPrompts = getMaxPromptsPerDay();
  const extraPrompts = getExtraPromptsPerInvite();

  // Carregar o número de prompts restantes quando o modal abrir
  useEffect(() => {
    if (isOpen && userId) {
      loadRemainingPrompts();
    }
  }, [isOpen, userId]);

  const loadRemainingPrompts = async () => {
    try {
      const remaining = await getRemainingPrompts(userId);
      setRemainingPrompts(remaining);
    } catch (error) {
      console.error('Erro ao carregar prompts restantes:', error);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      toast.error('Por favor, insira um e-mail válido');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Gerar link de convite
      const link = await generateInviteLink(userId, email);
      
      if (link) {
        setInviteLink(link);
        await registerInvite(userId, email);
        
        // Mostrar mensagem de sucesso
        setShowSuccess(true);
        
        // Limpar o campo de e-mail
        setEmail('');
        
        // Exibir toast de sucesso
        toast.success('Convite gerado com sucesso!');
        
        // Atualizar prompts restantes
        await loadRemainingPrompts();
      } else {
        toast.error('Não foi possível gerar o link de convite. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao enviar convite:', error);
      toast.error('Ocorreu um erro ao enviar o convite. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success('Link copiado para a área de transferência!');
      
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      console.error('Erro ao copiar link:', error);
      toast.error('Não foi possível copiar o link. Tente novamente.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-medium">
            {showSuccess ? 'Convite Enviado!' : 'Limite de Prompts Atingido'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {showSuccess 
              ? 'Seu amigo receberá um e-mail com o convite para o Agent0.'
              : `Você atingiu o limite de ${maxPrompts} prompts diários.`
            }
          </DialogDescription>
        </DialogHeader>

        {showSuccess ? (
          <div className="py-6 flex flex-col items-center justify-center">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-full p-4 mb-4">
              <Gift className="h-8 w-8 text-green-500 dark:text-green-400" />
            </div>
            <p className="text-center text-sm text-muted-foreground mb-4">
              Obrigado por compartilhar o Agent0! Você ganhou {extraPrompts} prompt extra.
            </p>
            <p className="text-center font-medium mb-4">
              Prompts restantes hoje: {remainingPrompts}
            </p>
            
            {inviteLink && (
              <div className="w-full">
                <p className="text-center text-sm font-medium mb-2">Link de convite:</p>
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  <div className="text-xs text-muted-foreground overflow-hidden text-ellipsis flex-1">
                    {inviteLink}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8" 
                    onClick={copyInviteLink}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-center text-xs text-muted-foreground mt-2">
                  Compartilhe este link com seu amigo para que ele ganhe acesso ao Agent0.
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/50 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-800 dark:text-amber-400 leading-relaxed">
                    Você já utilizou todos os seus {maxPrompts} prompts diários. Convide um amigo para ganhar {extraPrompts} prompt extra ou aguarde até amanhã para receber mais prompts.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="invite-email" className="text-sm font-medium">
                  E-mail do amigo
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="email@exemplo.com"
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <DialogFooter className="sm:justify-start">
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? 'Enviando...' : 'Enviar Convite'}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
