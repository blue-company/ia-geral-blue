"""
Script para verificar o uso de prompts de um usuário específico no Supabase.
"""

import os
import sys
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client, Client

# Carregar variáveis de ambiente
load_dotenv()

# Configuração do Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")  # Usando service_role para acessar diretamente

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Erro: Variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são necessárias.")
    sys.exit(1)

# Criar cliente Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def check_prompt_usage(user_id: str):
    """Verifica o uso de prompts de um usuário específico."""
    try:
        # Normalizar o UUID para garantir formato consistente
        try:
            import uuid
            uuid_obj = uuid.UUID(user_id)
            normalized_user_id = str(uuid_obj)
            print(f"UUID normalizado: {normalized_user_id}")
        except ValueError:
            normalized_user_id = user_id
            print(f"Aviso: ID de usuário não está no formato UUID: {user_id}")
        
        # Consultar uso atual
        current_date = datetime.now(timezone.utc).date().isoformat()
        print(f"Consultando uso de prompts para o usuário {normalized_user_id} na data {current_date}")
        
        # Consultar todos os registros de uso para o usuário
        all_usage = supabase.table('prompt_usage')\
            .select('*')\
            .eq('user_id', normalized_user_id)\
            .order('date', desc=True)\
            .execute()
        
        if not all_usage.data:
            print(f"Nenhum registro de uso de prompts encontrado para o usuário {normalized_user_id}")
            return
        
        print("\n=== Histórico de Uso de Prompts ===")
        print("Data\t\tContagem")
        print("-" * 30)
        for usage in all_usage.data:
            print(f"{usage['date']}\t{usage['count']}")
        
        # Verificar uso hoje
        today_usage = next((u for u in all_usage.data if u['date'] == current_date), None)
        if today_usage:
            print(f"\nHoje ({current_date}): {today_usage['count']} prompts utilizados")
        else:
            print(f"\nHoje ({current_date}): 0 prompts utilizados")
        
        # Verificar convites
        invites = supabase.table('user_invites')\
            .select('*')\
            .eq('inviter_id', normalized_user_id)\
            .execute()
        
        print("\n=== Convites ===")
        if not invites.data:
            print("Nenhum convite registrado")
        else:
            print("Email\t\tCódigo\t\tUtilizado")
            print("-" * 60)
            for invite in invites.data:
                print(f"{invite['email']}\t{invite['invite_code']}\t{'Sim' if invite['used'] else 'Não'}")
        
    except Exception as e:
        print(f"Erro ao verificar uso de prompts: {str(e)}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Uso: python check_prompt_usage.py <user_id>")
        sys.exit(1)
    
    user_id = sys.argv[1]
    check_prompt_usage(user_id)