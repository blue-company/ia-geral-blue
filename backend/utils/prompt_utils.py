"""
Utilitários para verificação e gerenciamento de limites de prompts.
"""

import logging
from datetime import datetime, timezone
from typing import Tuple, Optional

logger = logging.getLogger(__name__)

# Número máximo de prompts permitidos por dia
MAX_PROMPTS_PER_DAY = 6

# Número de prompts extras por convite
EXTRA_PROMPTS_PER_INVITE = 1

async def check_prompt_limit(client, user_id: str) -> Tuple[bool, str, int, int]:
    """
    Verifica se o usuário ainda pode fazer prompts hoje.
    
    Args:
        client: Cliente Supabase
        user_id: ID do usuário
        
    Returns:
        Tuple contendo:
        - can_make_prompt: True se o usuário ainda pode fazer prompts
        - message: Mensagem explicativa
        - current_count: Contagem atual de prompts
        - max_allowed: Número máximo de prompts permitidos
    """
    logger.info(f"Verificando limite de prompts para o usuário: {user_id}")
    try:
        # Obter a data atual
        current_date = datetime.now(timezone.utc).date().isoformat()
        logger.info(f"Data atual para verificação: {current_date}")
        
        # Verificar o uso atual de prompts
        usage_result = await client.table('prompt_usage')\
            .select('*')\
            .eq('user_id', user_id)\
            .eq('date', current_date)\
            .execute()
        
        logger.info(f"Resultado da consulta de uso: {usage_result.data if hasattr(usage_result, 'data') else 'sem dados'}")
        
        # Verificar convites utilizados
        invites_result = await client.table('user_invites')\
            .select('*')\
            .eq('inviter_id', user_id)\
            .eq('used', True)\
            .execute()
            
        logger.info(f"Resultado da consulta de convites: {invites_result.data if hasattr(invites_result, 'data') else 'sem convites'}")
        
        # Calcular o número de prompts permitidos
        invites_count = len(invites_result.data) if invites_result.data else 0
        
        # Verificar se há um registro de uso com bonus_count
        bonus_count = 0
        if usage_result.data and 'bonus_count' in usage_result.data[0]:
            bonus_count = usage_result.data[0]['bonus_count'] or 0
            logger.info(f"Bônus de prompts encontrado no registro: {bonus_count}")
        
        # Se não houver bonus_count no registro, usar o número de convites utilizados
        if bonus_count == 0:
            bonus_count = invites_count
            logger.info(f"Usando número de convites como bônus: {invites_count}")
        
        max_allowed = MAX_PROMPTS_PER_DAY + (bonus_count * EXTRA_PROMPTS_PER_INVITE)
        logger.info(f"Limite calculado: {max_allowed} (base: {MAX_PROMPTS_PER_DAY} + bônus: {bonus_count} convites)")
        
        # Verificar se já existe um registro para hoje
        if not usage_result.data:
            # Nenhum uso hoje ainda
            logger.info(f"Nenhum uso de prompts hoje para o usuário {user_id}")
            return True, "Prompt disponível", 0, max_allowed
        
        # Obter a contagem atual
        current_count = usage_result.data[0]['count']
        logger.info(f"Contagem atual de prompts: {current_count}/{max_allowed}")
        
        # Verificar se excedeu o limite
        if current_count >= max_allowed:
            logger.warning(f"Limite de prompts excedido: {current_count}/{max_allowed}")
            return False, f"Limite diário de {max_allowed} prompts atingido", current_count, max_allowed
        
        logger.info(f"Prompt disponível: {current_count}/{max_allowed}")
        return True, "Prompt disponível", current_count, max_allowed
        
    except Exception as e:
        logger.error(f"Erro ao verificar limite de prompts: {str(e)}")
        # Em caso de erro, bloquear o prompt para evitar uso excessivo
        return False, "Erro ao verificar limite, bloqueando prompt por segurança", 0, MAX_PROMPTS_PER_DAY
