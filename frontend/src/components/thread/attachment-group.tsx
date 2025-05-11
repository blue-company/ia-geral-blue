'use client';

import { X } from 'lucide-react';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Project } from '@/lib/api';

// Importação com caminho absoluto para evitar problemas de importação circular
import { FileAttachment } from '@/components/thread/file-attachment';

type LayoutStyle = 'inline' | 'grid';

interface UploadedFile {
  name: string;
  path: string;
  size: number;
  type: string;
  localUrl?: string;
}

interface AttachmentGroupProps {
  // Support both path strings and full file objects
  files: (string | UploadedFile)[];
  onRemove?: (index: number) => void;
  layout?: LayoutStyle;
  showPreviews?: boolean;
  className?: string;
  maxHeight?: string;
  gridImageHeight?: number; // New prop for grid image height
  collapsed?: boolean; // Add new collapsed prop
  project?: Project; // Add project prop
}

export function AttachmentGroup({
  files,
  onRemove,
  layout = 'inline',
  showPreviews = true,
  className,
  maxHeight = '216px',
  gridImageHeight = 180, // Increased from 120 for better visibility
  collapsed = true, // By default, HTML/MD files are collapsed
  project // Add project prop
}: AttachmentGroupProps) {
  if (!files || files.length === 0) return null;

  const isGridLayout = layout === 'grid';
  
  // Normalize files to always have the full object structure
  const normalizedFiles = files.map(file => {
    if (typeof file === 'string') {
      // If it's just a string path, convert to object
      return {
        name: file.split('/').pop() || file,
        path: file,
        size: 0,
        type: ''
      };
    }
    return file;
  });

  return (
    <div
      className={cn(
        'flex flex-wrap gap-2',
        isGridLayout ? 'flex-row' : 'flex-row items-center',
        className
      )}
      style={{
        maxHeight: isGridLayout ? 'none' : maxHeight,
        overflowY: isGridLayout ? 'visible' : 'auto'
      }}
    >
      {normalizedFiles.map((file, index) => (
        <div
          key={`${file.path}-${index}`}
          className={cn(
            'relative group',
            isGridLayout
              ? 'flex-grow min-w-[180px] max-w-[240px]'
              : 'flex-shrink-0'
          )}
        >
          <FileAttachment
            filePath={file.path}
            fileName={file.name}
            fileSize={file.size}
            layout={layout}
            showPreview={showPreviews}
            className={cn(
              isGridLayout
                ? 'w-full rounded-lg overflow-hidden'
                : 'max-w-[240px]'
            )}
            customStyle={
              isGridLayout
                ? {
                    height: `${gridImageHeight}px`,
                    width: '100%'
                  }
                : undefined
            }
            collapsed={collapsed} // Pass collapsed prop
            project={project} // Pass project to FileAttachment
          />
          {onRemove && (
            <div
              className={cn(
                'absolute cursor-pointer',
                isGridLayout
                  ? 'top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity'
                  : 'top-0 right-0 -mt-2 -mr-2'
              )}
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onRemove(index)}
                      className="h-5 w-5 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center hover:bg-secondary/90"
                      aria-label="Remove file"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>Remove file</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
