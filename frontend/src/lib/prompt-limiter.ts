/**
 * Utilitário para limitar o número de prompts por usuário por dia
 * Usa o Supabase para armazenar os dados de uso
 */

import { createClient } from '@/lib/supabase/client';

// Interface para representar o uso de prompts
export interface PromptUsage {
  count: number;
  date: string;
  invites: string[]; // IDs dos usuários convidados
}

// Interface para representar um convite
export interface UserInvite {
  id: string;
  inviter_id: string;
  invite_code: string;
  email: string;
  used: boolean;
  created_at: string;
}

// Classe de erro personalizada para limite excedido
export class PromptLimitExceededError extends Error {
  current_count: number;
  max_allowed: number;
  
  constructor(message: string, current_count?: number, max_allowed?: number) {
    super(message);
    this.name = 'PromptLimitExceededError';
    this.current_count = current_count || 0;
    this.max_allowed = max_allowed || 0;
  }
}

// Número máximo de prompts permitidos por dia
const MAX_PROMPTS_PER_DAY = 6;

// Número de prompts extras por convite
const EXTRA_PROMPTS_PER_INVITE = 1;

// Chave para armazenar no localStorage (fallback)
const STORAGE_KEY = 'agent0-prompt-usage';

/**
 * Obtém a data atual no formato YYYY-MM-DD
 */
function getCurrentDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Obtém o uso de prompts para um usuário específico do Supabase
 */
export async function getPromptUsage(userId: string): Promise<PromptUsage> {
  if (!userId) {
    return { count: 0, date: getCurrentDate(), invites: [] };
  }

  try {
    const supabase = createClient();
    const currentDate = getCurrentDate();

    // Buscar o uso de prompts do usuário para hoje
    const { data: usageData, error: usageError } = await supabase
      .from('prompt_usage')
      .select('*')
      .eq('user_id', userId)
      .eq('date', currentDate)
      .single();

    if (usageError && usageError.code !== 'PGRST116') { // PGRST116 é o código para 'não encontrado'
      console.error('Erro ao buscar uso de prompts:', usageError);
      return getFallbackPromptUsage(userId);
    }

    // Buscar os convites do usuário que foram utilizados
    const { data: invitesData, error: invitesError } = await supabase
      .from('user_invites')
      .select('email')
      .eq('inviter_id', userId)
      .eq('used', true);

    if (invitesError) {
      console.error('Erro ao buscar convites:', invitesError);
      return getFallbackPromptUsage(userId);
    }

    // Se não encontrou uso para hoje, retorna um objeto novo
    if (!usageData) {
      return {
        count: 0,
        date: currentDate,
        invites: invitesData?.map(invite => invite.email) || []
      };
    }

    // Retorna o uso encontrado com os convites
    return {
      count: usageData.count || 0,
      date: currentDate,
      invites: invitesData?.map(invite => invite.email) || []
    };
  } catch (error) {
    console.error('Erro ao obter uso de prompts do Supabase:', error);
    return getFallbackPromptUsage(userId);
  }
}

/**
 * Função de fallback para obter uso de prompts do localStorage
 */
function getFallbackPromptUsage(userId: string): PromptUsage {
  try {
    const storageData = localStorage.getItem(STORAGE_KEY);
    if (!storageData) {
      return { count: 0, date: getCurrentDate(), invites: [] };
    }

    const usageData = JSON.parse(storageData);
    const userUsage = usageData[userId];

    if (!userUsage) {
      return { count: 0, date: getCurrentDate(), invites: [] };
    }

    // Verificar se o uso é de hoje
    if (userUsage.date !== getCurrentDate()) {
      return { count: 0, date: getCurrentDate(), invites: [] };
    }

    // Garantir que o campo invites exista
    if (!userUsage.invites) {
      userUsage.invites = [];
    }

    return userUsage;
  } catch (error) {
    console.error('Erro ao obter uso de prompts do localStorage:', error);
    return { count: 0, date: getCurrentDate(), invites: [] };
  }
}

/**
 * Incrementa a contagem de prompts para um usuário no Supabase
 */
export async function incrementPromptCount(userId: string): Promise<PromptUsage> {
  if (!userId) {
    return { count: 0, date: getCurrentDate(), invites: [] };
  }

  try {
    const supabase = createClient();
    const currentDate = getCurrentDate();

    // Verificar se já existe um registro para hoje
    const { data: existingData, error: checkError } = await supabase
      .from('prompt_usage')
      .select('*')
      .eq('user_id', userId)
      .eq('date', currentDate)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Erro ao verificar uso de prompts existente:', checkError);
      return incrementFallbackPromptCount(userId);
    }

    let result;

    if (!existingData) {
      // Criar novo registro se não existir
      result = await supabase
        .from('prompt_usage')
        .insert({
          user_id: userId,
          date: currentDate,
          count: 1
        })
        .select()
        .single();
    } else {
      // Atualizar registro existente
      result = await supabase
        .from('prompt_usage')
        .update({
          count: existingData.count + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingData.id)
        .select()
        .single();
    }

    if (result.error) {
      console.error('Erro ao incrementar contagem de prompts:', result.error);
      return incrementFallbackPromptCount(userId);
    }

    // Buscar os convites do usuário que foram utilizados
    const { data: invitesData, error: invitesError } = await supabase
      .from('user_invites')
      .select('email')
      .eq('inviter_id', userId)
      .eq('used', true);

    if (invitesError) {
      console.error('Erro ao buscar convites após incremento:', invitesError);
    }

    return {
      count: result.data.count,
      date: currentDate,
      invites: invitesData?.map(invite => invite.email) || []
    };
  } catch (error) {
    console.error('Erro ao incrementar contagem de prompts no Supabase:', error);
    return incrementFallbackPromptCount(userId);
  }
}

