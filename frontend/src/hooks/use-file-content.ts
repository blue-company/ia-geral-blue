'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';

export function useFileContent(
  filePath: string,
  shouldFetch: boolean = true,
  contentCache: Map<string, string> = new Map()
) {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const { session } = useAuth();
  
  useEffect(() => {
    // Reset state when path changes
    setContent('');
    setError(null);
    
    // Don't fetch if not needed
    if (!shouldFetch || !filePath) return;
    
    // Check cache first
    if (contentCache.has(filePath)) {
      setContent(contentCache.get(filePath) || '');
      return;
    }
    
    async function fetchContent() {
      setIsLoading(true);
      
      try {
        // Determine if this is a sandbox path or a URL
        if (filePath.startsWith('/workspace/') || filePath.startsWith('/sandbox/')) {
          // Fetch from sandbox API
          const response = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`, {
            headers: {
              'Authorization': `Bearer ${session?.access_token || ''}`
            }
          });
          
          if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.statusText}`);
          }
          
          const data = await response.text();
          setContent(data);
          contentCache.set(filePath, data);
        } else if (filePath.startsWith('http')) {
          // Fetch from URL directly
          const response = await fetch(filePath);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.statusText}`);
          }
          
          const data = await response.text();
          setContent(data);
          contentCache.set(filePath, data);
        } else {
          throw new Error('Unsupported file path format');
        }
      } catch (err) {
        console.error('Error fetching file content:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchContent();
  }, [filePath, shouldFetch, session?.access_token, contentCache]);
  
  return { content, isLoading, error };
}
