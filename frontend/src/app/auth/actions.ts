"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signIn(prevState: any, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const returnUrl = formData.get("returnUrl") as string | undefined;
  
  if (!email || !email.includes('@')) {
    return { message: "Por favor insira um email" };
  }
  
  if (!password || password.length < 6) {
    return { message: "Senha deve ter pelo menos 6 caracteres" };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return { message: error.message || "Não foi possível autenticar o usuário" };
  }

  // Use client-side navigation instead of server-side redirect
  return { success: true, redirectTo: returnUrl || "/dashboard" };
}

export async function signUp(prevState: any, formData: FormData) {
  const origin = formData.get("origin") as string;
  const nome = formData.get("nome") as string;
  const celular = formData.get("celular") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;
  const returnUrl = formData.get("returnUrl") as string | undefined;
  
  if (!nome) {
    return { message: "Por favor insira um nome" };
  }

  if (!celular) {
    return { message: "Por favor insira um celular" };
  }

  if (!email || !email.includes('@')) {
    return { message: "Por favor insira um email" };
  }
  
  if (!password || password.length < 6) {
    return { message: "Senha deve ter pelo menos 6 caracteres" };
  }

  if (password !== confirmPassword) {
    return { message: "As senhas não coincidem" };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?returnUrl=${returnUrl}`,
      data: {
        nome: nome,
        celular: celular
      }
    },
  });

  if (error) {
    return { message: error.message || "Não foi possível criar a conta" };
  }

  // Try to sign in immediately
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (signInError) {
    return { message: "Conta criada! Verifique seu email para confirmar seu cadastro." };
  }

  // Use client-side navigation instead of server-side redirect
  return { success: true, redirectTo: returnUrl || "/dashboard" };
}

export async function forgotPassword(prevState: any, formData: FormData) {
  const email = formData.get("email") as string;
  const origin = formData.get("origin") as string;
  
  if (!email || !email.includes('@')) {
    return { message: "Por favor insira um email" };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/reset-password`,
  });

  if (error) {
    return { message: error.message || "Não foi possível enviar o email de redefinição de senha" };
  }

  return { 
    success: true, 
    message: "Verifique seu email para redefinir sua senha" 
  };
}

export async function resetPassword(prevState: any, formData: FormData) {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;
  
  if (!password || password.length < 6) {
    return { message: "Senha deve ter pelo menos 6 caracteres" };
  }

  if (password !== confirmPassword) {
    return { message: "As senhas não coincidem" };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password
  });

  if (error) {
    return { message: error.message || "Não foi possível atualizar a senha" };
  }

  return { 
    success: true, 
    message: "Senha atualizada com sucesso" 
  };
}

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    return { message: error.message || "Não foi possível fazer logout" };
  }

  return redirect("/");
} 