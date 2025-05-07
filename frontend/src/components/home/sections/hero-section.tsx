"use client"

import { siteConfig } from "@/lib/home";
import { ArrowRight, Github, X, AlertCircle } from "lucide-react";
import { FlickeringGrid } from "@/components/home/ui/flickering-grid";
import { HeroVideoSection } from "@/components/home/sections/hero-video-section";

import { useMediaQuery } from "@/hooks/use-media-query";
import { useState, useEffect, useRef, FormEvent } from "react";
import { useScroll } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { createProject, createThread, addUserMessage, startAgent, BillingError } from "@/lib/api";
import { generateThreadName } from "@/lib/actions/threads";
import GoogleSignIn from "@/components/GoogleSignIn";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogOverlay
} from "@/components/ui/dialog";
import { BillingErrorAlert } from '@/components/billing/usage-limit-alert';
import { useBillingError } from "@/hooks/useBillingError";
import { useAccounts } from "@/hooks/use-accounts";
import { isLocalMode, config } from "@/lib/config";
import { toast } from "sonner";

// Custom dialog overlay with blur effect
const BlurredDialogOverlay = () => (
  <DialogOverlay className="bg-background/40 backdrop-blur-md" />
);

// Constant for localStorage key to ensure consistency
const PENDING_PROMPT_KEY = 'pendingInventuPrompt';

