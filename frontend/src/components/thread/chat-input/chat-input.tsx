'use client';

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Square, Loader2, X, Paperclip, Settings, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { Project } from '@/lib/api';

// Importar o componente AttachmentGroup diretamente do caminho absoluto
import { AttachmentGroup } from '@/components/thread/attachment-group';

// Implementar as funções handleLocalFiles e uploadFiles diretamente neste arquivo
// em vez de importá-las, para evitar problemas de importação circular

// Define API_URL
const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

// Local storage keys
const STORAGE_KEY_MODEL = 'inventu-preferred-model';
const DEFAULT_MODEL_ID = "sonnet-3.7"; // Define default model ID

export interface ChatInputProps {
  onSubmit: (message: string, options?: { model_name?: string; enable_thinking?: boolean }) => void;
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  isAgentRunning?: boolean;
  onStopAgent?: () => void;
  autoFocus?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  onFileBrowse?: () => void;
  sandboxId?: string;
  hideAttachments?: boolean;
  project?: Project;
  className?: string; // Adicionar propriedade className para estilização personalizada
}

export interface UploadedFile {
  name: string;
  path: string;
  size: number;
  type: string;
  localUrl?: string;
}

// Define interface for the ref
export interface ChatInputHandles {
  getPendingFiles: () => File[];
  clearPendingFiles: () => void;
  // Não é necessário incluir as props aqui, pois elas são passadas separadamente
}

