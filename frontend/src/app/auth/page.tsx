"use client";

import Link from "next/link";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import GoogleSignIn from "@/components/GoogleSignIn";
import { FlickeringGrid } from "@/components/home/ui/flickering-grid";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useState, useEffect, useRef, Suspense } from "react";
import { useScroll } from "motion/react";
import { signIn, signUp, forgotPassword } from "./actions";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, X, CheckCircle, AlertCircle, MailCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();
  const mode = searchParams.get("mode");
  const returnUrl = searchParams.get("returnUrl");
  const message = searchParams.get("message");
  
  const isSignUp = mode === 'signup';
  const tablet = useMediaQuery("(max-width: 1024px)");
  const [mounted, setMounted] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const { scrollY } = useScroll();
  
  // Redirect if user is already logged in, checking isLoading state
  useEffect(() => {
    if (!isLoading && user) {
      router.push(returnUrl || '/dashboard');
    }
  }, [user, isLoading, router, returnUrl]);
  
  // Determine if message is a success message
  const isSuccessMessage = message && (
    message.includes("Check your email") || 
    message.includes("Account created") ||
    message.includes("success")
  );
  
  // Registration success state
  const [registrationSuccess, setRegistrationSuccess] = useState(!!isSuccessMessage);
  const [registrationEmail, setRegistrationEmail] = useState("");
  
  // Estado de recuperação de senha
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordStatus, setForgotPasswordStatus] = useState<{
    success?: boolean;
    message?: string;
  }>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  // Set registration success state from URL params
  useEffect(() => {
    if (isSuccessMessage) {
      setRegistrationSuccess(true);
    }
  }, [isSuccessMessage]);

  // Detect when scrolling is active to reduce animation complexity
  useEffect(() => {
    const unsubscribe = scrollY.on("change", () => {
      setIsScrolling(true);
      
      // Clear any existing timeout
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      
      // Set a new timeout
      scrollTimeout.current = setTimeout(() => {
        setIsScrolling(false);
      }, 300); // Wait 300ms after scroll stops
    });
    
    return () => {
      unsubscribe();
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, [scrollY]);

  const handleSignIn = async (prevState: any, formData: FormData) => {
    if (returnUrl) {
      formData.append("returnUrl", returnUrl);
    } else {
      formData.append("returnUrl", "/dashboard");
    }
    const result = await signIn(prevState, formData);
    
    // Check for success and redirectTo properties
    if (result && typeof result === 'object' && 'success' in result && result.success && 'redirectTo' in result) {
      // Use window.location for hard navigation to avoid stale state
      window.location.href = result.redirectTo as string;
      return null; // Return null to prevent normal form action completion
    }
    
    return result;
  };

  const handleSignUp = async (prevState: any, formData: FormData) => {
    // Store email for success state
    const email = formData.get("email") as string;
    setRegistrationEmail(email);

    if (returnUrl) {
      formData.append("returnUrl", returnUrl);
    }
    
    // Add origin for email redirects
    formData.append("origin", window.location.origin);
    
    const result = await signUp(prevState, formData);
    
    // Check for success and redirectTo properties (direct login case)
    if (result && typeof result === 'object' && 'success' in result && result.success && 'redirectTo' in result) {
      // Use window.location for hard navigation to avoid stale state
      window.location.href = result.redirectTo as string;
      return null; // Return null to prevent normal form action completion
    }
    
    // Check if registration was successful but needs email verification
    if (result && typeof result === 'object' && 'message' in result) {
      const resultMessage = result.message as string;
      if (resultMessage.includes("Check your email")) {
        setRegistrationSuccess(true);
        
        // Update URL without causing a refresh
        const params = new URLSearchParams(window.location.search);
        params.set('message', resultMessage);
        
        const newUrl = 
          window.location.pathname + 
          (params.toString() ? '?' + params.toString() : '');
          
        window.history.pushState({ path: newUrl }, '', newUrl);
        
        return result;
      }
    }
    
    return result;
  };
  
  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    setForgotPasswordStatus({});
    
    if (!forgotPasswordEmail || !forgotPasswordEmail.includes('@')) {
      setForgotPasswordStatus({ 
        success: false, 
        message: "Por favor, insira um endereço de e-mail válido" 
      });
      return;
    }
    
    const formData = new FormData();
    formData.append("email", forgotPasswordEmail);
    formData.append("origin", window.location.origin);
    
    const result = await forgotPassword(null, formData);
    
    setForgotPasswordStatus(result);
  };

  const resetRegistrationSuccess = () => {
    setRegistrationSuccess(false);
    // Remove message from URL and set mode to signin
    const params = new URLSearchParams(window.location.search);
    params.delete('message');
    params.set('mode', 'signin');
    
    const newUrl = 
      window.location.pathname + 
      (params.toString() ? '?' + params.toString() : '');
      
    window.history.pushState({ path: newUrl }, '', newUrl);
    
    router.refresh();
  };

  // Show loading spinner while checking auth state
  if (isLoading) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen w-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </main>
    );
  }

  // Registration success view
  if (registrationSuccess) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen w-full bg-black">
        <div className="w-full">
          <section className="w-full relative overflow-hidden">
            <div className="relative flex flex-col items-center w-full px-6">
              {/* Background gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-black via-black to-blue-900 -z-10"></div>
              
              {/* Radial glow effect */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.3)_0%,_rgba(0,0,0,0)_70%)] -z-10"></div>
              
              {/* Success content */}
              <div className="relative z-10 pt-24 pb-8 max-w-xl mx-auto h-full w-full flex flex-col gap-2 items-center justify-center">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-green-50 dark:bg-green-950/20 rounded-full p-4 mb-6">
                    <MailCheck className="h-12 w-12 text-green-500 dark:text-green-400" />
                  </div>
                  
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-medium tracking-tighter text-center text-balance bg-gradient-to-r from-blue-300 via-blue-400 to-blue-500 text-transparent bg-clip-text mb-4">
                    Verifique seu e-mail
                  </h1>
                  
                  <p className="text-base md:text-lg text-center text-muted-foreground font-medium text-balance leading-relaxed tracking-tight max-w-md mb-2">
                    Enviamos um link de confirmação para:
                  </p>
                  
                  <p className="text-lg font-medium mb-6">
                    {registrationEmail || "seu endereço de e-mail"}
                  </p>
                  
                  <div className="bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/50 rounded-lg p-6 mb-8 max-w-md w-full">
                    <p className="text-sm text-green-800 dark:text-green-400 leading-relaxed">
                      Clique no link no e-mail para ativar sua conta. Se você não vir o e-mail, verifique sua pasta de spam.
                    </p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
                    <Link
                      href="/"
                      className="flex h-12 items-center justify-center w-full text-center rounded-full border border-border bg-background hover:bg-accent/20 transition-all"
                    >
                      Voltar para a página inicial
                    </Link>
                    <button
                      onClick={resetRegistrationSuccess}
                      className="flex h-12 items-center justify-center w-full text-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md"
                    >
                      Voltar para o login
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen w-full bg-black">
      <div className="w-full">
        {/* Hero-like header with flickering grid */}
        <section className="w-full relative overflow-hidden">
          <div className="relative flex flex-col items-center w-full px-6">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-black via-black to-blue-900 -z-10"></div>
            
            {/* Radial glow effect */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.3)_0%,_rgba(0,0,0,0)_70%)] -z-10"></div>
            
            {/* Header content */}
            <div className="relative z-10 pt-24 pb-8 max-w-md mx-auto h-full w-full flex flex-col gap-2 items-center justify-center">
              <Link 
                href="/" 
                className="group border border-border/50 bg-background hover:bg-accent/20 rounded-full text-sm h-8 px-3 flex items-center gap-2 transition-all duration-200 shadow-sm mb-6"
              >
                <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-muted-foreground text-xs tracking-wide">Voltar para a página inicial</span>
              </Link>
              
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-medium tracking-tighter text-center text-balance bg-gradient-to-r from-blue-300 via-blue-400 to-blue-500 text-transparent bg-clip-text">
                {isSignUp ? "Junte-se ao AgentZERO" : "Bem-vindo de volta"}
              </h1>
              <p className="text-base md:text-lg text-center text-muted-foreground font-medium text-balance leading-relaxed tracking-tight mt-2 mb-6">
                {isSignUp ? "Crie sua conta e comece a construir com IA" : "Entre na sua conta para continuar"}
              </p>
            </div>
            
            {/* Form container */}
            <div className="relative z-10 w-full max-w-md mx-auto pb-24">
              <form className="space-y-6">
                <div className="space-y-4">
                  {/* OAuth providers */}
                  <GoogleSignIn />
                  
                  {/* Divider */}
                  <div className="relative flex items-center my-6">
                    <div className="flex-grow border-t border-border"></div>
                    <span className="px-2 bg-[#F3F4F6] dark:bg-[#F9FAFB]/[0.02] text-muted-foreground">
                      ou continue com e-mail
                    </span>
                    <div className="flex-grow border-t border-border"></div>
                  </div>


                  {isSignUp && (
                    <div className="space-y-2">
                    <Input
                      id="nome"
                      name="nome"
                      type="text"
                      placeholder="Nome"
                      className="h-12 rounded-full bg-blue-900/30 border border-blue-400/30 text-white placeholder-blue-300/70 focus:outline-none focus:ring-2 focus:ring-blue-400/50 text-lg"
                      required
                    />
                  </div>
                  )}

                  {isSignUp && (
                    <div className="space-y-2">
                    <Input
                      id="celular"
                      name="celular"
                      type="celular"
                      placeholder="Celular"
                      className="h-12 rounded-full bg-blue-900/30 border border-blue-400/30 text-white placeholder-blue-300/70 focus:outline-none focus:ring-2 focus:ring-blue-400/50 text-lg"
                      required
                    />
                  </div>
                  )}
                  
                  {/* Email field */}
                  <div className="space-y-2">
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="Endereço de e-mail"
                      className="h-12 rounded-full bg-blue-900/30 border border-blue-400/30 text-white placeholder-blue-300/70 focus:outline-none focus:ring-2 focus:ring-blue-400/50 text-lg"
                      required
                    />
                  </div>
                  
                  {/* Password field */}
                  <div className="space-y-2">
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="Senha"
                      className="h-12 rounded-full bg-blue-900/30 border border-blue-400/30 text-white placeholder-blue-300/70 focus:outline-none focus:ring-2 focus:ring-blue-400/50 text-lg"
                      required
                    />
                  </div>
                  
                  {/* Confirm password field (only for signup) */}
                  {isSignUp && (
                    <div className="space-y-2">
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        placeholder="Confirme a senha"
                        className="h-12 rounded-full bg-blue-900/30 border border-blue-400/30 text-white placeholder-blue-300/70 focus:outline-none focus:ring-2 focus:ring-blue-400/50 text-lg"
                        required
                      />
                    </div>
                  )}
                  
                  {/* Forgot password link (only for signin) */}
                  {!isSignUp && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setForgotPasswordOpen(true)}
                        className="text-sm text-primary hover:underline"
                      >
                        Esqueceu a senha?
                      </button>
                    </div>
                  )}
                  
                  {/* Action buttons */}
                  <div className="flex flex-col gap-3 pt-2">
                    {isSignUp ? (
                      <>
                        <SubmitButton
                          formAction={handleSignUp}
                          className="w-full h-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md"
                          pendingText="Criando conta..."
                        >
                          Cadastrar
                        </SubmitButton>
                        
                        <Link
                          href={`/auth${returnUrl ? `?returnUrl=${returnUrl}` : ''}`}
                          className="flex h-12 items-center justify-center w-full text-center rounded-full border border-border bg-background hover:bg-accent/20 transition-all"
                        >
                          Voltar para login
                        </Link>
                      </>
                    ) : (
                      <>
                        <SubmitButton
                          formAction={handleSignIn}
                          className="w-full h-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md"
                          pendingText="Entrando..."
                        >
                          Entrar
                        </SubmitButton>
                        
                        <Link
                          href={`/auth?mode=signup${returnUrl ? `&returnUrl=${returnUrl}` : ''}`}
                          className="flex h-12 items-center justify-center w-full text-center rounded-full border border-border bg-background hover:bg-accent/20 transition-all"
                        >
                          Criar nova conta
                        </Link>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Sign in/up toggle */}
                <div className="text-center text-sm text-muted-foreground">
                  {isSignUp ? (
                    <>
                      Já tem uma conta?{" "}
                      <Link
                        href="/auth"
                        className="text-primary hover:underline"
                      >
                        Entrar
                      </Link>
                    </>
                  ) : (
                    <>
                      Não tem uma conta?{" "}
                      <Link
                        href="/auth?mode=signup"
                        className="text-primary hover:underline"
                      >
                        Cadastre-se
                      </Link>
                    </>
                  )}
                </div>
              </form>

              <div className="mt-8 text-center text-xs text-muted-foreground">
                Ao continuar, você concorda com nossos{' '}
                <Link href="/terms" className="text-primary hover:underline">
                  Termos de Serviço
                </Link>{' '}
                e{' '}<Link href="/privacy" className="text-primary hover:underline">Política de Privacidade</Link>
              </div>
            </div>
          </div>
        </section>
      </div>
      
      {/* Forgot Password Dialog */}
      <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
        <DialogContent className="sm:max-w-md rounded-xl bg-black border border-blue-900/30 text-white">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-medium bg-gradient-to-r from-blue-300 via-blue-400 to-blue-500 text-transparent bg-clip-text">Redefinir Senha</DialogTitle>
              <button 
                onClick={() => setForgotPasswordOpen(false)}
                className="rounded-full p-1 hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <DialogDescription className="text-muted-foreground">
              Digite seu endereço de e-mail e enviaremos um link para redefinir sua senha.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleForgotPassword} className="space-y-4 py-4">
            <Input
              id="forgot-password-email"
              type="email"
              placeholder="Endereço de e-mail"
              value={forgotPasswordEmail}
              onChange={(e) => setForgotPasswordEmail(e.target.value)}
              className="h-12 rounded-full bg-blue-900/30 border border-blue-400/30 text-white placeholder-blue-300/70 focus:outline-none focus:ring-2 focus:ring-blue-400/50 text-lg"
              required
            />
            
            {forgotPasswordStatus.message && (
              <div className={`p-4 rounded-lg flex items-center gap-3 ${
                forgotPasswordStatus.success 
                  ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50 text-green-800 dark:text-green-400" 
                  : "bg-secondary/10 border border-secondary/20 text-secondary"
              }`}>
                {forgotPasswordStatus.success ? (
                  <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-500 dark:text-green-400" />
                ) : (
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-secondary" />
                )}
                <span className="text-sm font-medium">{forgotPasswordStatus.message}</span>
              </div>
            )}
            
            <DialogFooter className="flex sm:justify-start gap-3 pt-2">
              <button
                type="submit"
                className="h-12 px-6 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md"
              >
                Enviar Link de Redefinição
              </button>
              <button
                type="button"
                onClick={() => setForgotPasswordOpen(false)}
                className="h-12 px-6 rounded-full border border-border bg-background hover:bg-accent/20 transition-all"
              >
                Cancelar
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default function Login() {
  return (
    <Suspense fallback={
      <main className="flex flex-col items-center justify-center min-h-screen w-full">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
      </main>
    }>
      <LoginContent />
    </Suspense>
  );
}
