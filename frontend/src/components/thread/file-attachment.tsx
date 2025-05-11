'use client';

import { useState, useEffect } from 'react';
import { FileText, Image, FileCode, FileSpreadsheet, File as FileIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { Project } from '@/lib/api';

// Importações com caminhos absolutos para evitar problemas
import { CodeRenderer } from '@/components/thread/preview-renderers/code-renderer';
import { MarkdownRenderer } from '@/components/thread/preview-renderers/markdown-renderer';
import { HtmlRenderer } from '@/components/thread/preview-renderers/html-renderer';
import { ImageRenderer } from '@/components/thread/preview-renderers/image-renderer';
import { PdfRenderer } from '@/components/thread/preview-renderers/pdf-renderer';
import { CsvRenderer } from '@/components/thread/preview-renderers/csv-renderer';
import { useFileContent } from '@/hooks/use-file-content';
import { useImageContent } from '@/hooks/use-image-content';

// Define basic file types
export type FileType =
  | 'image'
  | 'pdf'
  | 'code'
  | 'markdown'
  | 'html'
  | 'csv'
  | 'text'
  | 'unknown';

// File extensions to type mapping
const fileExtensionMap: Record<string, FileType> = {
  // Images
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  svg: 'image',
  webp: 'image',
  bmp: 'image',
  ico: 'image',
  
  // Documents
  pdf: 'pdf',
  
  // Code
  js: 'code',
  jsx: 'code',
  ts: 'code',
  tsx: 'code',
  py: 'code',
  java: 'code',
  c: 'code',
  cpp: 'code',
  cs: 'code',
  go: 'code',
  rs: 'code',
  rb: 'code',
  php: 'code',
  html: 'html',
  htm: 'html',
  css: 'code',
  scss: 'code',
  sass: 'code',
  less: 'code',
  json: 'code',
  yaml: 'code',
  yml: 'code',
  xml: 'code',
  sh: 'code',
  bash: 'code',
  
  // Markdown
  md: 'markdown',
  markdown: 'markdown',
  
  // CSV
  csv: 'csv',
  
  // Text
  txt: 'text',
  
  // Default
  unknown: 'unknown'
};

// Determine file type from path or mime type
export function getFileType(filePath: string, mimeType?: string): FileType {
  // If we have a mime type, use it for initial classification
  if (mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType === 'text/html') return 'html';
    if (mimeType === 'text/markdown') return 'markdown';
    if (mimeType === 'text/csv') return 'csv';
    if (mimeType === 'text/plain') return 'text';
    // Continue with extension check as fallback
  }
  
  // Extract extension from path
  const extension = filePath.split('.').pop()?.toLowerCase() || 'unknown';
  
  // Return mapped type or default to unknown
  return fileExtensionMap[extension] || 'unknown';
}

// Get icon component for file type
export function getFileIcon(fileType: FileType, className?: string) {
  const iconProps = { className: cn('h-5 w-5', className) };
  
  switch (fileType) {
    case 'image':
      return <Image {...iconProps} />;
    case 'code':
    case 'html':
      return <FileCode {...iconProps} />;
    case 'markdown':
    case 'text':
      return <FileText {...iconProps} />;
    case 'csv':
      return <FileSpreadsheet {...iconProps} />;
    default:
      return <FileIcon {...iconProps} />;
  }
}

interface FileAttachmentProps {
  filePath: string;
  fileName?: string;
  fileSize?: number;
  layout?: 'inline' | 'grid';
  showPreview?: boolean;
  className?: string;
  localPreviewUrl?: string;
  customStyle?: React.CSSProperties;
  /**
   * Whether to show the file in collapsed mode
   * - true: HTML, MD, and CSV files show only a preview button
   * - false: HTML, MD, and CSV files show rendered content in grid layout
   */
  collapsed?: boolean;
  project?: Project;
  onClick?: () => void;
}

// Cache fetched content between mounts to avoid duplicate fetches
const contentCache = new Map<string, string>();
const imageCache = new Map<string, string>();

