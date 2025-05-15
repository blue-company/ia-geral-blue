"use client";

import React, { useState, Suspense, useEffect, useRef } from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from 'next/navigation';
import { Menu } from "lucide-react";
import { ChatInput, ChatInputHandles } from '@/components/thread/chat-input';
import { initiateAgent, createThread, addUserMessage, startAgent, createProject, BillingError, PromptLimitExceededError } from "@/lib/api";
import { PromptLimitModal } from "@/components/prompt-limit-modal";
import { generateThreadName } from "@/lib/actions/threads";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useBillingError } from "@/hooks/useBillingError";
import { BillingErrorAlert } from "@/components/billing/usage-limit-alert";
import { useAccounts } from "@/hooks/use-accounts";
import { createClient } from '@/lib/supabase/client';
import { isLocalMode, config } from "@/lib/config";
import { toast } from "sonner";

// Constant for localStorage key to ensure consistency
const PENDING_PROMPT_KEY = 'pendingInventuPrompt';

function DashboardContent() {
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSubmit, setAutoSubmit] = useState(false);
  const { billingError, handleBillingError, clearBillingError } = useBillingError();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { setOpenMobile } = useSidebar();
  const { data: accounts } = useAccounts();
  const personalAccount = accounts?.find(account => account.personal_account);
  const chatInputRef = useRef<ChatInputHandles>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  // Implementação inline do hook useAuth
  useEffect(() => {
    const supabase = createClient();
    
    // Obter o usuário atual
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      } catch (error) {
        console.error('Erro ao obter usuário:', error);
      }
    };

    getUser();

    // Configurar listener para mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (message: string, options?: { model_name?: string; enable_thinking?: boolean; reasoning_effort?: string; stream?: boolean; enable_context_manager?: boolean }) => {
    if ((!message.trim() && !(chatInputRef.current?.getPendingFiles().length)) || isSubmitting) return;

    setIsSubmitting(true);
    const files = chatInputRef.current?.getPendingFiles() || [];
    localStorage.removeItem(PENDING_PROMPT_KEY);
    
    // Criar um ID temporário para exibir feedback imediato
    const tempId = `temp-${Date.now()}`;
    
    try {
      // Redirecionar imediatamente para uma página de carregamento com ID temporário
      // Isso dará feedback visual imediato ao usuário
      router.push(`/agents/${tempId}?loading=true&message=${encodeURIComponent(message)}`);
      
      // Pequeno delay para garantir que o redirecionamento aconteça antes de continuar
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (files.length > 0) {
        // ---- Handle submission WITH files ----
        console.log(`Submitting with message: "${message}" and ${files.length} files.`);
        
        // Preparar o FormData
        const formData = new FormData();
        formData.append('prompt', message);
        
        // Append files
        files.forEach((file) => {
          formData.append('files', file, file.name);
        });
        
        // Append options
        if (options?.model_name) formData.append('model_name', options.model_name);
        formData.append('enable_thinking', String(options?.enable_thinking ?? false));
        formData.append('reasoning_effort', options?.reasoning_effort ?? 'low');
        formData.append('stream', String(options?.stream ?? true));
        formData.append('enable_context_manager', String(options?.enable_context_manager ?? false));
        
        try {
          // Processar a requisição de forma assíncrona
          const result = await initiateAgent(formData);
          console.log('Agent initiated with files:', result);
          if (result.thread_id) {
            // Redirecionar para o thread real quando estiver pronto
            router.replace(`/agents/${result.thread_id}`);
            chatInputRef.current?.clearPendingFiles();
          } else {
            throw new Error("Agent initiation did not return a thread_id.");
          }
        } catch (error) {
          handleSubmissionError(error);
          // Redirecionar de volta para o dashboard em caso de erro
          if (error?.status === 402 || error instanceof PromptLimitExceededError) {
            router.replace('/dashboard?promptLimit=true');
          } else {
            router.replace('/dashboard');
          }
        }
      } else {
        // ---- Handle text-only messages ----
        console.log(`Submitting text-only message: "${message}"`);
        
        try {
          // Processar em segundo plano
          const projectName = await generateThreadName(message);
          const newProject = await createProject({ name: projectName, description: "" });
          const thread = await createThread(newProject.id);
          await addUserMessage(thread.thread_id, message);
          await startAgent(thread.thread_id, options);
          
          // Redirecionar para o thread real quando estiver pronto
          router.replace(`/agents/${thread.thread_id}`);
        } catch (error) {
          handleSubmissionError(error);
          // Redirecionar de volta para o dashboard em caso de erro
          if (error?.status === 402 || error instanceof PromptLimitExceededError) {
            router.replace('/dashboard?promptLimit=true');
          } else {
            router.replace('/dashboard');
          }
        }
      }
    } catch (error: any) {
      handleSubmissionError(error);
      // Garantir que o usuário volte para o dashboard em caso de erro no redirecionamento
      if (error?.status === 402 || error instanceof PromptLimitExceededError) {
        router.replace('/dashboard?promptLimit=true');
      } else {
        router.replace('/dashboard');
      }
    } finally {
      // Garantir que o estado de submissão seja resetado mesmo em caso de erro
      setIsSubmitting(false);
    }
  };

  // Função para tratar erros de forma consistente
  const handleSubmissionError = (error: any) => {
    console.error('Error during submission process:', error);
    
    if (error instanceof BillingError) {
        // Delegate billing error handling
        console.log("Handling BillingError:", error.detail);
        handleBillingError({
            message: error.detail.message || 'Monthly usage limit reached. Please upgrade your plan.',
            currentUsage: error.detail.currentUsage as number | undefined,
            limit: error.detail.limit as number | undefined,
            subscription: error.detail.subscription || {
                price_id: config.SUBSCRIPTION_TIERS.FREE.priceId,
                plan_name: "Free"
            }
        });
    } else if (error instanceof PromptLimitExceededError) {
        // Tratar erro de limite de prompts excedido
        console.log("Limite de prompts excedido:", error.message);
        setShowLimitModal(true);
    } else if (error?.status === 402 || (error?.message && error.message.includes('402'))) {
        // Tratar erro 402 Payment Required (limite de prompts no backend)
        console.log("Erro 402 Payment Required (possível limite de prompts):", error);
        setShowLimitModal(true);
    } else {
        // Handle other errors
        const isConnectionError = error instanceof TypeError && error.message.includes('Failed to fetch');
        if (!isLocalMode() || isConnectionError) {
            toast.error(error.message || "An unexpected error occurred");
        }
    }
    
    setIsSubmitting(false); // Reset submitting state on all errors
  };

  // Check for pending prompt in localStorage on mount and URL parameters
  useEffect(() => {
    console.log("Verificando parâmetros na URL e localStorage");
    
    if (typeof window !== 'undefined') {
      // Verificar se há uma flag no localStorage indicando que o modal deve ser exibido
      const showLimitModal = localStorage.getItem('SHOW_PROMPT_LIMIT_MODAL');
      console.log("Flag SHOW_PROMPT_LIMIT_MODAL no localStorage:", showLimitModal);
      
      if (showLimitModal === 'true') {
        console.log("Exibindo modal de limite de prompts a partir do localStorage");
        setShowLimitModal(true);
        
        // Limpar a flag do localStorage
        localStorage.removeItem('SHOW_PROMPT_LIMIT_MODAL');
      }
      
      // Verificar também se há o parâmetro promptLimitExceeded na URL
      const urlParams = new URLSearchParams(window.location.search);
      const promptLimitExceeded = urlParams.get('promptLimitExceeded');
      
      console.log("Parâmetro promptLimitExceeded na URL:", promptLimitExceeded, "URL completa:", window.location.href);
      
      if (promptLimitExceeded === 'true') {
        console.log("Exibindo modal de limite de prompts a partir do parâmetro URL");
        // Mostrar o modal de limite de prompts imediatamente
        setShowLimitModal(true);
        
        // Limpar o parâmetro da URL para evitar que o modal seja mostrado novamente após atualização
        const url = new URL(window.location.href);
        url.searchParams.delete('promptLimitExceeded');
        window.history.replaceState({}, '', url.toString());
      }
    }
    
    // Use a small delay to ensure we're fully mounted before checking localStorage
    const timer = setTimeout(() => {
      // Verificar se há um prompt pendente no localStorage
      const pendingPrompt = localStorage.getItem(PENDING_PROMPT_KEY);
      
      if (pendingPrompt) {
        setInputValue(pendingPrompt);
        setAutoSubmit(true); // Flag to auto-submit after mounting
      }
      
      // Check URL for promptLimit parameter
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('promptLimit') === 'true' && user) {
          setShowLimitModal(true);
        }
      }
    }, 200);
    
    return () => clearTimeout(timer);
  }, [user]);

  // Auto-submit the form if we have a pending prompt
  useEffect(() => {
    if (autoSubmit && inputValue && !isSubmitting) {
      const timer = setTimeout(() => {
        handleSubmit(inputValue);
        setAutoSubmit(false);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [autoSubmit, inputValue, isSubmitting, handleSubmit]);

  // Handle mobile menu button click
  const handleMenuClick = () => {
    setOpenMobile(true);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 flex flex-col">
        <div className="flex flex-col items-center justify-center h-full w-full">
          {isMobile && (
            <div className="absolute top-4 left-4 z-10">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8" 
                    onClick={handleMenuClick}
                  >
                    <Menu className="h-4 w-4" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open menu</TooltipContent>
              </Tooltip>
            </div>
          )}

          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[560px] max-w-[90%]">
            <div className="text-center mb-10">
              <style jsx>{`
                @keyframes fadeIn {
                  from { opacity: 0; }
                  to { opacity: 1; }
                }
                .welcome-title {
                  opacity: 0;
                  animation: fadeIn 0.5s ease-in-out forwards;
                  animation-delay: 0.5s;
                }
              `}</style>
              {user && (
                <h1 className="text-4xl font-medium text-foreground mb-2 welcome-title">
                  Olá, {user.user_metadata?.nome ? user.user_metadata.nome.split(' ')[0] : ''}!
                </h1>
              )}
              <h2 className="text-2xl text-muted-foreground">O que você gostaria que o Thanus fizesse hoje?</h2>
            </div>
            
            <ChatInput 
              ref={chatInputRef}
              onSubmit={handleSubmit} 
              loading={isSubmitting}
              placeholder="Descreva com o que você precisa de ajuda..."
              value={inputValue}
              onChange={setInputValue}
              hideAttachments={false}
            />
          </div>
          
          {/* Billing Error Alert */}
          <BillingErrorAlert
            message={billingError?.message}
            currentUsage={billingError?.currentUsage}
            limit={billingError?.limit}
            accountId={personalAccount?.account_id}
            onDismiss={clearBillingError}
            isOpen={!!billingError}
          />
          
          {/* Prompt Limit Modal */}
          {user && (
            <PromptLimitModal
              isOpen={showLimitModal}
              onClose={() => setShowLimitModal(false)}
              userId={user.id}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center h-full w-full">
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[560px] max-w-[90%]">
          <div className="flex flex-col items-center text-center mb-10">
            <Skeleton className="h-10 w-40 mb-2" />
            <Skeleton className="h-7 w-56" />
          </div>
          
          <Skeleton className="w-full h-[100px] rounded-xl" />
          <div className="flex justify-center mt-3">
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
