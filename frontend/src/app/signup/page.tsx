'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Verificar se há um código de convite na URL
  useEffect(() => {
    const invite = searchParams.get('invite');
    if (invite) {
      setInviteCode(invite);
    }
  }, [searchParams]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    
    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    
    setLoading(true);
    
    try {
      const supabase = createClient();
      
      // Registrar o usuário
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: inviteCode ? {
            invite_code: inviteCode
          } : undefined
        }
      });
      
      if (error) {
        throw error;
      }
      
      toast.success('Cadastro realizado com sucesso! Verifique seu email para confirmar sua conta.');
      
      // Redirecionar para a página de login após alguns segundos
      setTimeout(() => {
        router.push('/login');
      }, 3000);
      
    } catch (error: any) {
      console.error('Erro ao cadastrar:', error);
      toast.error(error.message || 'Ocorreu um erro ao cadastrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Criar conta</CardTitle>
          <CardDescription>
            {inviteCode 
              ? 'Você foi convidado! Crie sua conta para começar a usar o Agent0.' 
              : 'Preencha os campos abaixo para criar sua conta.'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSignup}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar senha</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            
            {inviteCode && (
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-md border border-green-200 dark:border-green-900/50">
                <p className="text-sm text-green-800 dark:text-green-400">
                  Você está se cadastrando com um convite. Seu amigo receberá um prompt extra quando você confirmar seu cadastro!
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Cadastrando...' : 'Cadastrar'}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Já tem uma conta?{' '}
              <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                Faça login
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
