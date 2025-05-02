"""
Utilitários para manipulação de IDs e UUIDs.
"""

import uuid
from utils.logger import logger

def normalize_uuid(id_str: str) -> str:
    """
    Normaliza um ID para garantir que esteja no formato UUID padrão.
    
    Args:
        id_str: O ID a ser normalizado
        
    Returns:
        str: O ID normalizado no formato UUID padrão
    """
    try:
        # Verificar se o ID é um UUID válido
        uuid_obj = uuid.UUID(id_str)
        normalized_id = str(uuid_obj)  # Converter para string no formato padrão UUID
        
        # Se o ID original e o normalizado forem diferentes, registrar um aviso
        if normalized_id != id_str:
            logger.debug(f"ID normalizado: {id_str} -> {normalized_id}")
            
        return normalized_id
    except ValueError:
        # Se não for um UUID válido, usar o ID original e registrar um aviso
        logger.warning(f"ID não está no formato UUID: {id_str}")
        return id_str