/**
 * Função de fallback para incrementar contagem de prompts no localStorage
 */
function incrementFallbackPromptCount(userId: string): PromptUsage {
  try {
    const currentDate = getCurrentDate();
    const storageData = localStorage.getItem(STORAGE_KEY);
    let usageData = storageData ? JSON.parse(storageData) : {};

    // Inicializar ou resetar se for um novo dia
    if (!usageData[userId] || usageData[userId].date !== currentDate) {
      usageData[userId] = { count: 0, date: currentDate, invites: [] };
    }

    // Garantir que o campo invites exista
    if (!usageData[userId].invites) {
      usageData[userId].invites = [];
    }

    // Incrementar contagem
    usageData[userId].count += 1;

    // Salvar no localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usageData));

    return usageData[userId];
  } catch (error) {
    console.error('Erro ao incrementar contagem de prompts no localStorage:', error);
    return { count: 1, date: getCurrentDate(), invites: [] };
  }
}

/**
 * Registra um convite enviado pelo usuário no Supabase
 */
export async function registerInvite(userId: string, invitedEmail: string): Promise<PromptUsage> {
  if (!userId || !invitedEmail) {
    return getFallbackPromptUsage(userId);
  }

  try {
    const supabase = createClient();

    // Registrar o convite no Supabase
    const { error: inviteError } = await supabase
      .from('user_invites')
      .insert({
        inviter_id: userId,
        email: invitedEmail.toLowerCase()
      });

    if (inviteError) {
      console.error('Erro ao registrar convite no Supabase:', inviteError);
      return registerFallbackInvite(userId, invitedEmail);
    }

    // Retornar o uso atualizado
    return await getPromptUsage(userId);
  } catch (error) {
    console.error('Erro ao registrar convite:', error);
    return registerFallbackInvite(userId, invitedEmail);
  }
}

/**
 * Função de fallback para registrar convite no localStorage
 */
function registerFallbackInvite(userId: string, invitedEmail: string): PromptUsage {
  try {
    const currentDate = getCurrentDate();
    const storageData = localStorage.getItem(STORAGE_KEY);
    let usageData = storageData ? JSON.parse(storageData) : {};

    // Inicializar se necessário
    if (!usageData[userId]) {
      usageData[userId] = { count: 0, date: currentDate, invites: [] };
    }

    // Garantir que o campo invites exista
    if (!usageData[userId].invites) {
      usageData[userId].invites = [];
    }

    // Adicionar convite se ainda não existir
    if (!usageData[userId].invites.includes(invitedEmail)) {
      usageData[userId].invites.push(invitedEmail);
    }

    // Salvar no localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usageData));

    return usageData[userId];
  } catch (error) {
    console.error('Erro ao registrar convite no localStorage:', error);
    return getFallbackPromptUsage(userId);
  }
}

/**
 * Gera um link de convite para o usuário
 */
export async function generateInviteLink(userId: string, invitedEmail: string): Promise<string> {
  try {
    const supabase = createClient();

    // Registrar o convite no Supabase
    const { data, error } = await supabase
      .from('user_invites')
      .insert({
        inviter_id: userId,
        email: invitedEmail.toLowerCase()
      })
      .select('invite_code')
      .single();

    if (error) {
      console.error('Erro ao gerar link de convite:', error);
      return '';
    }

    // Retornar o link de convite
    const baseUrl = window.location.origin;
    return `${baseUrl}/signup?invite=${data.invite_code}`;
  } catch (error) {
    console.error('Erro ao gerar link de convite:', error);
    return '';
  }
}

/**
 * Verifica se o usuário ainda pode fazer prompts hoje
 */
export async function canMakePrompt(userId: string): Promise<boolean> {
  const usage = await getPromptUsage(userId);
  const totalAllowed = MAX_PROMPTS_PER_DAY + (usage.invites.length * EXTRA_PROMPTS_PER_INVITE);
  return usage.count < totalAllowed;
}

/**
 * Retorna o número de prompts restantes para o usuário hoje
 */
export async function getRemainingPrompts(userId: string): Promise<number> {
  const usage = await getPromptUsage(userId);
  const totalAllowed = MAX_PROMPTS_PER_DAY + (usage.invites.length * EXTRA_PROMPTS_PER_INVITE);
  return Math.max(0, totalAllowed - usage.count);
}

/**
 * Retorna o número máximo de prompts permitidos por dia
 */
export function getMaxPromptsPerDay(): number {
  return MAX_PROMPTS_PER_DAY;
}

/**
 * Retorna o número de prompts extras por convite
 */
export function getExtraPromptsPerInvite(): number {
  return EXTRA_PROMPTS_PER_INVITE;
}
