'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';

export function useImageContent(
  filePath: string,
  shouldFetch: boolean = true,
  imageCache: Map<string, string> = new Map(),
  localPreviewUrl?: string
) {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const { session } = useAuth();
  
  useEffect(() => {
    // Reset state when path changes
    setImageUrl('');
    setError(null);
    
    // If we have a local preview URL, use it directly
    if (localPreviewUrl) {
      setImageUrl(localPreviewUrl);
      return;
    }
    
    // Don't fetch if not needed
    if (!shouldFetch || !filePath) return;
    
    // Check cache first
    if (imageCache.has(filePath)) {
      setImageUrl(imageCache.get(filePath) || '');
      return;
    }
    
    async function fetchImageUrl() {
      setIsLoading(true);
      
      try {
        // Determine if this is a sandbox path or a URL
        if (filePath.startsWith('/workspace/') || filePath.startsWith('/sandbox/')) {
          // For sandbox files, we need to get a URL
          const response = await fetch(`/api/file/url?path=${encodeURIComponent(filePath)}`, {
            headers: {
              'Authorization': `Bearer ${session?.access_token || ''}`
            }
          });
          
          if (!response.ok) {
            throw new Error(`Failed to fetch image URL: ${response.statusText}`);
          }
          
          const data = await response.json();
          setImageUrl(data.url);
          imageCache.set(filePath, data.url);
        } else if (filePath.startsWith('http')) {
          // For direct URLs, use them as is
          setImageUrl(filePath);
          imageCache.set(filePath, filePath);
        } else {
          throw new Error('Unsupported file path format');
        }
      } catch (err) {
        console.error('Error fetching image URL:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchImageUrl();
  }, [filePath, shouldFetch, session?.access_token, imageCache, localPreviewUrl]);
  
  return { imageUrl, isLoading, error };
}
