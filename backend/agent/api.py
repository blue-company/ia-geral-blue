"""
API endpoints for the agent.
"""

import os
import json
import uuid
import asyncio
import tempfile
import shutil
import time
import traceback
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Union, Tuple
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, File, Form, UploadFile, Body, Query, Request
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
from agentpress.agent_manager import AgentManager
from agentpress.thread_manager import ThreadManager
from agentpress.models import AgentRunStatus, AgentMessage
from services.supabase import DBConnection
from services.llm import make_llm_api_call
from utils.id_utils import normalize_uuid
from utils.prompt_utils import check_prompt_limit
from agent.prompt_counter import increment_prompt_count, decrement_prompt_count

# Initialize shared resources
router = APIRouter()
thread_manager = None
db = None
instance_id = None

# Mapping for model name aliases
MODEL_NAME_ALIASES = {
    "anthropic/claude-3-opus": "anthropic/claude-3-opus-20240229",
    "anthropic/claude-3-sonnet": "anthropic/claude-3-sonnet-20240229",
    "anthropic/claude-3-haiku": "anthropic/claude-3-haiku-20240307",
    "anthropic/claude-3-5-sonnet": "anthropic/claude-3-5-sonnet-20240620",
    "anthropic/claude-3-7-sonnet": "anthropic/claude-3-7-sonnet-latest",
    "openai/gpt-4": "openai/gpt-4-turbo",
    "openai/gpt-4-turbo": "openai/gpt-4-turbo",
    "openai/gpt-4o": "openai/gpt-4o",
}

# Global map to track running agent runs
running_agent_runs = {}

# Pydantic models for request/response
class AgentStartRequest(BaseModel):
    prompt: str
    model_name: str = "anthropic/claude-3-7-sonnet-latest"
    enable_thinking: bool = False
    reasoning_effort: str = "low"
    stream: bool = True
    enable_context_manager: bool = False

class AgentStopRequest(BaseModel):
    agent_run_id: str

class InitiateAgentResponse(BaseModel):
    thread_id: str
    agent_run_id: str
    project_id: str
    sandbox: bool

class ProjectCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    repository_url: Optional[str] = None

class FileUploadRequest(BaseModel):
    thread_id: str
    file_path: str
    file_content: str

class FileGetRequest(BaseModel):
    thread_id: str
    file_path: str

class FileListRequest(BaseModel):
    thread_id: str
    directory_path: Optional[str] = None

class SandboxCommandRequest(BaseModel):
    thread_id: str
    command: str
    working_directory: Optional[str] = None
    environment_variables: Optional[Dict[str, str]] = None

# Dependency to get the current user ID from the JWT token
async def get_current_user_id_from_jwt(request: Request) -> str:
    """Get the current user ID from the JWT token."""
    # Get the Authorization header
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    # Extract the token
    token = auth_header.replace("Bearer ", "")
    
    # Decode the token
    try:
        # Use the supabase client to decode the token
        client = await db.client
        user = await client.auth.get_user(token)
        return user.user.id
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

def initialize(thread_mgr: ThreadManager, db_connection: DBConnection, instance_identifier: str):
    """Initialize the agent API with shared resources."""
    global thread_manager, db, instance_id
    thread_manager = thread_mgr
    db = db_connection
    instance_id = instance_identifier

async def cleanup():
    """Clean up resources when the application is shutting down."""
    global running_agent_runs
    
    # Stop all running agent runs
    for agent_run_id, agent_run in running_agent_runs.items():
        try:
            await agent_run["agent_manager"].stop()
        except Exception as e:
            print(f"Error stopping agent run {agent_run_id}: {e}")
    
    # Clear the running agent runs map
    running_agent_runs = {}

