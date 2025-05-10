import os
import random
import time
from typing import Optional, Dict, List, Callable, Any

from daytona_sdk import Daytona, DaytonaConfig, CreateSandboxParams, Sandbox, SessionExecuteRequest
from daytona_api_client.models.workspace_state import WorkspaceState
from dotenv import load_dotenv

from agentpress.tool import Tool
from utils.logger import logger
from utils.config import config
from utils.files_utils import clean_path
from agentpress.thread_manager import ThreadManager

load_dotenv()

logger.debug("Initializing Daytona sandbox configuration with API key pool")

# Pool de API keys do Daytona
API_KEY_POOL = []

# Adiciona a chave principal do DAYTONA_API_KEY
if config.DAYTONA_API_KEY:
    API_KEY_POOL.append(config.DAYTONA_API_KEY)

# Adiciona as chaves adicionais de DAYTONA_API_KEY_1 até DAYTONA_API_KEY_20
for i in range(1, 21):
    key_attr = f"DAYTONA_API_KEY_{i}"
    if hasattr(config, key_attr):
        key_value = getattr(config, key_attr)
        if key_value and key_value.strip():
            API_KEY_POOL.append(key_value)

if not API_KEY_POOL:
    logger.warning("No Daytona API keys found in the pool. Add keys to .env file.")
    # Adiciona uma entrada vazia para permitir o funcionamento local sem API key
    API_KEY_POOL.append("")

logger.info(f"Daytona API key pool initialized with {len(API_KEY_POOL)} keys")

# Dicionário para rastrear os clientes Daytona por API key
daytona_clients: Dict[str, Daytona] = {}

# Inicializa os clientes Daytona para cada API key
for api_key in API_KEY_POOL:
    key_id = api_key[-8:] if api_key and len(api_key) >= 8 else "empty"
    try:
        daytona_config = DaytonaConfig(
            api_key=api_key,
            server_url=config.DAYTONA_SERVER_URL,
            target=config.DAYTONA_TARGET
        )
        daytona_clients[api_key] = Daytona(daytona_config)
        logger.debug(f"Daytona client initialized for key ending in {key_id}")
    except Exception as e:
        logger.error(f"Failed to initialize Daytona client for key {key_id}: {str(e)}")

# Cliente Daytona padrão (usando a primeira chave da pool)
if API_KEY_POOL and API_KEY_POOL[0] in daytona_clients:
    daytona = daytona_clients[API_KEY_POOL[0]]
    logger.debug("Default Daytona client set to first key in pool")
else:
    # Fallback para configuração padrão se não houver chaves válidas
    daytona_config = DaytonaConfig(
        api_key="",
        server_url=config.DAYTONA_SERVER_URL,
        target=config.DAYTONA_TARGET
    )
    daytona = Daytona(daytona_config)
    logger.warning("Using default Daytona client with empty API key")

# Função para obter um cliente Daytona da pool
def get_daytona_client(api_key=None):
    """Obtém um cliente Daytona específico ou um aleatório da pool."""
    if api_key and api_key in daytona_clients:
        return daytona_clients[api_key]
    
    # Se não for especificada uma chave ou a chave não existir, retorna um cliente aleatório
    if daytona_clients:
        return daytona_clients[random.choice(list(daytona_clients.keys()))]
    else:
        return daytona

# Função para tentar uma operação com diferentes clientes Daytona
def try_with_multiple_clients(operation_func, *args, **kwargs):
    """Tenta executar uma operação usando diferentes clientes Daytona até ter sucesso."""
    errors = []
    
    # Embaralha as chaves para distribuir a carga
    client_keys = list(daytona_clients.keys())
    if not client_keys:
        # Se não houver clientes na pool, usa o cliente padrão
        try:
            return operation_func(daytona, *args, **kwargs)
        except Exception as e:
            logger.error(f"Operation failed with default client: {str(e)}")
            raise e
    
    # Tenta com cada cliente da pool
    shuffled_keys = random.sample(client_keys, len(client_keys))
    for api_key in shuffled_keys:
        client = daytona_clients[api_key]
        try:
            return operation_func(client, *args, **kwargs)
        except Exception as e:
            key_id = api_key[-8:] if api_key and len(api_key) >= 8 else "empty"
            logger.warning(f"Operation failed with API key {key_id}: {str(e)}")
            errors.append((api_key, str(e)))
    
    # Se chegou aqui, todas as tentativas falharam
    error_details = "\n".join([f"Key {k[-8:] if k and len(k) >= 8 else 'empty'}: {e}" for k, e in errors])
    raise Exception(f"Operation failed with all API keys in the pool. Errors:\n{error_details}")

logger.debug("Daytona client pool and utility functions initialized")