export const ChatInput = forwardRef<ChatInputHandles, ChatInputProps>(({
  onSubmit,
  placeholder = "Descreva com o que você precisa de ajuda...",
  loading = false,
  disabled = false,
  isAgentRunning = false,
  onStopAgent,
  autoFocus = true,
  value: controlledValue,
  onChange: controlledOnChange,
  onFileBrowse,
  sandboxId,
  hideAttachments = false,
  project,
  className = "" // Valor padrão para className
}, ref) => {
  const isControlled = controlledValue !== undefined && controlledOnChange !== undefined;
  
  const [uncontrolledValue, setUncontrolledValue] = useState('');
  const value = isControlled ? controlledValue : uncontrolledValue;

  // Define model options array earlier so it can be used in useEffect
  const modelOptions = [
    { id: "sonnet-3.7", label: "Sonnet 3.7" },
    { id: "sonnet-3.7-thinking", label: "Sonnet 3.7 (Thinking)" },
    { id: "gpt-4.1", label: "GPT-4.1" },
    { id: "gemini-flash-2.5", label: "Gemini Flash 2.5" }
  ];

  // Initialize state with the default model
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_ID);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
  // Expose methods through the ref
  useImperativeHandle(ref, () => ({
    getPendingFiles: () => pendingFiles,
    clearPendingFiles: () => setPendingFiles([])
  }));

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedModel = localStorage.getItem(STORAGE_KEY_MODEL);
        // Check if the saved model exists and is one of the valid options
        if (savedModel && modelOptions.some(option => option.id === savedModel)) {
          setSelectedModel(savedModel);
        } else if (savedModel) {
          // If invalid model found in storage, clear it
          localStorage.removeItem(STORAGE_KEY_MODEL);
          console.log(`Removed invalid model '${savedModel}' from localStorage. Using default: ${DEFAULT_MODEL_ID}`);
        }
      } catch (error) {
        console.error('Error accessing localStorage:', error);
      }
    }
  }, []);
  
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const adjustHeight = () => {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    };

    adjustHeight();
    
    adjustHeight();

    window.addEventListener('resize', adjustHeight);
    return () => window.removeEventListener('resize', adjustHeight);
  }, [value]);

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_MODEL, model);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isAgentRunning) {
      onStopAgent?.();
      return;
    }
    
    if (!value.trim() && uploadedFiles.length === 0) return;
    
    // Determine if we're using the "thinking" version of the model
    const enable_thinking = selectedModel.includes('-thinking');
    
    // Get the base model name without the -thinking suffix
    const model_name = selectedModel.replace('-thinking', '');
    
    // Call the onSubmit handler with the message and options
    onSubmit(value, { 
      model_name,
      enable_thinking
    });
    
    // Clear the input if it's not controlled
    if (!isControlled) {
      setUncontrolledValue('');
    }
    
    // Clear uploaded files after submission
    setUploadedFiles([]);
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (isControlled) {
      controlledOnChange(newValue);
    } else {
      setUncontrolledValue(newValue);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !loading && !disabled) {
      e.preventDefault();
      handleSubmit(e);
    }
  };
  
  const handleFileUpload = () => {
    if (onFileBrowse) {
      onFileBrowse();
    } else if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };
  
  // Implementação da função handleLocalFiles diretamente no componente
  const handleLocalFiles = (files: File[]) => {
    // Create URL objects for local preview
    const uploadedFiles = files.map(file => ({
      name: file.name,
      path: `/workspace/${file.name}`,
      size: file.size,
      type: file.type || 'application/octet-stream',
      localUrl: URL.createObjectURL(file)
    }));

    // Update state with the new files
    setUploadedFiles(prev => [...prev, ...uploadedFiles]);
    
    // Show success toast
    if (files.length === 1) {
      toast.success(`File added: ${files[0].name}`);
    } else {
      toast.success(`${files.length} files added`);
    }
  };

  // Implementação da função uploadFiles diretamente no componente
  const uploadFiles = async (files: File[], sandboxId: string) => {
    if (!sandboxId) {
      toast.error("No sandbox ID provided for file upload");
      return;
    }

    setIsUploading(true);

    try {
      // Process each file sequentially to avoid overwhelming the server
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('sandbox_id', sandboxId);
        
        // Upload the file
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.message || 'Failed to upload file');
        }
        
        const uploadResult = await uploadResponse.json();
        const uploadPath = uploadResult.path;
        
        // Add the uploaded file to the state
        setUploadedFiles(prev => [...prev, {
          name: file.name,
          path: uploadPath,
          size: file.size,
          type: file.type || 'application/octet-stream',
        }]);
        
        toast.success(`File uploaded: ${file.name}`);
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      
      if (sandboxId) {
        setPendingFiles(prev => [...prev, ...files]);
        uploadFiles(files, sandboxId);
      } else {
        // Handle files locally if no sandboxId
        handleLocalFiles(files);
      }
    }
  };
  
  const processFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const files = Array.from(event.target.files);
      
      if (sandboxId) {
        setPendingFiles(prev => [...prev, ...files]);
        uploadFiles(files, sandboxId);
      } else {
        // Handle files locally if no sandboxId
        handleLocalFiles(files);
      }
      
      // Reset the input value so the same file can be uploaded again if needed
      event.target.value = '';
    }
  };
  
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };
  
  const removeUploadedFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  return (
    <div className={cn(
      "flex flex-col w-full rounded-lg border bg-background shadow-sm",
      isDraggingOver ? "border-primary/50 bg-primary/5" : "border-input"
    )}>
      {uploadedFiles.length > 0 && (
        <div className="px-3 pt-3">
          <AttachmentGroup 
            files={uploadedFiles} 
            onRemove={removeUploadedFile} 
            layout="inline"
            project={project}
          />
        </div>
      )}
      
      <div 
        className="flex items-end w-full p-3 gap-2"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Textarea
          ref={textareaRef}
          placeholder={placeholder}
          className={`min-h-[40px] border-0 focus-visible:ring-0 resize-none p-2 shadow-none ${className}`}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={loading || (disabled && !isAgentRunning)}
          rows={1}
        />
        
        <div className="flex items-center gap-1.5">
          {/* Model selector - commented out for now
          {!isAgentRunning && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                        disabled={loading || disabled}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Settings</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <RadioGroup 
                          value={selectedModel} 
                          onValueChange={handleModelChange}
                          className="flex flex-col space-y-1"
                        >
                          {modelOptions.map((option) => (
                            <div key={option.id} className="flex items-center justify-between space-x-2 rounded-md p-2 hover:bg-accent">
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value={option.id} id={option.id} />
                                <Label htmlFor={option.id} className="cursor-pointer">
                                  {option.label}
                                </Label>
                              </div>
                              {selectedModel === option.id && (
                                <span className="text-xs text-muted-foreground">Active</span>
                              )}
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                    </DialogContent>
                  </Dialog>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Settings</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )} */}
          
          {!hideAttachments && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    type="button"
                    onClick={handleFileUpload}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                    disabled={loading || (disabled && !isAgentRunning) || isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Paperclip className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Attach files</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={processFileUpload}
            multiple
          />
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  type="submit"
                  onClick={isAgentRunning ? onStopAgent : handleSubmit}
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-8 w-8 rounded-md",
                    isAgentRunning 
                      ? "text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30" 
                      : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
                    ((!value.trim() && uploadedFiles.length === 0) && !isAgentRunning) || loading || (disabled && !isAgentRunning) 
                      ? "opacity-50" 
                      : ""
                  )}
                  disabled={((!value.trim() && uploadedFiles.length === 0) && !isAgentRunning) || loading || (disabled && !isAgentRunning)}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isAgentRunning ? (
                    <Square className="h-4 w-4" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{isAgentRunning ? 'Stop agent' : 'Send message'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {isAgentRunning && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 w-full flex items-center justify-center"
        >
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Thanus está trabalhando...</span>
          </div>
        </motion.div>
      )}
    </div>
  );
});

// Set display name for the component
ChatInput.displayName = 'ChatInput';
