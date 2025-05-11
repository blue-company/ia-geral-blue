'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Project } from '@/lib/api';
import { Maximize2, X, ExternalLink, Code, Loader2 } from 'lucide-react';
import DOMPurify from 'isomorphic-dompurify';

interface HtmlRendererProps {
  content: string;
  previewUrl?: string;
  className?: string;
  project?: Project;
  maxHeight?: string | number;
  filename?: string;
}

export function HtmlRenderer({ 
  content, 
  previewUrl, 
  className, 
  project, 
  maxHeight = 500,
  filename
}: HtmlRendererProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Create a sanitized version of the HTML content
  const sanitizedContent = React.useMemo(() => {
    // Use DOMPurify for better sanitization
    try {
      return DOMPurify.sanitize(content, {
        ADD_TAGS: ['iframe'],
        ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling'],
      });
    } catch (error) {
      console.error('Error sanitizing HTML:', error);
      // Fallback to basic sanitization
      return content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '<!-- Scripts removed for security -->')
        .replace(/on\w+="[^"]*"/g, '') // Remove inline event handlers
        .replace(/javascript:/gi, 'removed:'); // Remove javascript: URLs
    }
  }, [content]);
  
  // Toggle fullscreen mode
  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setShowSource(false); // Reset source view when toggling fullscreen
  };
  
  // Toggle source code view
  const handleToggleSource = () => {
    setShowSource(!showSource);
  };
  
  // Handle iframe load events
  useEffect(() => {
    const handleIframeLoad = () => {
      setIsLoading(false);
    };
    
    // Find all iframes in the HTML preview
    const observer = new MutationObserver((mutations) => {
      const container = document.querySelector('.html-preview');
      if (container) {
        const iframes = container.querySelectorAll('iframe');
        if (iframes.length > 0) {
          setIsLoading(true);
          iframes.forEach(iframe => {
            iframe.addEventListener('load', handleIframeLoad);
          });
        }
      }
    });
    
    const container = document.querySelector('.html-preview');
    if (container) {
      observer.observe(container, { childList: true, subtree: true });
    }
    
    return () => {
      observer.disconnect();
      const container = document.querySelector('.html-preview');
      if (container) {
        const iframes = container.querySelectorAll('iframe');
        iframes.forEach(iframe => {
          iframe.removeEventListener('load', handleIframeLoad);
        });
      }
    };
  }, [sanitizedContent]);
  
  // Render the fullscreen view
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-background/90">
          <span className="font-medium">{filename ? filename : 'HTML Preview'}</span>
          <div className="flex gap-2">
            <button
              onClick={handleToggleSource}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              aria-label={showSource ? "Show rendered HTML" : "Show HTML source"}
            >
              <Code className="h-5 w-5" />
            </button>
            {previewUrl && (
              <a 
                href={previewUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 rounded-md hover:bg-muted transition-colors"
                aria-label="Open in new tab"
              >
                <ExternalLink className="h-5 w-5" />
              </a>
            )}
            <button
              onClick={handleToggleFullscreen}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              aria-label="Exit fullscreen"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-auto p-4 bg-white dark:bg-black relative">
          {isLoading && (
            <div className="absolute top-4 right-4 bg-background/80 p-2 rounded-full z-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
          {showSource ? (
            <pre className="p-4 bg-muted/20 rounded-md overflow-auto text-sm font-mono">
              {content}
            </pre>
          ) : (
            <div 
              dangerouslySetInnerHTML={{ __html: sanitizedContent }} 
              className="html-preview"
            />
          )}
        </div>
      </div>
    );
  }
  
  // Render the inline view
  return (
    <div className={cn("border rounded-md overflow-hidden", className)}>
      <div className="p-2 border-b bg-muted/40 flex justify-between items-center">
        <span className="text-xs text-muted-foreground">{filename ? filename : 'HTML Preview'}</span>
        <div className="flex gap-1">
          <button
            onClick={handleToggleSource}
            className="p-1 rounded-md hover:bg-muted transition-colors"
            aria-label={showSource ? "Show rendered HTML" : "Show HTML source"}
          >
            <Code className="h-4 w-4" />
          </button>
          {previewUrl && (
            <a 
              href={previewUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-1 rounded-md hover:bg-muted transition-colors"
              aria-label="Open in new tab"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <button
            onClick={handleToggleFullscreen}
            className="p-1 rounded-md hover:bg-muted transition-colors"
            aria-label="View fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div 
        className="bg-white dark:bg-black p-4 overflow-auto relative"
        style={{ maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight }}
      >
        {isLoading && (
          <div className="absolute top-4 right-4 bg-background/80 p-1.5 rounded-full z-10">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        )}
        {showSource ? (
          <pre className="p-2 bg-muted/20 rounded-md overflow-auto text-xs font-mono">
            {content}
          </pre>
        ) : (
          <div 
            dangerouslySetInnerHTML={{ __html: sanitizedContent }} 
            className="html-preview"
          />
        )}
      </div>
    </div>
  );
}
