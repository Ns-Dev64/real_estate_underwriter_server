import * as XLSX from 'xlsx';
import pdfParse from 'pdf-parse';
import * as fs from 'fs';

// Interface definitions
export interface T12Data {
  propertyName?: string;
  period?: string;
  totalIncome?: number;
  totalExpenses?: number;
  netOperatingIncome?: number;
  units?: number;
  occupancyRate?: number;
  rawData?: any[];
}

export interface RentRollData {
  propertyName?: string;
  totalUnits?: number;
  occupiedUnits?: number;
  vacantUnits?: number;
  occupancyRate?: number;
  totalRent?: number;
  averageRent?: number;
  units?: Array<{
    unitNumber?: string;
    tenantName?: string;
    rentAmount?: number;
    leaseStart?: string;
    leaseEnd?: string;
    status?: string;
  }>;
  rawData?: any[];
}

// Helper function to parse Excel files
export const parseExcelFile = (filePath: string): any[] => {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet);
};

// Helper function to parse CSV files
export const parseCSVFile = (filePath: string): any[] => {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet);
};

export const parsePDFFile = async (filePath: string): Promise<string> => {
  const stream = fs.createReadStream(filePath, { encoding :undefined});  // force Buffer chunks
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: any) => chunks.push(chunk));
    stream.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        const data = await pdfParse(buffer);
        resolve(data.text);
      } catch (err) {
        reject(err);
      }
    });
    stream.on('error', reject);
  });
};


// Helper function to extract T12 data from parsed content
export const extractT12Data = (data: any[] | string, fileType: string): T12Data => {
  const result: T12Data = {};
  
 if (fileType === 'pdf') {
  try {
    // Parse PDF text content for T12 data
    const text = data as string;
    
    // Security checks
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid PDF content: Empty or non-string data received');
    }
    
    // Check for common PDF corruption indicators
    if (text.length === 0) {
      throw new Error('PDF appears to be empty or corrupted');
    }
    
    // Check for binary data or null bytes that might indicate corruption
    if (text.includes('\x00') || text.includes('\uFFFD')) {
      console.warn('PDF may contain corrupted or binary data, attempting to clean...');
      // Clean the text by removing null bytes and replacement characters
      const cleanedText = text.replace(/\x00/g, '').replace(/\uFFFD/g, '');
      if (cleanedText.length === 0) {
        throw new Error('PDF content is entirely corrupted or binary');
      }
    }
    
    // Additional validation - check if we have readable text
    const readableChars = text.replace(/[^\w\s\$\.,\-\(\)]/g, '');
    if (readableChars.length < 10) {
      throw new Error('PDF does not contain sufficient readable text');
    }
    
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length === 0) {
      throw new Error('No readable lines found in PDF');
    }
    
    // Look for common T12 patterns with enhanced error handling
    let foundData = false;
    
    lines.forEach((line: string) => {
      try {
        // Skip lines that are too short or contain mostly special characters
        if (line.length < 3 || !/[a-zA-Z]/.test(line)) {
          return;
        }
        
        const lowerLine = line.toLowerCase();
        
        if (lowerLine.includes('total income') || lowerLine.includes('gross income')) {
          // Enhanced regex to capture various number formats
          const match = line.match(/\$?\s*([\d,]+(?:\.\d{2})?)/);
          if (match && match[1]) {
            const value = parseFloat(match[1].replace(/,/g, ''));
            if (!isNaN(value) && value > 0 && value < 100000000) { // Reasonable bounds check
              result.totalIncome = value;
              foundData = true;
            }
          }
        }
        
        if (lowerLine.includes('total expense') || lowerLine.includes('operating expense')) {
          const match = line.match(/\$?\s*([\d,]+(?:\.\d{2})?)/);
          if (match && match[1]) {
            const value = parseFloat(match[1].replace(/,/g, ''));
            if (!isNaN(value) && value > 0 && value < 100000000) {
              result.totalExpenses = value;
              foundData = true;
            }
          }
        }
        
        if (lowerLine.includes('net operating income') || lowerLine.includes('noi')) {
          const match = line.match(/\$?\s*([\d,]+(?:\.\d{2})?)/);
          if (match && match[1]) {
            const value = parseFloat(match[1].replace(/,/g, ''));
            if (!isNaN(value) && value > -50000000 && value < 100000000) { // NOI can be negative
              result.netOperatingIncome = value;
              foundData = true;
            }
          }
        }
      } catch (lineError) {
        // Log individual line parsing errors but continue processing
        console.warn(`Error processing line: "${line.substring(0, 50)}...": ${lineError}`);
      }
    });
    
    if (!foundData) {
      console.warn('No T12 financial data patterns found in PDF');
      // Don't throw error here, just log warning as PDF might be valid but not contain T12 data
    }
    
    // Sanity check on the extracted values
    if (result.totalIncome && result.totalExpenses && result.totalIncome < result.totalExpenses) {
      console.warn('Warning: Total expenses exceed total income, please verify data accuracy');
    }
    
    if (result.totalIncome && result.netOperatingIncome && Math.abs(result.netOperatingIncome - (result.totalIncome - (result.totalExpenses || 0))) > 1000) {
      console.warn('Warning: NOI calculation appears inconsistent with income/expenses');
    }
    
  } catch (error) {
    // Enhanced error handling for different types of PDF errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('bad XRef entry') || 
        errorMessage.includes('FormatError') ||
        errorMessage.includes('Invalid PDF') ||
        errorMessage.includes('PDF parsing failed')) {
      throw new Error(`PDF file appears to be corrupted or invalid. Please try uploading a different version of the file. Details: ${errorMessage}`);
    }
    
    if (errorMessage.includes('Password') || errorMessage.includes('encrypted')) {
      throw new Error('PDF file is password protected or encrypted. Please provide an unprotected version.');
    }
    
    if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      throw new Error('Network error while processing PDF. Please try again.');
    }
    
    console.error('PDF parsing error details:', error);
    throw new Error(`Failed to parse T12 PDF file: ${errorMessage}. Please ensure the file is a valid PDF containing T12 financial data.`);
  }
}else {
    // Parse Excel/CSV data
    const rows = data as any[];
    result.rawData = rows;
    
    rows.forEach((row: any, index: number) => {
      Object.keys(row).forEach(key => {
        const lowerKey = key.toLowerCase();
        
        if (lowerKey.includes('total income') || lowerKey.includes('gross income')) {
          result.totalIncome = parseFloat(row[key]) || 0;
        }
        
        if (lowerKey.includes('total expense') || lowerKey.includes('operating expense')) {
          result.totalExpenses = parseFloat(row[key]) || 0;
        }
        
        if (lowerKey.includes('net operating income') || lowerKey.includes('noi')) {
          result.netOperatingIncome = parseFloat(row[key]) || 0;
        }
        
        if (lowerKey.includes('unit') && lowerKey.includes('count')) {
          result.units = parseInt(row[key]) || 0;
        }
        
        if (lowerKey.includes('occupancy') && lowerKey.includes('rate')) {
          result.occupancyRate = parseFloat(row[key]) || 0;
        }
      });
    });
  }
  
  return result;
};

