'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { Copy, Check, Download, Maximize2, X, FileText, Code } from 'lucide-react';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  maxHeight?: string | number;
  filename?: string;
}

export function MarkdownRenderer({ content, className, maxHeight = 400, filename }: MarkdownRendererProps) {
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSource, setShowSource] = useState(false);
  
  // Copy markdown to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  // Download markdown as file
  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'document.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  // Toggle fullscreen
  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };
  
  // Toggle source view
  const handleToggleSource = () => {
    setShowSource(!showSource);
  };
  
  // Render the fullscreen view
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-background/90">
          <span className="font-medium">
            {filename ? filename : 'Markdown Preview'}
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleToggleSource}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              aria-label={showSource ? "Show rendered markdown" : "Show markdown source"}
            >
              {showSource ? <FileText className="h-5 w-5" /> : <Code className="h-5 w-5" />}
            </button>
            <button
              onClick={handleCopy}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              aria-label="Copy markdown"
            >
              {copied ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
            </button>
            <button
              onClick={handleDownload}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              aria-label="Download markdown"
            >
              <Download className="h-5 w-5" />
            </button>
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
        <div className="flex-1 overflow-auto p-4 bg-background">
          {showSource ? (
            <pre className="p-4 bg-muted/20 rounded-md overflow-auto text-sm font-mono h-full">
              {content}
            </pre>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none mx-auto p-4">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]} 
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // Render the compact view
  return (
    <div className={cn("border rounded-md overflow-hidden", className)}>
      <div className="p-2 border-b bg-muted/40 flex justify-between items-center">
        <span className="text-xs text-muted-foreground">
          {filename ? filename : 'Markdown Preview'}
        </span>
        <div className="flex gap-1">
          <button
            onClick={handleToggleSource}
            className="p-1 rounded-md hover:bg-muted transition-colors"
            aria-label={showSource ? "Show rendered markdown" : "Show markdown source"}
          >
            {showSource ? <FileText className="h-4 w-4" /> : <Code className="h-4 w-4" />}
          </button>
          <button
            onClick={handleCopy}
            className="p-1 rounded-md hover:bg-muted transition-colors"
            aria-label="Copy markdown"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </button>
          <button
            onClick={handleDownload}
            className="p-1 rounded-md hover:bg-muted transition-colors"
            aria-label="Download markdown"
          >
            <Download className="h-4 w-4" />
          </button>
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
        className="overflow-auto"
        style={{ maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight }}
      >
        {showSource ? (
          <pre className="p-4 bg-muted/20 text-xs font-mono">
            {content}
          </pre>
        ) : (
          <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]} 
              rehypePlugins={[rehypeRaw, rehypeSanitize]}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
