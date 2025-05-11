'use client';

import { toast } from "sonner";
import { UploadedFile } from "./chat-input";

/**
 * Handles files locally when there's no sandboxId
 */
export const handleLocalFiles = (
  files: File[],
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>
) => {
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

/**
 * Uploads files to the sandbox
 */
export const uploadFiles = async (
  files: File[],
  sandboxId: string,
  setIsUploading: React.Dispatch<React.SetStateAction<boolean>>,
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>
) => {
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