// Helper function to extract rent roll data from parsed content
export const extractRentRollData = (data: any[], fileType: string): RentRollData => {
  const result: RentRollData = {
    units: [],
    rawData: data
  };
  
  let totalRent = 0;
  let occupiedCount = 0;
  let vacantCount = 0;
  
  data.forEach((row: any) => {
    const unit: any = {};
    
    Object.keys(row).forEach(key => {
      const lowerKey = key.toLowerCase();
      
      if (lowerKey.includes('unit') && (lowerKey.includes('number') || lowerKey.includes('id'))) {
        unit.unitNumber = row[key];
      }
      
      if (lowerKey.includes('tenant') && lowerKey.includes('name')) {
        unit.tenantName = row[key];
      }
      
      if (lowerKey.includes('rent') && !lowerKey.includes('date')) {
        const rent = parseFloat(row[key]) || 0;
        unit.rentAmount = rent;
        totalRent += rent;
      }
      
      if (lowerKey.includes('lease') && lowerKey.includes('start')) {
        unit.leaseStart = row[key];
      }
      
      if (lowerKey.includes('lease') && lowerKey.includes('end')) {
        unit.leaseEnd = row[key];
      }
      
      if (lowerKey.includes('status')) {
        unit.status = row[key];
        if (row[key] && row[key].toLowerCase().includes('occupied')) {
          occupiedCount++;
        } else if (row[key] && row[key].toLowerCase().includes('vacant')) {
          vacantCount++;
        }
      }
    });
    
    if (!unit.status) {
      if (unit.tenantName && unit.tenantName.trim() !== '') {
        unit.status = 'Occupied';
        occupiedCount++;
      } else {
        unit.status = 'Vacant';
        vacantCount++;
      }
    }
    
    result.units?.push(unit);
  });
  
  result.totalUnits = data.length;
  result.occupiedUnits = occupiedCount;
  result.vacantUnits = vacantCount;
  result.occupancyRate = result.totalUnits > 0 ? (occupiedCount / result.totalUnits) * 100 : 0;
  result.totalRent = totalRent;
  result.averageRent = result.totalUnits > 0 ? totalRent / result.totalUnits : 0;
  
  return result;
};