export function HeroSection() {
  const { hero } = siteConfig;
  const tablet = useMediaQuery("(max-width: 1024px)");
  const [mounted, setMounted] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const { scrollY } = useScroll();
  const [inputValue, setInputValue] = useState("");
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { billingError, handleBillingError, clearBillingError } = useBillingError();
  const { data: accounts } = useAccounts();
  const personalAccount = accounts?.find(account => account.personal_account);
  
  // Auth dialog state
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Store the input value when auth dialog opens
  useEffect(() => {
    if (authDialogOpen && inputValue.trim()) {
      localStorage.setItem(PENDING_PROMPT_KEY, inputValue.trim());
    }
  }, [authDialogOpen, inputValue]);
  
  // Close dialog and redirect when user authenticates
  useEffect(() => {
    if (authDialogOpen && user && !isLoading) {
      setAuthDialogOpen(false);
      router.push('/dashboard');
    }
  }, [user, isLoading, authDialogOpen, router]);

  // Create an agent with the provided prompt
  const createAgentWithPrompt = async () => {
    if (!inputValue.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      // Generate a name for the project using GPT
      const projectName = await generateThreadName(inputValue);
      
      // 1. Create a new project with the GPT-generated name
      const newAgent = await createProject({
        name: projectName,
        description: "",
      });
      
      // 2. Create a new thread for this project
      const thread = await createThread(newAgent.id);
      
      // 3. Add the user message to the thread
      await addUserMessage(thread.thread_id, inputValue.trim());
      
      // 4. Start the agent with the thread ID
      await startAgent(thread.thread_id, {
        stream: true
      });
      
      // 5. Navigate to the new agent's thread page
      router.push(`/agents/${thread.thread_id}`);
      // Clear input on success
      setInputValue("");
    } catch (error: any) {
      console.error("Error creating agent:", error);

      // Check specifically for BillingError (402)
      if (error instanceof BillingError) {
        console.log("Handling BillingError from hero section:", error.detail);
        handleBillingError({
          message: error.detail.message || 'Monthly usage limit reached. Please upgrade your plan.',
          currentUsage: error.detail.currentUsage as number | undefined,
          limit: error.detail.limit as number | undefined,
          subscription: error.detail.subscription || {
            price_id: config.SUBSCRIPTION_TIERS.FREE.priceId, // Default Free
            plan_name: "Free"
          }
        });
        // Don't show toast for billing errors
      } else {
         // Handle other errors (e.g., network, other API errors)
         const isConnectionError = error instanceof TypeError && error.message.includes('Failed to fetch');
         if (!isLocalMode() || isConnectionError) {
            toast.error(error.message || "Failed to create agent. Please try again.");
         }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e?: FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation(); // Stop event propagation to prevent dialog closing
    }
    
    if (!inputValue.trim() || isSubmitting) return;
    
    // If user is not logged in, save prompt and show auth dialog
    if (!user && !isLoading) {
      // Save prompt to localStorage BEFORE showing the dialog
      localStorage.setItem(PENDING_PROMPT_KEY, inputValue.trim());
      setAuthDialogOpen(true);
      return;
    }
    
    // User is logged in, create the agent
    createAgentWithPrompt();
  };
  
  // Handle Enter key press
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault(); // Prevent default form submission
      e.stopPropagation(); // Stop event propagation
      handleSubmit();
    }
  };
  
  // Handle auth form submission
  const handleSignIn = async (prevState: any, formData: FormData) => {
    setAuthError(null);
    try {
      // Implement sign in logic here
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;
      
      // Add the returnUrl to the form data for proper redirection
      formData.append("returnUrl", "/dashboard");
      
      // Call your authentication function here
      
      // Return any error state
      return { message: "Invalid credentials" };
    } catch (error) {
      console.error("Sign in error:", error);
      setAuthError(error instanceof Error ? error.message : "An error occurred");
      return { message: "An error occurred during sign in" };
    }
  };

  return (
    <section id="hero" className="w-full min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-black via-black to-blue-900 -z-10"></div>
      
      {/* Radial glow effect */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.3)_0%,_rgba(0,0,0,0)_70%)] -z-10"></div>
      
      <div className="container mx-auto px-4 text-center">
        <div className="inline-block px-4 py-1.5 mb-4 text-xs font-medium bg-gradient-to-r from-blue-300 via-blue-400 to-blue-600 text-transparent bg-clip-text border border-blue-400/50 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.3)]">
          Beta
        </div>
        
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-br from-blue-200 via-blue-400 to-blue-600 text-transparent bg-clip-text drop-shadow-sm">
          Conheça o<br />AgentZERO
        </h1>
        
        <p className="mb-8 bg-gradient-to-r from-blue-300 via-blue-400 to-blue-500 text-transparent bg-clip-text">
          Agent ZERO is in early beta. Learn more <a href="#" className="underline hover:opacity-80">here</a>.
        </p>
        
        <form onSubmit={handleSubmit} className="max-w-xl w-full mx-auto mt-8">
          <div className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte qualquer coisa ao Agent ZERO..."
              className="w-full px-6 py-4 bg-transparent border border-blue-400/30 rounded-full text-white placeholder-blue-300/70 focus:outline-none focus:ring-2 focus:ring-blue-400/50 text-lg shadow-[0_0_15px_rgba(59,130,246,0.15)] hover:shadow-[0_0_20px_rgba(59,130,246,0.25)] transition-all"
            />
            <button 
              type="submit"
              disabled={!inputValue.trim() || isSubmitting}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-blue-400 to-blue-600 text-white p-3 rounded-full hover:from-blue-500 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Enviar"
            >
              {isSubmitting ? (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Auth Dialog */}
      <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
        <BlurredDialogOverlay />
        <DialogContent className="sm:max-w-md rounded-xl bg-[#F3F4F6] dark:bg-[#F9FAFB]/[0.02] border border-border">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-medium">Sign in to continue</DialogTitle>
              {/* <button 
                onClick={() => setAuthDialogOpen(false)}
                className="rounded-full p-1 hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button> */}
            </div>
            <DialogDescription className="text-muted-foreground">
              Sign in or create an account to talk with InventuAI
            </DialogDescription>
          </DialogHeader>
          
          {/* Auth error message */}
          {authError && (
            <div className="mb-4 p-3 rounded-lg flex items-center gap-3 bg-secondary/10 border border-secondary/20 text-secondary">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-secondary" />
              <span className="text-sm font-medium">{authError}</span>
            </div>
          )}
          
          {/* Google Sign In */}
          <div className="w-full">
            <GoogleSignIn returnUrl="/dashboard" />
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-[#F3F4F6] dark:bg-[#F9FAFB]/[0.02] text-muted-foreground">
                or continue with email
              </span>
            </div>
          </div>

          {/* Sign in form */}
          <form className="space-y-4">
            <div>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Email address"
                className="h-12 rounded-full bg-background border-border"
                required
              />
            </div>
            
            <div>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Password"
                className="h-12 rounded-full bg-background border-border"
                required
              />
            </div>
            
            <div className="space-y-4 pt-4">
              <SubmitButton
                formAction={handleSignIn}
                className="w-full h-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md"
                pendingText="Signing in..."
              >
                Sign in
              </SubmitButton>
              
              <Link
                href={`/auth?mode=signup&returnUrl=${encodeURIComponent("/dashboard")}`}
                className="flex h-12 items-center justify-center w-full text-center rounded-full border border-border bg-background hover:bg-accent/20 transition-all"
                onClick={() => setAuthDialogOpen(false)}
              >
                Create new account
              </Link>
            </div>

            <div className="text-center pt-2">
              <Link 
                href={`/auth?returnUrl=${encodeURIComponent("/dashboard")}`}
                className="text-sm text-primary hover:underline"
                onClick={() => setAuthDialogOpen(false)}
              >
                More sign in options
              </Link>
            </div>
          </form>

          <div className="mt-4 text-center text-xs text-muted-foreground">
            By continuing, you agree to our{' '}
            <Link href="/terms" className="text-primary hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}<Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Billing Error Alert */}
      <BillingErrorAlert 
        message={billingError?.message}
        currentUsage={billingError?.currentUsage}
        limit={billingError?.limit}
        accountId={personalAccount?.account_id}
        onDismiss={clearBillingError}
        isOpen={!!billingError}
      />
    </section>
  );
}
