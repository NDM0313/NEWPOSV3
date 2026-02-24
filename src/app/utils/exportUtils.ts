/**
 * Export Utilities for Reports
 * Supports CSV, Excel, and PDF exports
 */

export interface ExportData {
  headers: string[];
  rows: (string | number)[][];
  title?: string;
}

/**
 * Export data as CSV
 */
export const exportToCSV = (data: ExportData, filename: string = 'report'): void => {
  const { headers, rows } = data;
  
  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      // Escape commas and quotes in cell values
      const cellStr = String(cell);
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(','))
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};

/**
 * Export data as Excel (CSV content with .xlsx extension so Excel opens it by default)
 * For true .xlsx binary format, add the 'xlsx' library and use XLSX.utils.aoa_to_sheet + writeFile
 */
export const exportToExcel = (data: ExportData, filename: string = 'report'): void => {
  const { headers, rows } = data;
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      const cellStr = String(cell);
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(','))
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export data as PDF
 * Note: For proper PDF generation, consider using libraries like:
 * - jsPDF with autoTable plugin
 * - pdfmake
 * - Puppeteer (server-side)
 * 
 * This implementation creates a simple HTML print that can be saved as PDF
 */
export const exportToPDF = (data: ExportData, filename: string = 'report'): void => {
  const { headers, rows, title } = data;
  
  // Create HTML table
  const tableHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title || filename}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
          }
          h1 {
            color: #333;
            margin-bottom: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #4CAF50;
            color: white;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background-color: #f2f2f2;
          }
          .footer {
            margin-top: 20px;
            text-align: right;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <h1>${title || filename}</h1>
        <p>Generated on: ${new Date().toLocaleString()}</p>
        <table>
          <thead>
            <tr>
              ${headers.map(h => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                ${row.map(cell => `<td>${cell}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer">
          <p>Din Collection ERP - Reports Module</p>
        </div>
      </body>
    </html>
  `;

  // Open in new window for printing
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(tableHTML);
    printWindow.document.close();
    
    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
};

/**
 * Export data as JSON (for backup/structured export)
 */
export const exportToJSON = (data: unknown, filename: string = 'export'): void => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.json`;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

/**
 * Helper: Convert report data to export format
 */
export const prepareExportData = (
  data: any[],
  columns: { key: string; label: string }[],
  title?: string
): ExportData => {
  const headers = columns.map(col => col.label);
  const rows = data.map(item => 
    columns.map(col => {
      const value = item[col.key];
      // Handle nested objects
      if (value && typeof value === 'object') {
        return JSON.stringify(value);
      }
      return value ?? '';
    })
  );

  return { headers, rows, title };
};