async def update_agent_run_status(client, agent_run_id: str, status: str, error: Optional[str] = None):
    """Update the status of an agent run in the database."""
    try:
        update_data = {
            "status": status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if status == "completed":
            update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
        
        if error:
            update_data["error"] = error
        
        await client.table("agent_runs").update(update_data).eq("id", agent_run_id).execute()
    except Exception as e:
        print(f"Error updating agent run status: {e}")

async def restore_running_agent_runs():
    """Restore running agent runs from the database."""
    try:
        client = await db.client
        
        # Get all agent runs with status "running"
        result = await client.table("agent_runs").select("*").eq("status", "running").execute()
        
        if not result.data:
            return
        
        # Update the status of all running agent runs to "failed"
        for agent_run in result.data:
            await update_agent_run_status(
                client, 
                agent_run["id"], 
                "failed", 
                "Agent run was interrupted by server restart"
            )
    except Exception as e:
        print(f"Error restoring running agent runs: {e}")

async def run_agent_in_background(
    agent_run_id: str, thread_id: str, instance_id: str,
    project_id: str, sandbox: bool,
    model_name: str, enable_thinking: bool, reasoning_effort: str,
    stream: bool, enable_context_manager: bool
):
    """Run an agent in the background."""
    global running_agent_runs
    
    try:
        client = await db.client
        
        # Create a new agent manager
        agent_manager = AgentManager(
            thread_manager=thread_manager,
            thread_id=thread_id,
            model_name=model_name,
            enable_thinking=enable_thinking,
            reasoning_effort=reasoning_effort,
            enable_context_manager=enable_context_manager
        )
        
        # Store the agent run in the running agent runs map
        running_agent_runs[agent_run_id] = {
            "agent_manager": agent_manager,
            "thread_id": thread_id,
            "project_id": project_id,
            "sandbox": sandbox,
            "instance_id": instance_id
        }
        
        # Run the agent
        await agent_manager.run()
        
        # Update the agent run status to completed
        await update_agent_run_status(client, agent_run_id, "completed")
        
        # Remove the agent run from the running agent runs map
        if agent_run_id in running_agent_runs:
            del running_agent_runs[agent_run_id]
    except Exception as e:
        # Update the agent run status to failed
        await update_agent_run_status(client, agent_run_id, "failed", str(e))
        
        # Remove the agent run from the running agent runs map
        if agent_run_id in running_agent_runs:
            del running_agent_runs[agent_run_id]
        
        # Re-raise the exception
        raise e

@router.post("/thread/{thread_id}/agent/start")
async def start_agent(
    thread_id: str,
    body: AgentStartRequest = Body(...),
    user_id: str = Depends(get_current_user_id_from_jwt),
    skip_prompt_count: bool = False
):
    """Start an agent for a specific thread in the background."""
    global instance_id # Ensure instance_id is accessible
    if not instance_id:
        raise HTTPException(status_code=500, detail="Agent API not initialized with instance ID")
    
    client = await db.client
    prompt_consumed = False
    agent_run_id = None
    
    try:
        # Verificar se o thread existe
        thread = await client.table("threads").select("*").eq("id", thread_id).execute()
        if not thread.data:
            raise HTTPException(status_code=404, detail="Thread not found")
        
        # Obter o project_id e sandbox do thread
        project_id = thread.data[0]["project_id"]
        sandbox = thread.data[0]["sandbox"]
        
        # Formatar o ID do usuário (remover hífens)
        formatted_user_id = user_id.replace('-', '')
        
        # Criar um novo agent_run
        agent_run = await client.table("agent_runs").insert({
            "thread_id": thread_id,
            "project_id": project_id,
            "status": "running",
            "prompt": body.prompt,
            "model_name": body.model_name,
            "instance_id": instance_id,
            "user_id": formatted_user_id,
            "started_at": datetime.now(timezone.utc).isoformat()
        }).execute()
        agent_run_id = agent_run.data[0]['id']
        
        # Incrementar o contador de prompts do usuário no Supabase usando o utilitário
        # Apenas incrementa se skip_prompt_count for False
        prompt_consumed = await increment_prompt_count(client, formatted_user_id, increment=not skip_prompt_count)
        
        # Iniciar o agente em background
        asyncio.create_task(
            run_agent_in_background(
                agent_run_id=agent_run_id, thread_id=thread_id, instance_id=instance_id,
                project_id=project_id, sandbox=sandbox,
                model_name=MODEL_NAME_ALIASES.get(body.model_name, body.model_name),
                enable_thinking=body.enable_thinking, reasoning_effort=body.reasoning_effort,
                stream=body.stream, enable_context_manager=body.enable_context_manager
            )
        )
        
        # Return the agent run ID
        return {"agent_run_id": agent_run_id}
    except Exception as e:
        error_message = f"Failed to start agent: {str(e)}"
        
        # Se o agent_run_id foi criado, atualizar o status para falha
        if agent_run_id:
            await update_agent_run_status(client, agent_run_id, "failed", error=error_message)
        
        # Se o prompt foi consumido, reverter a contagem
        if prompt_consumed:
            try:
                await decrement_prompt_count(client, user_id)
            except Exception as decrement_error:
                # Log the error but continue
                print(f"Error decrementing prompt count: {decrement_error}")
        
        # Re-raise the exception
        raise HTTPException(status_code=500, detail=error_message)

@router.post("/agent/stop")
async def stop_agent(
    body: AgentStopRequest,
    user_id: str = Depends(get_current_user_id_from_jwt)
):
    """Stop a running agent."""
    global running_agent_runs
    
    # Check if the agent run exists
    if body.agent_run_id not in running_agent_runs:
        raise HTTPException(status_code=404, detail="Agent run not found")
    
    try:
        # Stop the agent
        await running_agent_runs[body.agent_run_id]["agent_manager"].stop()
        
        # Update the agent run status
        client = await db.client
        await update_agent_run_status(client, body.agent_run_id, "stopped")
        
        # Remove the agent run from the running agent runs map
        del running_agent_runs[body.agent_run_id]
        
        return {"status": "stopped"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop agent: {str(e)}")

@router.get("/thread/{thread_id}/agent/messages")
async def get_agent_messages(
    thread_id: str,
    user_id: str = Depends(get_current_user_id_from_jwt)
):
    """Get all messages for a thread."""
    try:
        # Get the messages from the thread manager
        messages = await thread_manager.get_messages(thread_id)
        
        return {"messages": messages}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get messages: {str(e)}")

@router.get("/thread/{thread_id}/agent/messages/stream")
async def stream_agent_messages(
    thread_id: str,
    user_id: str = Depends(get_current_user_id_from_jwt)
):
    """Stream messages for a thread."""
    async def message_generator():
        try:
            # Get the message queue for the thread
            message_queue = await thread_manager.get_message_queue(thread_id)
            
            # Stream messages from the queue
            while True:
                message = await message_queue.get()
                
                # If the message is None, the stream is complete
                if message is None:
                    break
                
                # Yield the message
                yield json.dumps(message.dict()) + "\n"
        except Exception as e:
            # Yield an error message
            yield json.dumps({"error": str(e)}) + "\n"
    
    return StreamingResponse(message_generator(), media_type="application/json")

@router.post("/project/create")
async def create_project(
    body: ProjectCreateRequest,
    user_id: str = Depends(get_current_user_id_from_jwt)
):
    """Create a new project."""
    client = await db.client
    
    try:
        # Create a new project
        project = await client.table("projects").insert({
            "name": body.name,
            "description": body.description,
            "repository_url": body.repository_url,
            "user_id": user_id
        }).execute()
        
        return {"project_id": project.data[0]["id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create project: {str(e)}")

@router.post("/thread/create")
async def create_thread(
    project_id: str = Form(...),
    name: str = Form(...),
    user_id: str = Depends(get_current_user_id_from_jwt)
):
    """Create a new thread."""
    client = await db.client
    
    try:
        # Check if the project exists
        project = await client.table("projects").select("*").eq("id", project_id).execute()
        if not project.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Create a new thread
        thread = await client.table("threads").insert({
            "project_id": project_id,
            "name": name,
            "user_id": user_id
        }).execute()
        
        return {"thread_id": thread.data[0]["id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create thread: {str(e)}")

async def get_or_create_project_sandbox(client, project_id: str) -> Tuple[bool, str, str]:
    """Get or create a sandbox for a project."""
    # Check if the project has a sandbox
    sandbox_result = await client.table("project_sandboxes").select("*").eq("project_id", project_id).execute()
    
    if sandbox_result.data:
        # Return the existing sandbox
        return True, sandbox_result.data[0]["sandbox_id"], sandbox_result.data[0]["sandbox_password"]
    
    # Create a new sandbox
    sandbox_id = str(uuid.uuid4())
    sandbox_password = str(uuid.uuid4())
    
    # Insert the sandbox
    await client.table("project_sandboxes").insert({
        "project_id": project_id,
        "sandbox_id": sandbox_id,
        "sandbox_password": sandbox_password
    }).execute()
    
    return True, sandbox_id, sandbox_password

@router.post("/agent/initiate", response_model=InitiateAgentResponse)
async def initiate_agent_with_files(
    prompt: str = Form(...),
    model_name: Optional[str] = Form("anthropic/claude-3-7-sonnet-latest"),
    enable_thinking: Optional[bool] = Form(False),
    reasoning_effort: Optional[str] = Form("low"),
    stream: Optional[bool] = Form(True),
    enable_context_manager: Optional[bool] = Form(False),
    files: List[UploadFile] = File(default=[]),
    user_id: str = Depends(get_current_user_id_from_jwt)
):
    """Initiate a new agent session with optional file attachments."""
    global instance_id # Ensure instance_id is accessible
    if not instance_id:
        raise HTTPException(status_code=500, detail="Agent API not initialized with instance ID")
    
    client = await db.client
    # Garantir que o user_id está no formato UUID esperado pelo Supabase
    try:
        # Formatar o ID do usuário (remover hífens)
        formatted_user_id = user_id.replace('-', '')
        
        # 1. Create Project
        project_name = f"New Project {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        project = await client.table("projects").insert({
            "name": project_name,
            "user_id": formatted_user_id
        }).execute()
        project_id = project.data[0]["id"]
        
        # 2. Create Thread
        thread_name = f"New Thread {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        
        # Verificar se o usuário tem uma conta em public.accounts
        account_result = await client.table("accounts").select("*").eq("primary_owner_user_id", formatted_user_id).execute()
        
        # Se não tiver, criar uma
        if not account_result.data:
            logger.info(f"User {formatted_user_id} does not have an account in public.accounts, creating one")
            
            # Tentar criar uma conta em public.accounts
            try:
                # Tentar usando o client.from_()
                insert_result = await client.table("accounts").insert({
                    "id": str(uuid.uuid4()),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "primary_owner_user_id": formatted_user_id
                }).execute()
                
                if not insert_result.data:
                    logger.error(f"Failed to create account in public.accounts for user {formatted_user_id} using client.table()")
                    
                    # Tentar usando o admin_client
                    admin_client = await db.admin_client
                    admin_insert_result = await admin_client.table("accounts").insert({
                        "id": str(uuid.uuid4()),
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "primary_owner_user_id": formatted_user_id
                    }).execute()
                    
                    if not admin_insert_result.data:
                        logger.error(f"Failed to create account in public.accounts for user {formatted_user_id} using admin_client")
                    else:
                        logger.info(f"Successfully created account in public.accounts for user {formatted_user_id} using admin_client")
            except Exception as e:
                logger.error(f"Error creating account in public.accounts for user {formatted_user_id}: {str(e)}")
            
            # Verificar se a conta foi criada
            final_verify = await client.table("accounts").select("*").eq("primary_owner_user_id", formatted_user_id).execute()
            
            if final_verify.data and len(final_verify.data) > 0:
                logger.info(f"Successfully created account in public.accounts for user {formatted_user_id}")
            else:
                logger.error(f"Failed to create account in public.accounts for user {formatted_user_id}")
            
            # Também criar conta em basejump.accounts para o usuário
            try:
                # Tentar usando RPC
                rpc_result = await client.rpc("create_account_for_user", {
                    "user_id_param": formatted_user_id
                }).execute()
                
                if rpc_result.data:
                    logger.info(f"Successfully created account in basejump.accounts for user {formatted_user_id} using RPC")
                else:
                    logger.error(f"Failed to create account in basejump.accounts for user {formatted_user_id} using RPC")
                    
                    # Tentar inserção direta
                    basejump_insert_result = await client.table("basejump.accounts").insert({
                        "id": str(uuid.uuid4()),
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "personal_account": True,
                        "name": f"Personal Account for {formatted_user_id}",
                        "private_metadata": {},
                        "public_metadata": {}
                    }).execute()
                    
                    if basejump_insert_result.data:
                        logger.info(f"Successfully created account in basejump.accounts for user {formatted_user_id} using direct insert")
                    else:
                        logger.error(f"Failed to create account in basejump.accounts for user {formatted_user_id} using direct insert")
            except Exception as e:
                logger.error(f"Error creating account in basejump.accounts for user {formatted_user_id}: {str(e)}")
        
        # Agora criar o thread
        thread = await client.table("threads").insert({
            "project_id": project_id,
            "name": thread_name,
            "user_id": formatted_user_id
        }).execute()
        thread_id = thread.data[0]["id"]
        
        # 3. Get or Create Sandbox
        sandbox, sandbox_id, sandbox_pass = await get_or_create_project_sandbox(client, project_id)
        
        # Usar o utilitário de contagem de prompts
        # Aqui não incrementamos a contagem, pois isso será feito na função start_agent
        # que será chamada mais tarde no fluxo
        logger.info(f"Pulando contagem de prompts para o usuário {formatted_user_id} na função initiate_agent_with_files")
        prompt_consumed = False
        
        # 4. Upload Files to Sandbox (if any)
        file_paths = []
        for file in files:
            try:
                # Create a temporary file
                with tempfile.NamedTemporaryFile(delete=False) as temp_file:
                    # Write the file content to the temporary file
                    temp_file.write(await file.read())
                    temp_file_path = temp_file.name
                
                # Upload the file to the sandbox
                sandbox_path = f"/tmp/sandboxes/{sandbox_id}/{file.filename}"
                
                # Create the directory if it doesn't exist
                os.makedirs(os.path.dirname(sandbox_path), exist_ok=True)
                
                # Copy the temporary file to the sandbox
                shutil.copy(temp_file_path, sandbox_path)
                
                # Add the file path to the list
                file_paths.append(file.filename)
                
                # Remove the temporary file
                os.unlink(temp_file_path)
            except Exception as e:
                # Log the error but continue
                print(f"Error uploading file {file.filename}: {e}")
        
        # 5. Start Agent (this will create a new agent run)
        agent_start_request = AgentStartRequest(
            prompt=prompt,
            model_name=model_name,
            enable_thinking=enable_thinking,
            reasoning_effort=reasoning_effort,
            stream=stream,
            enable_context_manager=enable_context_manager
        )
        
        # Chamar a função start_agent com skip_prompt_count=True para evitar a contagem dupla
        await start_agent(thread_id, agent_start_request, user_id, skip_prompt_count=True)
        
        # 6. Return the thread ID and other information
        return {
            "thread_id": thread_id,
            "agent_run_id": "", # We don't have the agent run ID yet
            "project_id": project_id,
            "sandbox": sandbox
        }
    except Exception as e:
        # Se o prompt foi consumido, reverter a contagem
        if 'prompt_consumed' in locals() and prompt_consumed:
            try:
                await decrement_prompt_count(client, user_id)
            except Exception as decrement_error:
                # Log the error but continue
                print(f"Error decrementing prompt count: {decrement_error}")
        
        # Re-raise the exception with a more descriptive message
        error_message = f"Failed to initiate agent: {str(e)}\n{traceback.format_exc()}"
        raise HTTPException(status_code=500, detail=error_message)
