'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Maximize2, ZoomIn, ZoomOut, X, RotateCw, Download, Loader2 } from 'lucide-react';

interface ImageRendererProps {
  url: string;
  alt?: string;
  className?: string;
  downloadable?: boolean;
}

export function ImageRenderer({ url, alt = 'Image preview', className, downloadable = true }: ImageRendererProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  
  // Reset states when URL changes
  useEffect(() => {
    setIsLoading(true);
    setError(false);
    setZoomLevel(1);
    setRotation(0);
  }, [url]);
  
  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    // Reset zoom and rotation when toggling fullscreen
    setZoomLevel(1);
    setRotation(0);
  };
  
  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoomLevel(prev => Math.min(prev + 0.25, 4));
  };
  
  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoomLevel(prev => Math.max(prev - 0.25, 0.25));
  };
  
  const handleRotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRotation(prev => (prev + 90) % 360);
  };
  
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Create a temporary anchor element
    const link = document.createElement('a');
    link.href = url;
    link.download = alt || 'image-download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleImageLoad = () => {
    setIsLoading(false);
  };
  
  const handleImageError = () => {
    setIsLoading(false);
    setError(true);
  };
  
  if (isFullscreen) {
    return (
      <div 
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={handleToggleFullscreen}
      >
        {/* Toolbar */}
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          <button 
            onClick={handleZoomIn}
            className="p-2 bg-background/80 rounded-full hover:bg-background transition-colors"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
          <button 
            onClick={handleZoomOut}
            className="p-2 bg-background/80 rounded-full hover:bg-background transition-colors"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <button 
            onClick={handleRotate}
            className="p-2 bg-background/80 rounded-full hover:bg-background transition-colors"
            aria-label="Rotate image"
          >
            <RotateCw className="h-5 w-5" />
          </button>
          {downloadable && (
            <button 
              onClick={handleDownload}
              className="p-2 bg-background/80 rounded-full hover:bg-background transition-colors"
              aria-label="Download image"
            >
              <Download className="h-5 w-5" />
            </button>
          )}
          <button 
            onClick={handleToggleFullscreen}
            className="p-2 bg-background/80 rounded-full hover:bg-background transition-colors"
            aria-label="Close fullscreen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Image container */}
        <div 
          className="relative max-w-full max-h-full overflow-auto"
          onClick={e => e.stopPropagation()}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {error ? (
            <div className="p-8 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <p>Failed to load image</p>
              <p className="text-xs">{url}</p>
            </div>
          ) : (
            <img 
              src={url} 
              alt={alt} 
              className="max-w-none transition-transform duration-200"
              style={{ 
                transform: `scale(${zoomLevel}) rotate(${rotation}deg)`, 
                transformOrigin: 'center',
                opacity: isLoading ? 0.5 : 1
              }}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          )}
        </div>
      </div>
    );
  }
  
  return (
    <div className={cn("relative group", className)}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/20 rounded-md">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
      {error ? (
        <div className="p-4 flex flex-col items-center justify-center gap-2 text-muted-foreground border rounded-md">
          <p className="text-sm">Failed to load image</p>
        </div>
      ) : (
        <>
          <img 
            src={url} 
            alt={alt} 
            className="max-w-full h-auto rounded-md"
            onLoad={handleImageLoad}
            onError={handleImageError}
            style={{ opacity: isLoading ? 0.5 : 1 }}
          />
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {downloadable && (
              <button
                onClick={handleDownload}
                className="p-1.5 bg-background/80 rounded-md hover:bg-background transition-colors"
                aria-label="Download image"
              >
                <Download className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={handleToggleFullscreen}
              className="p-1.5 bg-background/80 rounded-md hover:bg-background transition-colors"
              aria-label="View fullscreen"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
