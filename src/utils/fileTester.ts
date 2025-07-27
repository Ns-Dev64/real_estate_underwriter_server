import * as fs from 'fs';
import * as path from 'path';
import  pdfParse from 'pdf-parse';
import * as XLSX from 'xlsx';

interface CorruptionTestResult {
  isCorrupted: boolean;
  error: string | null;
  fileType: string;
}

/**
 * Tests if a file is corrupted based on its type
 * @param filePath - Path to the file to test
 * @returns Promise resolving to corruption test result
 */
async function isFileCorrupted(filePath: string): Promise<CorruptionTestResult> {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return {
        isCorrupted: true,
        error: 'File does not exist',
        fileType: 'unknown'
      };
    }

    // Get file extension
    const ext = path.extname(filePath).toLowerCase();
    const fileType = ext.slice(1); // Remove the dot

    // Check if file is empty
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      return {
        isCorrupted: true,
        error: 'File is empty',
        fileType
      };
    }

    // Read file buffer
    const buffer = fs.readFileSync(filePath);

    switch (ext) {
      case '.csv':
        return await testCSVCorruption(buffer, filePath);
      
      case '.pdf':
        return await testPDFCorruption(buffer);
      
      case '.xlsx':
      case '.xls':
        return await testExcelCorruption(buffer);
      
      default:
        return {
          isCorrupted: false,
          error: 'Unsupported file type',
          fileType
        };
    }
  } catch (error) {
    return {
      isCorrupted: true,
      error: `Unexpected error: ${error}`,
      fileType: 'unknown'
    };
  }
}

/**
 * Test CSV file corruption
 */
async function testCSVCorruption(buffer: Buffer, filePath: string): Promise<CorruptionTestResult> {
  try {
    const content = buffer.toString('utf8');
    
    // Check for null bytes (common corruption indicator)
    if (content.includes('\0')) {
      return {
        isCorrupted: true,
        error: 'File contains null bytes',
        fileType: 'csv'
      };
    }

    // Check if file has readable content
    if (content.trim().length === 0) {
      return {
        isCorrupted: true,
        error: 'File appears to be empty or contains only whitespace',
        fileType: 'csv'
      };
    }

    // Basic CSV structure validation
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      return {
        isCorrupted: true,
        error: 'No valid lines found in CSV',
        fileType: 'csv'
      };
    }

    // Check for consistent column count (basic validation)
    if (lines.length > 1) {
      const headerCols = lines[0].split(',').length;
      const inconsistentLines = lines.slice(1, Math.min(10, lines.length))
        .filter(line => line.split(',').length !== headerCols);
      
      if (inconsistentLines.length > lines.slice(1, Math.min(10, lines.length)).length * 0.5) {
        return {
          isCorrupted: true,
          error: 'Inconsistent column count detected',
          fileType: 'csv'
        };
      }
    }

    return {
      isCorrupted: false,
      error: null,
      fileType: 'csv'
    };
  } catch (error) {
    return {
      isCorrupted: true,
      error: `CSV parsing error: ${error}`,
      fileType: 'csv'
    };
  }
}

/**
 * Test PDF file corruption
 */
async function testPDFCorruption(buffer: Buffer): Promise<CorruptionTestResult> {
  try {
    // Check PDF header
    const header = buffer.slice(0, 5).toString();
    if (!header.startsWith('%PDF-')) {
      return {
        isCorrupted: true,
        error: 'Invalid PDF header',
        fileType: 'pdf'
      };
    }

    // Check PDF footer
    const footer = buffer.slice(-10).toString();
    if (!footer.includes('%%EOF')) {
      return {
        isCorrupted: true,
        error: 'Missing PDF EOF marker',
        fileType: 'pdf'
      };
    }

    // Try to parse with pdf-parse
    const data = await pdfParse(buffer);
    
    // Check if parsing was successful
    if (!data || typeof data.numpages !== 'number' || data.numpages < 0) {
      return {
        isCorrupted: true,
        error: 'PDF parsing failed or invalid page count',
        fileType: 'pdf'
      };
    }

    return {
      isCorrupted: false,
      error: null,
      fileType: 'pdf'
    };
  } catch (error) {
    return {
      isCorrupted: true,
      error: `PDF parsing error: ${error}`,
      fileType: 'pdf'
    };
  }
}

/**
 * Test Excel file corruption
 */
async function testExcelCorruption(buffer: Buffer): Promise<CorruptionTestResult> {
  try {
    // Try to read the workbook
    const workbook = XLSX.read(buffer, { 
      type: 'buffer',
      cellDates: true,
      cellNF: false,
      cellStyles: false
    });

    // Check if workbook was parsed successfully
    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      return {
        isCorrupted: true,
        error: 'No sheets found in Excel file',
        fileType: 'excel'
      };
    }

    // Try to access at least one worksheet
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    if (!worksheet) {
      return {
        isCorrupted: true,
        error: 'Cannot access worksheet data',
        fileType: 'excel'
      };
    }

    // Try to convert to JSON to ensure data is readable
    XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    return {
      isCorrupted: false,
      error: null,
      fileType: 'excel'
    };
  } catch (error) {
    return {
      isCorrupted: true,
      error: `Excel parsing error: ${error}`,
      fileType: 'excel'
    };
  }
}

export {
  isFileCorrupted,
  testCSVCorruption,
  testPDFCorruption,
  testExcelCorruption,
  CorruptionTestResult
};

// Uncomment to test