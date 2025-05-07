"""
Utilitários para verificação e gerenciamento de limites de prompts.
"""

import logging
from datetime import datetime, timezone
from typing import Tuple, Optional

logger = logging.getLogger(__name__)

# Número máximo de prompts permitidos por dia
MAX_PROMPTS_PER_DAY = 99999

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
        
        # Verificar convites utilizados com tratamento de erros
        try:
            # Verificar por used=true e used_by não nulo
            invites_result = await client.table('user_invites')\
                .select('*')\
                .eq('inviter_id', user_id)\
                .eq('used', True)\
                .not_('used_by', 'is', 'null')\
                .execute()
                
            logger.info(f"Resultado da consulta de convites: {invites_result.data if hasattr(invites_result, 'data') else 'sem convites'}")
        except Exception as e:
            logger.error(f"Erro ao consultar convites por used_by: {str(e)}")
            invites_result = type('obj', (object,), {'data': []})
        
        try:
            # Também verificar por used_count > 0 para compatibilidade
            invites_count_result = await client.table('user_invites')\
                .select('*')\
                .eq('inviter_id', user_id)\
                .gt('used_count', 0)\
                .execute()
                
            logger.info(f"Resultado da consulta de convites por used_count: {invites_count_result.data if hasattr(invites_count_result, 'data') else 'sem convites'}")
        except Exception as e:
            logger.error(f"Erro ao consultar convites por used_count: {str(e)}")
            invites_count_result = type('obj', (object,), {'data': []})
        
        # Combinar resultados únicos
        all_invites = []
        if invites_result.data:
            all_invites.extend(invites_result.data)
        
        if invites_count_result.data:
            # Adicionar apenas convites que não estão já na lista
            invite_ids = {invite['id'] for invite in all_invites}
            for invite in invites_count_result.data:
                if invite['id'] not in invite_ids:
                    all_invites.append(invite)
        
        # Calcular o número de prompts permitidos
        invites_count = len(all_invites)
        
        # Verificar se há um registro de uso com bonus_count
        bonus_count = 0
        if usage_result.data and 'bonus_count' in usage_result.data[0]:
            bonus_count = usage_result.data[0]['bonus_count'] or 0
            logger.info(f"Bônus de prompts encontrado no registro: {bonus_count}")
        
        # Usar o bonus_count do registro, ou o número de convites se for maior
        # Isso garante que o usuário receba o número correto de prompts extras
        effective_bonus = bonus_count
        logger.info(f"Número de convites encontrados na consulta: {invites_count}, bonus_count no registro: {bonus_count}")
        logger.info(f"Usando bônus efetivo de: {effective_bonus}")
        
        # Se o número de convites for diferente do bonus_count, isso pode indicar um problema
        if invites_count != bonus_count:
            logger.warning(f"Possível inconsistência: {invites_count} convites encontrados, mas bonus_count é {bonus_count}")
            
            # NÃO atualizar o bonus_count diretamente para evitar vulnerabilidades de segurança
            # Em vez disso, apenas registrar a inconsistência nos logs
            # A atualização do bonus_count deve ser feita APENAS pelos triggers SQL quando um convite é utilizado
            if invites_count > bonus_count:
                logger.warning(f"Possível perda de bônus: usuário {user_id} tem {invites_count} convites, mas bonus_count é {bonus_count}")
                # Para fins de log, registrar os IDs dos convites encontrados
                invite_ids = [invite.get('id', 'unknown') for invite in all_invites]
                logger.info(f"IDs dos convites encontrados: {invite_ids}")
        
        max_allowed = MAX_PROMPTS_PER_DAY + (effective_bonus * EXTRA_PROMPTS_PER_INVITE)
        logger.info(f"Limite calculado: {max_allowed} (base: {MAX_PROMPTS_PER_DAY} + bônus: {effective_bonus} convites)")
        
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
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"Erro ao verificar limite de prompts: {str(e)}")
        logger.error(f"Traceback completo: {error_trace}")
        
        # Em vez de bloquear completamente, vamos permitir o uso com o limite base
        # Isso evita que problemas temporários impeçam completamente o uso do sistema
        return True, f"Aviso: Erro ao verificar bônus de convites. Usando limite base.", 0, MAX_PROMPTS_PER_DAY