export function FileAttachment({
  filePath,
  fileName,
  fileSize,
  layout = 'inline',
  showPreview = true,
  localPreviewUrl,
  customStyle,
  collapsed = true,
  project,
  className,
  onClick
}: FileAttachmentProps) {
  // Authentication
  const { session } = useAuth();
  
  // Extract file name from path if not provided
  const displayName = fileName || filePath.split('/').pop() || 'File';
  
  // Determine file type
  const fileType = getFileType(filePath);
  
  // State for content loading and errors
  const [hasError, setHasError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Get file content for preview
  const { content: fileContent, isLoading: isContentLoading } = useFileContent(
    filePath,
    fileType !== 'image' && (showPreview || isExpanded),
    contentCache
  );
  
  // Get image content for preview
  const { imageUrl: fileUrl, isLoading: isImageLoading } = useImageContent(
    filePath,
    fileType === 'image' && (showPreview || isExpanded),
    imageCache,
    localPreviewUrl
  );
  
  // Reset error state when path changes
  useEffect(() => {
    setHasError(false);
  }, [filePath]);
  
  // Format file size
  const formattedSize = fileSize ? formatFileSize(fileSize) : '';
  
  // Determine if we're in grid layout
  const isGridLayout = layout === 'grid';
  
  // Determine if we should show preview
  const shouldShowPreview = showPreview && !hasError;
  
  // Determine if we should show expanded content
  const shouldShowExpanded = isExpanded && !hasError;
  
  // Format file size helper
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }
  
  // Toggle expanded state
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };
  
  // Render appropriate preview based on file type
  const renderPreview = () => {
    if (isContentLoading || isImageLoading) {
      return (
        <div className="flex items-center justify-center h-full w-full p-4">
          <div className="animate-pulse bg-muted h-4 w-16 rounded"></div>
        </div>
      );
    }
    
    if (hasError) {
      return (
        <div className="flex items-center justify-center h-full w-full p-4 text-muted-foreground text-sm">
          Preview unavailable
        </div>
      );
    }
    
    if (fileType === 'image' && fileUrl) {
      return (
        <button 
          className="w-full h-full flex items-center justify-center overflow-hidden bg-background"
          onClick={toggleExpanded}
        >
          <img 
            src={fileUrl} 
            alt={displayName}
            className="max-h-full max-w-full object-contain"
            style={{
              objectFit: isGridLayout ? "cover" : "contain"
            }}
            onLoad={() => { }}
            onError={(e) => {
                console.error('Image load error:', e);
                setHasError(true);
                // If the image failed to load and we have a localPreviewUrl that's a blob URL, try using it directly
                if (localPreviewUrl && typeof localPreviewUrl === 'string' && localPreviewUrl.startsWith('blob:')) {
                    (e.target as HTMLImageElement).src = localPreviewUrl;
                }
            }}
          />
        </button>
      );
    }
    
    if (fileType === 'markdown' && fileContent) {
      return collapsed && !isExpanded ? (
        <Button 
          variant="ghost" 
          onClick={toggleExpanded}
          className="h-auto py-1 px-2 text-xs"
        >
          View Markdown
        </Button>
      ) : (
        <div className="w-full overflow-auto bg-background rounded-md">
          <MarkdownRenderer 
            content={fileContent} 
            filename={displayName} 
            maxHeight={layout === 'grid' ? 300 : 400} 
          />
        </div>
      );
    }
    
    if (fileType === 'html' && fileContent) {
      return collapsed && !isExpanded ? (
        <Button 
          variant="ghost" 
          onClick={toggleExpanded}
          className="h-auto py-1 px-2 text-xs"
        >
          View HTML
        </Button>
      ) : layout === 'grid' ? (
        <div className="w-full h-full overflow-hidden bg-background rounded-md">
          <HtmlRenderer 
            content={fileContent}
            previewUrl={fileUrl}
            className="h-full w-full"
            project={project}
            filename={displayName}
            maxHeight={layout === 'grid' ? 300 : 400}
          />
        </div>
      ) : (
        <div className="p-4 text-muted-foreground">
          HTML preview not available in inline mode
        </div>
      );
    }
    
    if (fileType === 'csv' && fileContent) {
      return collapsed && !isExpanded ? (
        <Button 
          variant="ghost" 
          onClick={toggleExpanded}
          className="h-auto py-1 px-2 text-xs"
        >
          View CSV
        </Button>
      ) : (
        <div className="w-full overflow-auto bg-background rounded-md">
          <CsvRenderer 
            content={fileContent} 
            filename={displayName} 
            maxHeight={layout === 'grid' ? 300 : 400} 
          />
        </div>
      );
    }
    
    if ((fileType === 'code' || fileType === 'text') && fileContent) {
      return (
        <div className="w-full overflow-auto bg-background rounded-md">
          <CodeRenderer 
            content={fileContent} 
            filename={displayName} 
            maxHeight={layout === 'grid' ? 300 : 400} 
          />
        </div>
      );
    }
    
    if (fileType === 'pdf' && fileUrl) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <PdfRenderer 
            url={fileUrl} 
            filename={displayName} 
            maxHeight={layout === 'grid' ? 300 : 400} 
          />
        </div>
      );
    }
    
    // Default case - no preview
    return null;
  };
  
  // Inline layout
  if (layout === 'inline') {
    return (
      <div 
        className={cn(
          'flex items-center gap-2 p-2 rounded-md border bg-background',
          shouldShowExpanded ? 'flex-col items-start' : '',
          className || '',
          onClick ? 'cursor-pointer' : ''
        )}
        style={customStyle}
        onClick={onClick}
      >
        <div className="flex items-center gap-2 w-full">
          {getFileIcon(fileType, 'text-muted-foreground')}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate max-w-[300px] w-full">{displayName}</div>
            {formattedSize && (
              <div className="text-xs text-muted-foreground">{formattedSize}</div>
            )}
          </div>
          {shouldShowPreview && ['markdown', 'html', 'csv'].includes(fileType) && !shouldShowExpanded && (
            <Button 
              variant="ghost" 
              onClick={toggleExpanded}
              className="h-auto py-1 px-2 text-xs"
            >
              Preview
            </Button>
          )}
        </div>
        
        {shouldShowExpanded && (
          <div className="w-full mt-2">
            {renderPreview()}
          </div>
        )}
      </div>
    );
  }
  
  // Grid layout
  return (
    <div 
      className={cn(
        'flex flex-col overflow-hidden rounded-md border bg-background',
        className || '',
        onClick ? 'cursor-pointer' : ''
      )}
      style={customStyle}
      onClick={onClick}
    >
      {shouldShowPreview ? (
        <div className="flex-1 overflow-hidden">
          {renderPreview()}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-4">
          {getFileIcon(fileType, 'h-12 w-12 text-muted-foreground')}
        </div>
      )}
      
      <div className="p-2 border-t bg-background/50">
        <div className="text-sm font-medium truncate max-w-[300px] w-full">{displayName}</div>
        {formattedSize && (
          <div className="text-xs text-muted-foreground">{formattedSize}</div>
        )}
      </div>
    </div>
  );
}

// Grid of file attachments
interface FileAttachmentGridProps {
  attachments: string[];
  className?: string;
  sandboxId?: string;
  showPreviews?: boolean;
  collapsed?: boolean;
  project?: Project;
  onFileClick?: (filePath?: string) => void;
}

export function FileAttachmentGrid({
  attachments,
  className,
  sandboxId,
  showPreviews = true,
  collapsed = false,
  project,
  onFileClick
}: FileAttachmentGridProps) {
  if (!attachments || attachments.length === 0) return null;
  
  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4', className)}>
      {attachments.map((path, index) => (
        <FileAttachment
          key={`${path}-${index}`}
          filePath={path}
          layout="grid"
          showPreview={showPreviews}
          collapsed={collapsed}
          project={project}
          onClick={() => onFileClick && onFileClick(path)}
        />
      ))}
    </div>
  );
}
