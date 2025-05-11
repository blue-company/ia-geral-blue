'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Search, ChevronLeft, ChevronRight, Download, Maximize2, X } from 'lucide-react';

interface CsvRendererProps {
  content: string;
  className?: string;
  maxHeight?: string | number;
  filename?: string;
}

type SortDirection = 'asc' | 'desc' | null;

export function CsvRenderer({ content, className, maxHeight = 400, filename = 'data.csv' }: CsvRendererProps) {
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Parse CSV content
  const parsedData = useMemo(() => {
    try {
      // Split by lines and filter out empty lines
      const lines = content.split('\n').filter(line => line.trim() !== '');
      
      if (lines.length === 0) return { headers: [], rows: [] };
      
      // Parse headers (first line)
      const headers = lines[0].split(',').map(header => header.trim().replace(/^"|"$/g, ''));
      
      // Parse rows (remaining lines)
      const rows = lines.slice(1).map(line => {
        const values = [];
        let inQuotes = false;
        let currentValue = '';
        
        // Handle quoted values with commas inside
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(currentValue.trim());
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        
        // Add the last value
        values.push(currentValue.trim());
        
        return values;
      });
      
      return { headers, rows };
    } catch (error) {
      console.error('Error parsing CSV:', error);
      return { headers: [], rows: [] };
    }
  }, [content]);
  
  // Reset pagination when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [content, searchTerm]);
  
  const { headers, rows } = parsedData;
  
  // Apply sorting
  const sortedRows = useMemo(() => {
    if (sortColumn === null || sortDirection === null) {
      return [...rows];
    }
    
    return [...rows].sort((a, b) => {
      const aValue = a[sortColumn] || '';
      const bValue = b[sortColumn] || '';
      
      // Try to sort as numbers if possible
      const aNum = parseFloat(aValue);
      const bNum = parseFloat(bValue);
      
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }
      
      // Otherwise sort as strings
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    });
  }, [rows, sortColumn, sortDirection]);
  
  // Apply search filter
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) {
      return sortedRows;
    }
    
    const term = searchTerm.toLowerCase();
    return sortedRows.filter(row => 
      row.some(cell => cell.toLowerCase().includes(term))
    );
  }, [sortedRows, searchTerm]);
  
  // Apply pagination
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredRows.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredRows, currentPage, rowsPerPage]);
  
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  
  // Handle sort toggle
  const handleSort = (columnIndex: number) => {
    if (sortColumn === columnIndex) {
      // Toggle direction or reset
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      // Set new sort column
      setSortColumn(columnIndex);
      setSortDirection('asc');
    }
  };
  
  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };
  
  // Handle rows per page change
  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRowsPerPage(Number(e.target.value));
    setCurrentPage(1); // Reset to first page
  };
  
  // Handle download CSV
  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  // Toggle fullscreen
  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };
  
  if (headers.length === 0) {
    return (
      <div className="p-4 text-muted-foreground">
        No valid CSV data found
      </div>
    );
  }
  
  // Render the fullscreen view
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-background/90">
          <span className="font-medium">CSV Viewer {filename ? `- ${filename}` : ''}</span>
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              aria-label="Download CSV"
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
        
        {/* Search and pagination controls */}
        <div className="p-4 border-b flex flex-wrap gap-4 justify-between items-center bg-background/50">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-4 py-2 text-sm border rounded-md w-64 bg-background"
            />
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              Showing {filteredRows.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0} - {Math.min(currentPage * rowsPerPage, filteredRows.length)} of {filteredRows.length}
            </span>
            <select
              value={rowsPerPage}
              onChange={handleRowsPerPageChange}
              className="border rounded-md p-1 bg-background"
            >
              <option value={10}>10 rows</option>
              <option value={25}>25 rows</option>
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
            </select>
            <div className="flex gap-1">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1 rounded-md hover:bg-muted transition-colors disabled:opacity-50"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="flex items-center px-2">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1 rounded-md hover:bg-muted transition-colors disabled:opacity-50"
                aria-label="Next page"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Table */}
        <div className="flex-1 overflow-auto p-4 bg-background">
          <table className="w-full border-collapse">
            <thead className="bg-muted/40 sticky top-0">
              <tr>
                {headers.map((header, index) => (
                  <th 
                    key={`header-${index}`}
                    className="p-2 text-left text-sm font-medium border cursor-pointer hover:bg-muted/60 transition-colors"
                    onClick={() => handleSort(index)}
                  >
                    <div className="flex items-center gap-1">
                      <span>{header}</span>
                      {sortColumn === index && (
                        sortDirection === 'asc' ? 
                          <ChevronUp className="h-4 w-4" /> : 
                          <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`} className={rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/10 hover:bg-muted/20'}>
                  {row.map((cell, cellIndex) => (
                    <td 
                      key={`cell-${rowIndex}-${cellIndex}`}
                      className="p-2 text-sm border"
                    >
                      {cell}
                    </td>
                  ))}
                  {/* Add empty cells if row has fewer cells than headers */}
                  {row.length < headers.length && 
                    Array(headers.length - row.length).fill(0).map((_, i) => (
                      <td 
                        key={`empty-${rowIndex}-${i}`}
                        className="p-2 text-sm border"
                      ></td>
                    ))
                  }
                </tr>
              ))}
              {paginatedRows.length === 0 && (
                <tr>
                  <td colSpan={headers.length} className="p-4 text-center text-muted-foreground">
                    {searchTerm ? 'No matching results found' : 'No data available'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  
  // Render the compact view
  return (
    <div className={cn("border rounded-md overflow-hidden", className)}>
      <div className="p-2 border-b bg-muted/40 flex justify-between items-center">
        <span className="text-xs text-muted-foreground">CSV Data</span>
        <div className="flex gap-1">
          <button
            onClick={handleDownload}
            className="p-1 rounded-md hover:bg-muted transition-colors"
            aria-label="Download CSV"
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
      
      <div className="p-2 border-b bg-muted/20 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-7 pr-2 py-1 text-xs border rounded-md w-full bg-background"
          />
        </div>
      </div>
      
      <div className="overflow-auto" style={{ maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight }}>
        <table className="w-full border-collapse">
          <thead className="bg-muted/40 sticky top-0">
            <tr>
              {headers.map((header, index) => (
                <th 
                  key={`header-${index}`}
                  className="p-2 text-left text-xs font-medium text-muted-foreground border cursor-pointer hover:bg-muted/60 transition-colors"
                  onClick={() => handleSort(index)}
                >
                  <div className="flex items-center gap-1">
                    <span>{header}</span>
                    {sortColumn === index && (
                      sortDirection === 'asc' ? 
                        <ChevronUp className="h-3 w-3" /> : 
                        <ChevronDown className="h-3 w-3" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`} className={rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/10 hover:bg-muted/20'}>
                {row.map((cell, cellIndex) => (
                  <td 
                    key={`cell-${rowIndex}-${cellIndex}`}
                    className="p-2 text-xs border"
                  >
                    {cell}
                  </td>
                ))}
                {/* Add empty cells if row has fewer cells than headers */}
                {row.length < headers.length && 
                  Array(headers.length - row.length).fill(0).map((_, i) => (
                    <td 
                      key={`empty-${rowIndex}-${i}`}
                      className="p-2 text-xs border"
                    ></td>
                  ))
                }
              </tr>
            ))}
            {paginatedRows.length === 0 && (
              <tr>
                <td colSpan={headers.length} className="p-4 text-center text-xs text-muted-foreground">
                  {searchTerm ? 'No matching results found' : 'No data available'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {filteredRows.length > rowsPerPage && (
        <div className="p-2 border-t bg-muted/20 flex justify-between items-center text-xs">
          <span className="text-muted-foreground">
            {filteredRows.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0}-{Math.min(currentPage * rowsPerPage, filteredRows.length)} of {filteredRows.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1 rounded-md hover:bg-muted transition-colors disabled:opacity-50"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <span className="flex items-center px-1">
              {currentPage}/{totalPages}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-1 rounded-md hover:bg-muted transition-colors disabled:opacity-50"
              aria-label="Next page"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
