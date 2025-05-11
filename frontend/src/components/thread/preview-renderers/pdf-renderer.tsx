'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Maximize2, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, X, RotateCw, FileText } from 'lucide-react';

interface PdfRendererProps {
  url: string;
  className?: string;
  maxHeight?: string | number;
  filename?: string;
}

export function PdfRenderer({ url, className, maxHeight = 500, filename }: PdfRendererProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  
  // Toggle fullscreen mode
  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };
  
  // Handle zoom in
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 200));
  };
  
  // Handle zoom out
  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 50));
  };
  
  // Handle rotation
  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };
  
  // Handle download
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'document.pdf';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Construct iframe URL with parameters
  const iframeUrl = `${url}#toolbar=0&navpanes=1&scrollbar=1&view=FitH`;
  
  // Render the fullscreen view
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-background/90">
          <span className="font-medium">PDF Viewer {filename ? `- ${filename}` : ''}</span>
          <div className="flex gap-2">
            <button
              onClick={handleZoomOut}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              aria-label="Zoom out"
            >
              <ZoomOut className="h-5 w-5" />
            </button>
            <span className="flex items-center px-2 text-sm">{zoom}%</span>
            <button
              onClick={handleZoomIn}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-5 w-5" />
            </button>
            <button
              onClick={handleRotate}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              aria-label="Rotate"
            >
              <RotateCw className="h-5 w-5" />
            </button>
            <button
              onClick={handleDownload}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              aria-label="Download PDF"
            >
              <Download className="h-5 w-5" />
            </button>
            <a 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-2 rounded-md hover:bg-muted transition-colors"
              aria-label="Open in new tab"
            >
              <Maximize2 className="h-5 w-5" />
            </a>
            <button
              onClick={handleToggleFullscreen}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              aria-label="Exit fullscreen"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* PDF Viewer */}
        <div className="flex-1 overflow-hidden bg-muted/20 p-4">
          <div 
            className="w-full h-full overflow-auto flex items-center justify-center"
            style={{ 
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              transition: 'transform 0.2s ease-in-out'
            }}
          >
            <iframe 
              src={iframeUrl}
              className="w-full h-full border-none bg-white shadow-lg"
              title="PDF Document"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      </div>
    );
  }
  
  // Render the compact view
  return (
    <div className={cn("border rounded-md overflow-hidden", className)}>
      <div className="p-2 border-b bg-muted/40 flex justify-between items-center">
        <span className="text-xs text-muted-foreground">PDF Document</span>
        <div className="flex gap-1">
          <button
            onClick={handleZoomOut}
            className="p-1 rounded-md hover:bg-muted transition-colors"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="flex items-center px-1 text-xs">{zoom}%</span>
          <button
            onClick={handleZoomIn}
            className="p-1 rounded-md hover:bg-muted transition-colors"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={handleRotate}
            className="p-1 rounded-md hover:bg-muted transition-colors"
            aria-label="Rotate"
          >
            <RotateCw className="h-4 w-4" />
          </button>
          <button
            onClick={handleDownload}
            className="p-1 rounded-md hover:bg-muted transition-colors"
            aria-label="Download PDF"
          >
            <Download className="h-4 w-4" />
          </button>
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-1 rounded-md hover:bg-muted transition-colors"
            aria-label="Open in new tab"
          >
            <Maximize2 className="h-4 w-4" />
          </a>
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
        className="bg-white dark:bg-black p-0 overflow-hidden"
        style={{ 
          height: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
          transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
          transformOrigin: 'center center',
          transition: 'transform 0.2s ease-in-out'
        }}
      >
        <iframe 
          src={iframeUrl}
          className="w-full h-full border-none"
          title="PDF Document"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
      {/* Fallback for browsers that don't support PDF embedding */}
      <noscript>
        <div className="p-8 flex flex-col items-center justify-center gap-4 text-muted-foreground">
          <FileText className="h-12 w-12" />
          <p>PDF preview not available</p>
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Download PDF
          </a>
        </div>
      </noscript>
    </div>
  );
}
