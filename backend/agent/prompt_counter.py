"""
Utilitário para gerenciar a contagem de prompts.
"""

import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

async def increment_prompt_count(client, user_id: str, increment: bool = True) -> bool:
    """
    Incrementa (ou não) a contagem de prompts para um usuário.
    
    Args:
        client: Cliente Supabase
        user_id: ID do usuário
        increment: Se True, incrementa a contagem. Se False, apenas verifica.
    
    Returns:
        bool: True se o prompt foi contado, False caso contrário
    """
    # Formatar o ID do usuário (remover hífens)
    formatted_user_id = user_id.replace('-', '')
    
    # Obter a data atual
    current_date = datetime.now(timezone.utc).date().isoformat()
    
    if increment:
        try:
            # Verificar se já existe um registro para hoje
            usage_result = await client.table('prompt_usage')\
                .select('*')\
                .eq('user_id', formatted_user_id)\
                .eq('date', current_date)\
                .execute()
                
            if not usage_result.data:
                # Criar novo registro se não existir
                logger.info(f"Criando novo registro de uso de prompts para o usuário {formatted_user_id}")
                insert_result = await client.table('prompt_usage')\
                    .insert({
                        "user_id": formatted_user_id,
                        "date": current_date,
                        "count": 1
                    })\
                    .execute()
                logger.info(f"Novo registro criado: {insert_result.data if hasattr(insert_result, 'data') else 'sem dados'}")
            else:
                # Atualizar registro existente
                logger.info(f"Atualizando registro existente de uso de prompts para o usuário {formatted_user_id}")
                update_result = await client.table('prompt_usage')\
                    .update({"count": usage_result.data[0]['count'] + 1})\
                    .eq('id', usage_result.data[0]['id'])\
                    .execute()
                logger.info(f"Registro atualizado: {update_result.data if hasattr(update_result, 'data') else 'sem dados'}")
            
            return True
        except Exception as e:
            logger.error(f"Erro ao processar uso de prompts: {str(e)}")
            return False
    else:
        logger.info(f"Pulando contagem de prompts para o usuário {formatted_user_id}")
        return False

async def decrement_prompt_count(client, user_id: str) -> bool:
    """
    Decrementa a contagem de prompts para um usuário (usado em caso de erro).
    
    Args:
        client: Cliente Supabase
        user_id: ID do usuário
    
    Returns:
        bool: True se o prompt foi decrementado, False caso contrário
    """
    # Formatar o ID do usuário (remover hífens)
    formatted_user_id = user_id.replace('-', '')
    
    # Obter a data atual
    current_date = datetime.now(timezone.utc).date().isoformat()
    
    try:
        # Verificar se já existe um registro para hoje
        usage_result = await client.table('prompt_usage')\
            .select('*')\
            .eq('user_id', formatted_user_id)\
            .eq('date', current_date)\
            .execute()
            
        if usage_result.data and usage_result.data[0]['count'] > 0:
            # Atualizar registro existente
            logger.info(f"Decrementando registro de uso de prompts para o usuário {formatted_user_id}")
            update_result = await client.table('prompt_usage')\
                .update({"count": usage_result.data[0]['count'] - 1})\
                .eq('id', usage_result.data[0]['id'])\
                .execute()
            logger.info(f"Registro decrementado: {update_result.data if hasattr(update_result, 'data') else 'sem dados'}")
            return True
        
        return False
    except Exception as e:
        logger.error(f"Erro ao decrementar uso de prompts: {str(e)}")
        return False
