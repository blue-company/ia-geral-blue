'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Copy, Check, Download, Sun, Moon, Table } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CsvRenderer } from './csv-renderer';

interface CodeRendererProps {
  content: string;
  language?: string;
  filename?: string;
  className?: string;
  maxHeight?: string | number;
}

export function CodeRenderer({ content, language, filename, maxHeight = 400, className }: CodeRendererProps) {
  const [copied, setCopied] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [showAsCsv, setShowAsCsv] = useState(false);

  // Detect if content might be CSV
  const mightBeCsv = useMemo(() => {
    if (!content) return false;

    // Check if filename has .csv extension
    if (filename?.toLowerCase().endsWith('.csv')) return true;

    // Check content structure (has commas, consistent number of columns)
    const lines = content.trim().split('\n');
    if (lines.length < 2) return false; // Need at least header and one data row

    // Count commas in first line to determine expected columns
    const firstLineCommas = (lines[0].match(/,/g) || []).length;

    // Check if at least 50% of lines have the same number of commas (allowing for some variation)
    let matchingLines = 0;
    for (const line of lines) {
      const commas = (line.match(/,/g) || []).length;
      if (Math.abs(commas - firstLineCommas) <= 1) { // Allow 1 comma difference
        matchingLines++;
      }
    }

    return (matchingLines / lines.length) > 0.5 && firstLineCommas > 0;
  }, [content, filename]);

  // Determine language from filename if not provided
  const detectedLanguage = React.useMemo(() => {
    if (language && language !== 'text') return language;

    if (filename) {
      const extension = filename.split('.').pop()?.toLowerCase();

      // Map common extensions to languages
      const extensionMap: Record<string, string> = {
        js: 'javascript',
        jsx: 'jsx',
        ts: 'typescript',
        tsx: 'tsx',
        py: 'python',
        rb: 'ruby',
        java: 'java',
        cs: 'csharp',
        go: 'go',
        php: 'php',
        rs: 'rust',
        swift: 'swift',
        kt: 'kotlin',
        c: 'c',
        cpp: 'cpp',
        h: 'c',
        hpp: 'cpp',
        html: 'html',
        css: 'css',
        scss: 'scss',
        sass: 'sass',
        json: 'json',
        md: 'markdown',
        yml: 'yaml',
        yaml: 'yaml',
        sh: 'bash',
        bash: 'bash',
        sql: 'sql',
      };

      return extension && extension in extensionMap ? extensionMap[extension] : 'text';
    }

    return 'text';
  }, [language, filename]);

  // Copy code to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download code as file
  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `code.${detectedLanguage === 'text' ? 'txt' : detectedLanguage}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Toggle theme
  const handleToggleTheme = () => {
    setIsDarkTheme(!isDarkTheme);
  };

  // Determine syntax highlighter style based on theme
  const syntaxStyle = isDarkTheme ? oneDark : oneLight;

  return (
    <div className={cn("relative group rounded-md overflow-hidden", className)}>
      <div className="absolute right-2 top-2 flex gap-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        {mightBeCsv && (
          <button
            onClick={() => setShowAsCsv(!showAsCsv)}
            className="p-1.5 rounded-md bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
            aria-label={showAsCsv ? "View as code" : "View as table"}
            title={showAsCsv ? "View as code" : "View as table"}
          >
            <Table className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
          aria-label="Copy code"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
        <button
          onClick={handleDownload}
          className="p-1.5 rounded-md bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
          aria-label="Download code"
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          onClick={handleToggleTheme}
          className="p-1.5 rounded-md bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
          aria-label={isDarkTheme ? "Switch to light theme" : "Switch to dark theme"}
        >
          {isDarkTheme ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
      {filename && (
        <div className="px-4 py-2 border-b text-sm font-medium bg-muted/50">
          {filename}
          {mightBeCsv && (
            <span className="ml-2 text-xs text-muted-foreground">
              {showAsCsv ? "(Visualizando como tabela)" : "(Clique no ícone de tabela para visualizar como CSV)"}
            </span>
          )}
        </div>
      )}
      <div style={{ maxHeight }} className="overflow-auto">
        {showAsCsv && mightBeCsv ? (
          <CsvRenderer content={content} filename={filename || 'data.csv'} maxHeight={maxHeight} />
        ) : (
          <SyntaxHighlighter
            language={detectedLanguage}
            style={syntaxStyle}
            customStyle={{
              margin: 0,
              borderRadius: 0,
              fontSize: '0.9rem',
              backgroundColor: 'transparent',
            }}
            showLineNumbers
            wrapLongLines
          >
            {content}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  );
}