async def get_or_start_sandbox(sandbox_id: str):
    """Retrieve a sandbox by ID, check its state, and start it if needed."""
    
    logger.info(f"Getting or starting sandbox with ID: {sandbox_id}")
    
    try:
        # Função para obter o sandbox usando um cliente específico
        def get_sandbox(client, sandbox_id):
            return client.get_current_sandbox(sandbox_id)
        
        try:
            # Tenta obter o sandbox usando todas as API keys disponíveis
            # Isso é importante porque o sandbox pode ter sido criado com qualquer uma das chaves
            errors = []
            found_sandbox = None
            
            # Tenta com cada cliente da pool individualmente
            for api_key, client in daytona_clients.items():
                key_id = api_key[-8:] if api_key and len(api_key) >= 8 else "empty"
                try:
                    found_sandbox = client.get_current_sandbox(sandbox_id)
                    logger.debug(f"Found sandbox {sandbox_id} using API key ending in {key_id}")
                    break
                except Exception as e:
                    logger.debug(f"Could not find sandbox {sandbox_id} with API key {key_id}: {str(e)}")
                    errors.append((api_key, str(e)))
            
            # Se não encontrou com nenhuma chave, tenta com o cliente padrão
            if not found_sandbox and not daytona_clients:
                try:
                    found_sandbox = daytona.get_current_sandbox(sandbox_id)
                    logger.debug(f"Found sandbox {sandbox_id} using default API key")
                except Exception as e:
                    logger.debug(f"Could not find sandbox {sandbox_id} with default API key: {str(e)}")
                    errors.append(("default", str(e)))
            
            # Se não encontrou o sandbox em nenhuma chave, lança exceção
            if not found_sandbox:
                error_details = "\n".join([f"Key {k[-8:] if k != 'default' and k and len(k) >= 8 else k}: {e}" for k, e in errors])
                raise Exception(f"Sandbox {sandbox_id} not found with any API key. Errors:\n{error_details}")
            
            # Usa o sandbox encontrado
            sandbox = found_sandbox
            logger.debug(f"Found existing sandbox with ID: {sandbox_id}")
            
            # Verifica se o sandbox precisa ser iniciado
            if sandbox.instance.state == WorkspaceState.ARCHIVED or sandbox.instance.state == WorkspaceState.STOPPED:
                logger.info(f"Sandbox is in {sandbox.instance.state} state. Starting...")
                try:
                    # Função para iniciar o sandbox
                    def start_sandbox(client, sandbox):
                        client.start(sandbox)
                        return True
                    
                    # Tenta iniciar o sandbox usando a pool de API keys
                    try_with_multiple_clients(start_sandbox, sandbox)
                    
                    # Aguarda um momento para o sandbox inicializar
                    time.sleep(5)
                    
                    # Atualiza o estado do sandbox após iniciar
                    sandbox = try_with_multiple_clients(get_sandbox, sandbox_id)
                    
                    # Inicia o supervisord em uma sessão ao reiniciar
                    start_supervisord_session(sandbox)
                except Exception as e:
                    logger.error(f"Error starting sandbox: {e}")
                    raise e
        except Exception as e:
            # Se não encontrar o sandbox, tenta criar um novo
            logger.warning(f"Sandbox {sandbox_id} not found or error retrieving it: {str(e)}")
            logger.info(f"Attempting to create a new sandbox with ID: {sandbox_id}")
            
            # Cria um novo sandbox com o mesmo ID
            sandbox = create_sandbox("password", sandbox_id)
        
        logger.info(f"Sandbox {sandbox_id} is ready")
        return sandbox
        
    except Exception as e:
        logger.error(f"Error retrieving or starting sandbox: {str(e)}")
        raise e

def start_supervisord_session(sandbox: Sandbox):
    """Start supervisord in a session."""
    session_id = "supervisord-session"
    try:
        logger.info(f"Creating session {session_id} for supervisord")
        
        # Função para criar uma sessão no sandbox
        def create_session(client, sandbox, session_id):
            return sandbox.process.create_session(session_id)
        
        # Função para executar um comando na sessão
        def execute_session_command(client, sandbox, session_id, command_request):
            return sandbox.process.execute_session_command(session_id, command_request)
        
        # Tenta criar a sessão usando a pool de API keys
        try_with_multiple_clients(create_session, sandbox, session_id)
        
        # Execute supervisord command
        command_request = SessionExecuteRequest(
            command="exec /usr/bin/supervisord -n -c /etc/supervisor/conf.d/supervisord.conf",
            var_async=True
        )
        
        # Tenta executar o comando usando a pool de API keys
        try_with_multiple_clients(execute_session_command, sandbox, session_id, command_request)
        
        logger.info(f"Supervisord started in session {session_id}")
    except Exception as e:
        logger.error(f"Error starting supervisord session: {str(e)}")
        raise e

def create_sandbox(password: str, project_id: str = None):
    """Create a new sandbox with all required services configured and running."""
    
    logger.debug("Creating new Daytona sandbox environment")
    logger.debug("Configuring sandbox with browser-use image and environment variables")
    
    labels = None
    if project_id:
        logger.debug(f"Using sandbox_id as label: {project_id}")
        labels = {'id': project_id}
        
    params = CreateSandboxParams(
        image="kortix/suna:0.1.2",
        public=True,
        labels=labels,
        env_vars={
            "CHROME_PERSISTENT_SESSION": "true",
            "RESOLUTION": "1024x768x24",
            "RESOLUTION_WIDTH": "1024",
            "RESOLUTION_HEIGHT": "768",
            "VNC_PASSWORD": password,
            "ANONYMIZED_TELEMETRY": "false",
            "CHROME_PATH": "",
            "CHROME_USER_DATA": "",
            "CHROME_DEBUGGING_PORT": "9222",
            "CHROME_DEBUGGING_HOST": "localhost",
            "CHROME_CDP": ""
        },
        resources={
            "cpu": 2,
            "memory": 4,
            "disk": 5,
        }
    )
    
    # Função para criar um sandbox usando um cliente específico
    def create_sandbox_with_client(client, params):
        return client.create(params)
    
    # Tenta criar o sandbox usando a pool de API keys
    try:
        sandbox = try_with_multiple_clients(create_sandbox_with_client, params)
        logger.debug(f"Sandbox created with ID: {sandbox.id}")
        
        # Start supervisord in a session for new sandbox
        start_supervisord_session(sandbox)
        
        logger.debug(f"Sandbox environment successfully initialized")
        return sandbox
    except Exception as e:
        logger.error(f"Failed to create sandbox: {str(e)}")
        raise e


class SandboxToolsBase(Tool):
    """Base class for all sandbox tools that provides project-based sandbox access."""
    
    # Class variable to track if sandbox URLs have been printed
    _urls_printed = False
    
    def __init__(self, project_id: str, thread_manager: Optional[ThreadManager] = None):
        super().__init__()
        self.project_id = project_id
        self.thread_manager = thread_manager
        self.workspace_path = "/workspace"
        self._sandbox = None
        self._sandbox_id = None
        self._sandbox_pass = None

    async def _ensure_sandbox(self) -> Sandbox:
        """Ensure we have a valid sandbox instance, retrieving it from the project if needed."""
        if self._sandbox is None:
            try:
                # Get database client
                client = await self.thread_manager.db.client
                
                # Get project data
                project = await client.table('projects').select('*').eq('project_id', self.project_id).execute()
                if not project.data or len(project.data) == 0:
                    raise ValueError(f"Project {self.project_id} not found")
                
                project_data = project.data[0]
                sandbox_info = project_data.get('sandbox', {})
                
                if not sandbox_info.get('id'):
                    raise ValueError(f"No sandbox found for project {self.project_id}")
                
                # Store sandbox info
                self._sandbox_id = sandbox_info['id']
                self._sandbox_pass = sandbox_info.get('pass')
                
                # Get or start the sandbox
                self._sandbox = await get_or_start_sandbox(self._sandbox_id)
                
                # # Log URLs if not already printed
                # if not SandboxToolsBase._urls_printed:
                #     vnc_link = self._sandbox.get_preview_link(6080)
                #     website_link = self._sandbox.get_preview_link(8080)
                    
                #     vnc_url = vnc_link.url if hasattr(vnc_link, 'url') else str(vnc_link)
                #     website_url = website_link.url if hasattr(website_link, 'url') else str(website_link)
                    
                #     print("\033[95m***")
                #     print(f"VNC URL: {vnc_url}")
                #     print(f"Website URL: {website_url}")
                #     print("***\033[0m")
                #     SandboxToolsBase._urls_printed = True
                
            except Exception as e:
                logger.error(f"Error retrieving sandbox for project {self.project_id}: {str(e)}", exc_info=True)
                raise e
        
        return self._sandbox

    @property
    def sandbox(self) -> Sandbox:
        """Get the sandbox instance, ensuring it exists."""
        if self._sandbox is None:
            raise RuntimeError("Sandbox not initialized. Call _ensure_sandbox() first.")
        return self._sandbox

    @property
    def sandbox_id(self) -> str:
        """Get the sandbox ID, ensuring it exists."""
        if self._sandbox_id is None:
            raise RuntimeError("Sandbox ID not initialized. Call _ensure_sandbox() first.")
        return self._sandbox_id

    def clean_path(self, path: str) -> str:
        """Clean and normalize a path to be relative to /workspace."""
        cleaned_path = clean_path(path, self.workspace_path)
        logger.debug(f"Cleaned path: {path} -> {cleaned_path}")
        return cleaned_path