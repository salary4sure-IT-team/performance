const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const { parse } = require('csv-parse/sync');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Google Sheets configuration - for published sheets
// Format: https://docs.google.com/spreadsheets/d/e/{SHEET_ID}/pub?output=csv&gid={GID}
// Convert from pubhtml URL: replace /pubhtml with /pub and add output=csv
const PUBLISHED_SHEET_URL = process.env.PUBLISHED_SHEET_URL || 
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTzniutQXMP9vyaICei8iW8NJxQLYDvM-tqyx_Wzp7T4ZqstkD9Ac7q3kpUCYV2eTSfAsgc0fXQQ6Eb/pub?output=csv&gid=0';

// Salary4Sure Google Sheet URL
const SALARY4SURE_SHEET_URL = process.env.SALARY4SURE_SHEET_URL || 
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRNPt_FYJXzimdb9d1w5v7Dyoq-cB26orQKBwOlOCUxwBmDtMgxMoMgpK_XDymo_5dfDh79pHPaHtyR/pub?output=csv&gid=1101474402';

// Parse date from DD/MM/YYYY or DD-MM-YYYY format (Excel format)
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  const str = dateStr.toString().trim();
  
  // Try DD/MM/YYYY or DD-MM-YYYY format (Excel format, e.g., 09/01/2026 or 09-01-2026 = 9th January 2026)
  const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1], 10);
    const month = parseInt(ddmmyyyy[2], 10) - 1; // Month is 0-indexed
    const year = parseInt(ddmmyyyy[3], 10);
    
    // Validate: month should be 0-11, day should be 1-31
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const date = new Date(year, month, day);
      // Check if date is valid (handles invalid dates like Feb 30)
      if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
        return date;
      }
    }
  }
  
  // Try standard Date parsing as fallback
  const date = new Date(str);
  if (!isNaN(date.getTime())) {
    return date;
  }
  
  return null;
}

// Check if date is from January 1, 2026 to today
function isFromJanuary12026ToToday(date) {
  if (!date) return false;
  const jan1_2026 = new Date(2026, 0, 1); // January 1, 2026
  jan1_2026.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(23, 59, 59, 999); // End of today
  
  // Create a copy of the date for comparison (don't modify original)
  const dateCopy = new Date(date);
  dateCopy.setHours(0, 0, 0, 0);
  
  return dateCopy >= jan1_2026 && dateCopy <= today;
}

// Check if date is within a date range
function isDateInRange(date, fromDate, toDate) {
  if (!date) return false;
  if (!fromDate && !toDate) return true; // No filter
  
  const dateCopy = new Date(date);
  dateCopy.setHours(0, 0, 0, 0);
  
  if (fromDate) {
    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    if (dateCopy < from) return false;
  }
  
  if (toDate) {
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);
    if (dateCopy > to) return false;
  }
  
  return true;
}

// Parse date from query parameter (YYYY-MM-DD)
function parseDateFromQuery(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
  const day = parseInt(parts[2], 10);
  const date = new Date(year, month, day);
  if (isNaN(date.getTime())) return null;
  return date;
}

// Get numeric value from cell
function getNumericValue(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== '') {
      const num = parseFloat(value.toString().replace(/,/g, ''));
      if (!isNaN(num)) {
        return num;
      }
    }
  }
  return 0;
}

// Fetch data from published Google Sheet (no authentication needed)
async function fetchLeaderboardData(fromDate = null, toDate = null) {
  try {
    console.log('Fetching data from:', PUBLISHED_SHEET_URL);
    if (fromDate) console.log('Filter from date:', fromDate);
    if (toDate) console.log('Filter to date:', toDate);
    
    // Fetch CSV data from published sheet
    const response = await axios.get(PUBLISHED_SHEET_URL, {
      responseType: 'text',
      timeout: 10000, // 10 second timeout
    });

    console.log('CSV data received, length:', response.data.length);

    // Parse CSV data
    const records = parse(response.data, {
      columns: true, // Use first line as column names
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true, // Allow inconsistent column counts
    });

    console.log('Parsed records count:', records.length);
    if (records.length > 0) {
      console.log('First record keys:', Object.keys(records[0]));
    }

    // Filter out rows that are completely empty or only contain headers/metadata
    let filteredRecords = records.filter(row => {
      const values = Object.values(row);
      // Check if row has at least one non-empty value
      return values.some(val => val && val.toString().trim() !== '');
    });

    // Filter by Disburse Date - from January 1, 2026 onwards
    const disburseDateKeys = ['Disburse Date', 'Disburse date', 'disburse date', 'DISBURSE DATE', 
                               'Disburse Date ', 'DisburseDate', 'Disburse_Date'];
    // const dateKeys = ['Date', 'date', 'DATE', 'Date ', 'DATE ']; // For display
    const filteredData = [];
    
    for (const row of filteredRecords) {
      // Get Disburse Date from various possible column names
      let disburseDateValue = null;
      let dateKeyFound = null;
      
      // Try all possible column name variations
      for (const key of disburseDateKeys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
          disburseDateValue = parseDate(row[key]);
          if (disburseDateValue) {
            dateKeyFound = key;
            break;
          }
        }
      }
      
      // If no date found, try all column keys to find date-like values
      if (!disburseDateValue) {
        for (const key of Object.keys(row)) {
          if (key && (key.toLowerCase().includes('date') || key.toLowerCase().includes('disburse'))) {
            const testDate = parseDate(row[key]);
            if (testDate) {
              disburseDateValue = testDate;
              dateKeyFound = key;
              break;
            }
          }
        }
      }
      
      // Skip if no valid Disburse Date
      if (!disburseDateValue) continue;
      
      // Skip header rows - check if the value itself looks like a header
      if (disburseDateValue && !isNaN(disburseDateValue.getTime())) {
        // Apply date filter
        if (fromDate || toDate) {
          // Use custom date range if provided
          if (isDateInRange(disburseDateValue, fromDate, toDate)) {
            filteredData.push(row);
          }
        } else {
          // Default: Only include from January 1, 2026 to today
          if (isFromJanuary12026ToToday(disburseDateValue)) {
            filteredData.push(row);
          }
        }
      }
    }

    // Sort by Disburse Date (ascending)
    filteredData.sort((a, b) => {
      let dateA = null, dateB = null;
      for (const key of disburseDateKeys) {
        if (a[key]) dateA = parseDate(a[key]);
        if (b[key]) dateB = parseDate(b[key]);
      }
      if (!dateA || !dateB) return 0;
      return dateA - dateB;
    });

    console.log('Records from Jan 1, 2026 to today (by Disburse Date):', filteredData.length);
    console.log('Total records parsed:', records.length);
    console.log('Records after basic filter:', filteredRecords.length);
    
    // Log ALL column names from first record to see actual structure
    if (records.length > 0) {
      console.log('ALL COLUMN NAMES FROM FIRST RECORD:', Object.keys(records[0]));
      console.log('First record sample:', JSON.stringify(records[0], null, 2).substring(0, 500));
    }
    
    // Log sample data for debugging
    if (filteredData.length > 0) {
      console.log('Filtered data count:', filteredData.length);
      // Log first 5 dates
      filteredData.slice(0, 5).forEach((row, idx) => {
        for (const key of Object.keys(row)) {
          if (key && (key.toLowerCase().includes('date') || key.toLowerCase().includes('disburse'))) {
            console.log(`Row ${idx + 1} - ${key}: ${row[key]}`);
          }
        }
      });
    } else {
      console.log('WARNING: No filtered data! Checking first few records...');
      filteredRecords.slice(0, 3).forEach((row, idx) => {
        console.log(`Record ${idx + 1} keys:`, Object.keys(row));
        for (const key of Object.keys(row)) {
          if (key && (key.toLowerCase().includes('date') || key.toLowerCase().includes('disburse'))) {
            const testDate = parseDate(row[key]);
            console.log(`  ${key}: ${row[key]} -> parsed: ${testDate}`);
          }
        }
      });
    }

    // Column names to use - try multiple variations
    const repeatNewKeys = ['Repeat/New', 'Repeat/New ', 'repeat/new', 'REPEAT/NEW', 'Repeat New', 'repeat new', 'Repeat/New', 'Repeat New'];
    const loanAmountKeys = ['Loan Amount', 'Loan amount', 'loan amount', 'LOAN AMOUNT', 'Loan Amount ', 'LoanAmount'];
    const processingFeeKeys = ['Processing Fee', 'Processing fee', 'processing fee', 'PROCESSING FEE', 'Processing Fee ', 'ProcessingFee'];
    const netDisbursalKeys = ['Net Disbursal Amount', 'Net Disbursal amount', 'net disbursal amount', 'NET DISBURSAL AMOUNT', 'Net Disbursal Amount ', 'Net DisbursalAmount', 'NetDisbursalAmount', 
                               'Net Disbused Amount', 'Net Disbused amount', 'net disbused amount', 'NET DISBUSED AMOUNT', 'Net Disbused Amount ', 'Net DisbusedAmount'];
    const loanRepayKeys = ['Loan Repay Amount', 'Loan Repay amount', 'loan repay amount', 'LOAN REPAY AMOUNT', 'Loan Repay Amount ', 'Loan RepayAmount', 'LoanRepayAmount'];

    // Group by date for daily aggregation
    const dailyGroups = {};
    
    for (const row of filteredData) {
      // Get Disburse Date
      let disburseDate = null;
      for (const key of disburseDateKeys) {
        if (row[key]) {
          disburseDate = parseDate(row[key]);
          break;
        }
      }
      
      if (!disburseDate) continue;
      
      // Format date as key (YYYY-MM-DD) for grouping
      const dateKey = `${disburseDate.getFullYear()}-${String(disburseDate.getMonth() + 1).padStart(2, '0')}-${String(disburseDate.getDate()).padStart(2, '0')}`;
      
      if (!dailyGroups[dateKey]) {
        dailyGroups[dateKey] = {
          date: disburseDate,
          rows: []
        };
      }
      dailyGroups[dateKey].rows.push(row);
    }
    
    // Convert to array and sort by date
    const dailyData = Object.values(dailyGroups).sort((a, b) => a.date - b.date);
    
    console.log('Daily groups count:', dailyData.length);

    // Calculate daily totals (not accumulated) and grand total
    const dailyDataArray = [];
    let grandTotalNew = 0;
    let grandTotalRepeat = 0;
    let grandTotalCases = 0;
    let grandTotalLoanAmount = 0;
    let grandTotalPFAmount = 0;
    let grandTotalDisbursalAmount = 0;
    let grandTotalRepayAmount = 0;
    
    // Helper function to get Repeat/New value
    function getRepeatNewValue(row, keys) {
      for (const key of keys) {
        const value = row[key];
        if (value !== undefined && value !== null && value !== '') {
          const str = value.toString().trim().toLowerCase();
          return str;
        }
      }
      return '';
    }

    for (const dayGroup of dailyData) {
      // Count and sum values for this day only
      let dayNew = 0;
      let dayRepeat = 0;
      let dayLoanAmount = 0;
      let dayPFAmount = 0;
      let dayDisbursalAmount = 0;
      let dayRepayAmount = 0;
      
      for (const row of dayGroup.rows) {
        // Count New vs Repeat
        const repeatNewValue = getRepeatNewValue(row, repeatNewKeys);
        if (repeatNewValue === 'new') {
          dayNew++;
        } else if (repeatNewValue === 'repeat') {
          dayRepeat++;
        }
        
        // Sum amounts
        const loanAmt = getNumericValue(row, loanAmountKeys);
        const pfAmt = getNumericValue(row, processingFeeKeys);
        const netDisbAmt = getNumericValue(row, netDisbursalKeys);
        const repayAmt = getNumericValue(row, loanRepayKeys);
        
        dayLoanAmount += loanAmt;
        dayPFAmount += pfAmt;
        dayDisbursalAmount += netDisbAmt;
        dayRepayAmount += repayAmt;
      }
      
      const dayTotalCases = dayNew + dayRepeat;
      
      // Format date as DD-MM-YYYY (day-month-year, matching Excel DD/MM/YYYY format)
      const displayDate = `${String(dayGroup.date.getDate()).padStart(2, '0')}-${String(dayGroup.date.getMonth() + 1).padStart(2, '0')}-${dayGroup.date.getFullYear()}`;
      
      // Add to grand totals (for final total calculation)
      grandTotalNew += dayNew;
      grandTotalRepeat += dayRepeat;
      grandTotalCases += dayTotalCases;
      grandTotalLoanAmount += dayLoanAmount;
      grandTotalPFAmount += dayPFAmount;
      grandTotalDisbursalAmount += dayDisbursalAmount;
      grandTotalRepayAmount += dayRepayAmount;

      // Create daily row (not accumulated - shows only this day's data)
      const dailyRow = {
        'Date': displayDate,
        'New': dayNew,
        'Repeat': dayRepeat,
        'Total Cases': dayTotalCases,
        'Loan Amount': dayLoanAmount,
        'PF Amount': dayPFAmount,
        'Disbursal Amount': dayDisbursalAmount,
        'Repay Amount': dayRepayAmount,
        '_isGrandTotal': false
      };

      dailyDataArray.push(dailyRow);
    }
    
    // Add grand total row at the end
    const grandTotalRow = {
      'Date': 'GRAND TOTAL',
      'New': grandTotalNew,
      'Repeat': grandTotalRepeat,
      'Total Cases': grandTotalCases,
      'Loan Amount': grandTotalLoanAmount,
      'PF Amount': grandTotalPFAmount,
      'Disbursal Amount': grandTotalDisbursalAmount,
      'Repay Amount': grandTotalRepayAmount,
      '_isGrandTotal': true
    };
    
    dailyDataArray.push(grandTotalRow);

    console.log('Daily data count:', dailyDataArray.length - 1); // -1 to exclude grand total
    return dailyDataArray;
  } catch (error) {
    console.error('Error fetching data from Google Sheets:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Fetch executive report data
async function fetchExecutiveReportData() {
  try {
    console.log('Fetching executive report data from:', PUBLISHED_SHEET_URL);
    
    // Fetch CSV data from published sheet
    const response = await axios.get(PUBLISHED_SHEET_URL, {
      responseType: 'text',
      timeout: 10000,
    });

    // Parse CSV data
    const records = parse(response.data, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    // Filter records with valid data
    let filteredRecords = records.filter(row => {
      const values = Object.values(row);
      return values.some(val => val && val.toString().trim() !== '');
    });

    // Filter by Disburse Date - from January 1, 2026 to today
    const disburseDateKeys = ['Disburse Date', 'Disburse date', 'disburse date', 'DISBURSE DATE', 
                               'Disburse Date ', 'DisburseDate', 'Disburse_Date'];
    const filteredData = [];
    
    for (const row of filteredRecords) {
      let disburseDateValue = null;
      
      // Try all possible column name variations
      for (const key of disburseDateKeys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
          disburseDateValue = parseDate(row[key]);
          if (disburseDateValue) break;
        }
      }
      
      // If no date found, try all column keys
      if (!disburseDateValue) {
        for (const key of Object.keys(row)) {
          if (key && (key.toLowerCase().includes('date') || key.toLowerCase().includes('disburse'))) {
            const testDate = parseDate(row[key]);
            if (testDate) {
              disburseDateValue = testDate;
              break;
            }
          }
        }
      }
      
      if (!disburseDateValue) continue;
      
      if (disburseDateValue && !isNaN(disburseDateValue.getTime())) {
        if (isFromJanuary12026ToToday(disburseDateValue)) {
          filteredData.push(row);
        }
      }
    }

    // Column names
    const sanctionedByKeys = ['Sanctioned By', 'Sanctioned by', 'sanctioned by', 'SANCTIONED BY', 
                              'Sanctioned By ', 'SanctionedBy', 'Sanctioned_By'];
    const loanAmountKeys = ['Loan Amount', 'Loan amount', 'loan amount', 'LOAN AMOUNT', 'Loan Amount ', 'LoanAmount'];

    // Group by Executive Name
    const executiveGroups = {};
    
    for (const row of filteredData) {
      // Get Executive Name (Sanctioned By)
      let executiveName = null;
      for (const key of sanctionedByKeys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
          executiveName = row[key].toString().trim();
          if (executiveName) break;
        }
      }
      
      // Try all keys to find executive name
      if (!executiveName) {
        for (const key of Object.keys(row)) {
          if (key && (key.toLowerCase().includes('sanctioned') || key.toLowerCase().includes('executive') || key.toLowerCase().includes('by'))) {
            const value = row[key];
            if (value !== undefined && value !== null && value !== '') {
              executiveName = value.toString().trim();
              if (executiveName && !executiveName.toLowerCase().includes('sanctioned by')) {
                break;
              }
            }
          }
        }
      }
      
      if (!executiveName || executiveName.toLowerCase().includes('sanctioned')) continue;
      
      // Group by executive name
      if (!executiveGroups[executiveName]) {
        executiveGroups[executiveName] = {
          name: executiveName,
          cases: 0,
          loanAmount: 0
        };
      }
      
      // Count cases and sum loan amount
      executiveGroups[executiveName].cases++;
      executiveGroups[executiveName].loanAmount += getNumericValue(row, loanAmountKeys);
    }

    // Convert to array and sort by loan amount (descending)
    const executiveData = Object.values(executiveGroups).sort((a, b) => b.loanAmount - a.loanAmount);
    
    // Calculate grand total
    let grandTotalCases = 0;
    let grandTotalLoanAmount = 0;
    
    executiveData.forEach(exec => {
      grandTotalCases += exec.cases;
      grandTotalLoanAmount += exec.loanAmount;
    });

    // Format data for response
    const result = executiveData.map((exec, index) => ({
      'Sr': index + 1,
      'Executive Name': exec.name,
      'Number of Cases': exec.cases,
      'Loan Amount': exec.loanAmount,
      '_isGrandTotal': false
    }));

    // Add grand total
    result.push({
      'Sr': '',
      'Executive Name': 'Grand Total',
      'Number of Cases': grandTotalCases,
      'Loan Amount': grandTotalLoanAmount,
      '_isGrandTotal': true
    });

    console.log('Executive report data count:', result.length - 1);
    return result;
  } catch (error) {
    console.error('Error fetching executive report data:', error.message);
    throw error;
  }
}

// API endpoint to get leaderboard data
app.get('/api/leaderboard', async (req, res) => {
  try {
    const data = await fetchLeaderboardData();
    res.json(data);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch leaderboard data',
      message: error.message,
      url: PUBLISHED_SHEET_URL
    });
  }
});

// Check if date is today
function isToday(date) {
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateCopy = new Date(date);
  dateCopy.setHours(0, 0, 0, 0);
  return dateCopy.getTime() === today.getTime();
}

// Fetch today's sanction report data
async function fetchTodaySanctionReportData() {
  try {
    console.log('Fetching today sanction report data from:', PUBLISHED_SHEET_URL);
    
    // Fetch CSV data from published sheet
    const response = await axios.get(PUBLISHED_SHEET_URL, {
      responseType: 'text',
      timeout: 10000,
    });

    // Parse CSV data
    const records = parse(response.data, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    // Filter records with valid data
    let filteredRecords = records.filter(row => {
      const values = Object.values(row);
      return values.some(val => val && val.toString().trim() !== '');
    });

    // Filter by Disburse Date - only today
    const disburseDateKeys = ['Disburse Date', 'Disburse date', 'disburse date', 'DISBURSE DATE', 
                               'Disburse Date ', 'DisburseDate', 'Disburse_Date'];
    const filteredData = [];
    
    for (const row of filteredRecords) {
      let disburseDateValue = null;
      
      // Try all possible column name variations
      for (const key of disburseDateKeys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
          disburseDateValue = parseDate(row[key]);
          if (disburseDateValue) break;
        }
      }
      
      // If no date found, try all column keys
      if (!disburseDateValue) {
        for (const key of Object.keys(row)) {
          if (key && (key.toLowerCase().includes('date') || key.toLowerCase().includes('disburse'))) {
            const testDate = parseDate(row[key]);
            if (testDate) {
              disburseDateValue = testDate;
              break;
            }
          }
        }
      }
      
      if (!disburseDateValue) continue;
      
      if (disburseDateValue && !isNaN(disburseDateValue.getTime())) {
        if (isToday(disburseDateValue)) {
          filteredData.push(row);
        }
      }
    }

    // Column names
    const sanctionedByKeys = ['Sanctioned By', 'Sanctioned by', 'sanctioned by', 'SANCTIONED BY', 
                              'Sanctioned By ', 'SanctionedBy', 'Sanctioned_By'];
    const loanAmountKeys = ['Loan Amount', 'Loan amount', 'loan amount', 'LOAN AMOUNT', 'Loan Amount ', 'LoanAmount'];
    const repeatNewKeys = ['Repeat/New', 'Repeat/New ', 'repeat/new', 'REPEAT/NEW', 'Repeat New', 'repeat new', 'Repeat/New', 'Repeat New'];

    // Helper function to get Repeat/New value
    function getRepeatNewValue(row, keys) {
      for (const key of keys) {
        const value = row[key];
        if (value !== undefined && value !== null && value !== '') {
          const str = value.toString().trim().toLowerCase();
          return str;
        }
      }
      return '';
    }

    // Separate New and Repeat cases
    const newCasesGroups = {};
    const repeatCasesGroups = {};
    
    for (const row of filteredData) {
      // Get Executive Name (Sanctioned By)
      let executiveName = null;
      for (const key of sanctionedByKeys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
          executiveName = row[key].toString().trim();
          if (executiveName) break;
        }
      }
      
      if (!executiveName || executiveName.toLowerCase().includes('sanctioned')) continue;
      
      // Get Repeat/New value
      const repeatNewValue = getRepeatNewValue(row, repeatNewKeys);
      const isNew = repeatNewValue === 'new';
      const isRepeat = repeatNewValue === 'repeat';
      
      if (!isNew && !isRepeat) continue;
      
      // Select the appropriate group
      const targetGroup = isNew ? newCasesGroups : repeatCasesGroups;
      
      // Group by executive name
      if (!targetGroup[executiveName]) {
        targetGroup[executiveName] = {
          name: executiveName,
          cases: 0,
          loanAmount: 0
        };
      }
      
      // Count cases and sum loan amount
      targetGroup[executiveName].cases++;
      targetGroup[executiveName].loanAmount += getNumericValue(row, loanAmountKeys);
    }

    // Convert to arrays and sort by loan amount (descending)
    const newCasesData = Object.values(newCasesGroups).sort((a, b) => b.loanAmount - a.loanAmount);
    const repeatCasesData = Object.values(repeatCasesGroups).sort((a, b) => b.loanAmount - a.loanAmount);
    
    // Calculate grand totals for New cases
    let newGrandTotalCases = 0;
    let newGrandTotalLoanAmount = 0;
    newCasesData.forEach(exec => {
      newGrandTotalCases += exec.cases;
      newGrandTotalLoanAmount += exec.loanAmount;
    });

    // Calculate grand totals for Repeat cases
    let repeatGrandTotalCases = 0;
    let repeatGrandTotalLoanAmount = 0;
    repeatCasesData.forEach(exec => {
      repeatGrandTotalCases += exec.cases;
      repeatGrandTotalLoanAmount += exec.loanAmount;
    });

    // Format data for response
    const newCasesResult = newCasesData.map((exec, index) => ({
      'Sr': index + 1,
      'Executive Name': exec.name,
      'Number of Cases': exec.cases,
      'Loan Amount': exec.loanAmount,
      '_isGrandTotal': false
    }));

    // Add grand total for New cases
    newCasesResult.push({
      'Sr': '',
      'Executive Name': 'Grand Total',
      'Number of Cases': newGrandTotalCases,
      'Loan Amount': newGrandTotalLoanAmount,
      '_isGrandTotal': true
    });

    const repeatCasesResult = repeatCasesData.map((exec, index) => ({
      'Sr': index + 1,
      'Executive Name': exec.name,
      'Number of Cases': exec.cases,
      'Loan Amount': exec.loanAmount,
      '_isGrandTotal': false
    }));

    // Add grand total for Repeat cases
    repeatCasesResult.push({
      'Sr': '',
      'Executive Name': 'Grand Total',
      'Number of Cases': repeatGrandTotalCases,
      'Loan Amount': repeatGrandTotalLoanAmount,
      '_isGrandTotal': true
    });

    console.log('Today sanction report - New cases count:', newCasesResult.length - 1);
    console.log('Today sanction report - Repeat cases count:', repeatCasesResult.length - 1);
    
    return {
      new: newCasesResult,
      repeat: repeatCasesResult
    };
  } catch (error) {
    console.error('Error fetching today sanction report data:', error.message);
    throw error;
  }
}

// Fetch PF wise loan disbursal report data (today only)
async function fetchPFWiseReportData() {
  try {
    console.log('Fetching PF wise report data from:', PUBLISHED_SHEET_URL);
    
    // Fetch CSV data from published sheet
    const response = await axios.get(PUBLISHED_SHEET_URL, {
      responseType: 'text',
      timeout: 10000,
    });

    // Parse CSV data
    const records = parse(response.data, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    // Filter records with valid data
    let filteredRecords = records.filter(row => {
      const values = Object.values(row);
      return values.some(val => val && val.toString().trim() !== '');
    });

    // Filter by Disburse Date - only today
    const disburseDateKeys = ['Disburse Date', 'Disburse date', 'disburse date', 'DISBURSE DATE', 
                               'Disburse Date ', 'DisburseDate', 'Disburse_Date'];
    const filteredData = [];
    
    for (const row of filteredRecords) {
      let disburseDateValue = null;
      
      // Try all possible column name variations
      for (const key of disburseDateKeys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
          disburseDateValue = parseDate(row[key]);
          if (disburseDateValue) break;
        }
      }
      
      // If no date found, try all column keys
      if (!disburseDateValue) {
        for (const key of Object.keys(row)) {
          if (key && (key.toLowerCase().includes('date') || key.toLowerCase().includes('disburse'))) {
            const testDate = parseDate(row[key]);
            if (testDate) {
              disburseDateValue = testDate;
              break;
            }
          }
        }
      }
      
      if (!disburseDateValue) continue;
      
      if (disburseDateValue && !isNaN(disburseDateValue.getTime())) {
        if (isToday(disburseDateValue)) {
          filteredData.push(row);
        }
      }
    }

    // Column names
    const pfPercentKeys = ['PF %', 'PF%', 'pf %', 'PF % ', 'PF_Percent', 'PF Percent', 'Processing Fee %', 'Processing Fee%'];
    const loanAmountKeys = ['Loan Amount', 'Loan amount', 'loan amount', 'LOAN AMOUNT', 'Loan Amount ', 'LoanAmount'];
    const netDisbursalKeys = ['Net Disbursal Amount', 'Net Disbursal amount', 'net disbursal amount', 'NET DISBURSAL AMOUNT', 'Net Disbursal Amount ', 'Net DisbursalAmount', 'NetDisbursalAmount', 
                               'Net Disbused Amount', 'Net Disbused amount', 'net disbused amount', 'NET DISBUSED AMOUNT', 'Net Disbused Amount ', 'Net DisbusedAmount'];
    const loanRepayKeys = ['Loan Repay Amount', 'Loan Repay amount', 'loan repay amount', 'LOAN REPAY AMOUNT', 'Loan Repay Amount ', 'Loan RepayAmount', 'LoanRepayAmount'];

    // Helper function to get PF % value
    function getPFPercentValue(row, keys) {
      for (const key of keys) {
        const value = row[key];
        if (value !== undefined && value !== null && value !== '') {
          const str = value.toString().trim();
          // Try to extract percentage number
          const percentMatch = str.match(/(\d+(?:\.\d+)?)\s*%?/);
          if (percentMatch) {
            return percentMatch[1];
          }
          // If it's already a number, return it
          const num = parseFloat(str);
          if (!isNaN(num)) {
            return num.toString();
          }
        }
      }
      return null;
    }

    // Group by PF %
    const pfGroups = {};
    
    for (const row of filteredData) {
      // Get PF %
      const pfPercent = getPFPercentValue(row, pfPercentKeys);
      
      if (!pfPercent) continue;
      
      // Group by PF %
      if (!pfGroups[pfPercent]) {
        pfGroups[pfPercent] = {
          pfPercent: pfPercent,
          cases: 0,
          loanAmount: 0,
          disbursalAmount: 0,
          repayAmount: 0
        };
      }
      
      // Count cases and sum amounts
      pfGroups[pfPercent].cases++;
      pfGroups[pfPercent].loanAmount += getNumericValue(row, loanAmountKeys);
      pfGroups[pfPercent].disbursalAmount += getNumericValue(row, netDisbursalKeys);
      pfGroups[pfPercent].repayAmount += getNumericValue(row, loanRepayKeys);
    }

    // Convert to array and sort by PF % (ascending)
    const pfData = Object.values(pfGroups).sort((a, b) => parseFloat(a.pfPercent) - parseFloat(b.pfPercent));
    
    // Calculate grand total
    let grandTotalCases = 0;
    let grandTotalLoanAmount = 0;
    let grandTotalDisbursalAmount = 0;
    let grandTotalRepayAmount = 0;
    
    pfData.forEach(pf => {
      grandTotalCases += pf.cases;
      grandTotalLoanAmount += pf.loanAmount;
      grandTotalDisbursalAmount += pf.disbursalAmount;
      grandTotalRepayAmount += pf.repayAmount;
    });

    // Get today's date for display
    const reportDate = new Date();
    const displayDate = `${String(reportDate.getDate()).padStart(2, '0')}-${String(reportDate.getMonth() + 1).padStart(2, '0')}-${reportDate.getFullYear()}`;

    // Format data for response
    const result = pfData.map(pf => ({
      'DATE': displayDate,
      'PF %': `${pf.pfPercent}%`,
      'Total cases': pf.cases,
      'Loan Amount': pf.loanAmount,
      'DISBURSE Amount': pf.disbursalAmount,
      'Repay Amount': pf.repayAmount,
      '_isGrandTotal': false
    }));

    // Add grand total
    result.push({
      'DATE': '',
      'PF %': 'Grand Total',
      'Total cases': grandTotalCases,
      'Loan Amount': grandTotalLoanAmount,
      'DISBURSE Amount': grandTotalDisbursalAmount,
      'Repay Amount': grandTotalRepayAmount,
      '_isGrandTotal': true
    });

    console.log('PF wise report data count:', result.length - 1);
    return result;
  } catch (error) {
    console.error('Error fetching PF wise report data:', error.message);
    throw error;
  }
}

// ==================== SALARY4SURE REPORTS ====================
// Generic function to fetch and filter data from Salary4Sure sheet
async function fetchSalary4SureData(fromDate = null, toDate = null) {
  try {
    console.log('Fetching Salary4Sure data from:', SALARY4SURE_SHEET_URL);
    if (fromDate) console.log('Filter from date:', fromDate);
    if (toDate) console.log('Filter to date:', toDate);
    
    const response = await axios.get(SALARY4SURE_SHEET_URL, {
      responseType: 'text',
      timeout: 10000,
    });

    const records = parse(response.data, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    let filteredRecords = records.filter(row => {
      const values = Object.values(row);
      return values.some(val => val && val.toString().trim() !== '');
    });

    const disburseDateKeys = ['Disburse Date', 'Disburse date', 'disburse date', 'DISBURSE DATE', 
                               'Disburse Date ', 'DisburseDate', 'Disburse_Date'];
    const filteredData = [];
    
    for (const row of filteredRecords) {
      let disburseDateValue = null;
      
      for (const key of disburseDateKeys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
          disburseDateValue = parseDate(row[key]);
          if (disburseDateValue) break;
        }
      }
      
      if (!disburseDateValue) {
        for (const key of Object.keys(row)) {
          if (key && (key.toLowerCase().includes('date') || key.toLowerCase().includes('disburse'))) {
            const testDate = parseDate(row[key]);
            if (testDate) {
              disburseDateValue = testDate;
              break;
            }
          }
        }
      }
      
      if (!disburseDateValue) continue;
      
      if (disburseDateValue && !isNaN(disburseDateValue.getTime())) {
        if (fromDate || toDate) {
          if (isDateInRange(disburseDateValue, fromDate, toDate)) {
            filteredData.push(row);
          }
        } else {
          if (isFromJanuary12026ToToday(disburseDateValue)) {
            filteredData.push(row);
          }
        }
      }
    }

    return filteredData;
  } catch (error) {
    console.error('Error fetching Salary4Sure data:', error.message);
    throw error;
  }
}

// Salary4Sure Daily Performance Report
async function fetchSalary4SureLeaderboardData(fromDate = null, toDate = null) {
  try {
    const filteredData = await fetchSalary4SureData(fromDate, toDate);

    // Salary4Sure uses "Case Type" column with "FRESH" and "REPEAT" values
    const caseTypeKeys = ['Case Type', 'Case type', 'case type', 'CASE TYPE', 'Case Type ', 'CaseType', 'Case_Type'];
    const loanAmountKeys = ['Loan Amount', 'Loan amount', 'loan amount', 'LOAN AMOUNT', 'Loan Amount ', 'LoanAmount'];
    const processingFeeKeys = ['Processing Fee', 'Processing fee', 'processing fee', 'PROCESSING FEE', 'Processing Fee ', 'ProcessingFee'];
    // Salary4Sure uses "Net disburse Amt" and "Repayment Amt"
    const netDisbursalKeys = ['Net disburse Amt', 'Net disburse amt', 'net disburse amt', 'NET DISBURSE AMT', 'Net disburse Amt ', 'Net Disburse Amt', 'NetDisburseAmt',
                               'Net Disbursal Amount', 'Net Disbursal amount', 'net disbursal amount', 'NET DISBURSAL AMOUNT', 'Net Disbursal Amount ', 'Net DisbursalAmount', 'NetDisbursalAmount', 
                               'Net Disbused Amount', 'Net Disbused amount', 'net disbused amount', 'NET DISBUSED AMOUNT', 'Net Disbused Amount ', 'Net DisbusedAmount'];
    const loanRepayKeys = ['Repayment Amt', 'Repayment amt', 'repayment amt', 'REPAYMENT AMT', 'Repayment Amt ', 'RepaymentAmt',
                           'Loan Repay Amount', 'Loan Repay amount', 'loan repay amount', 'LOAN REPAY AMOUNT', 'Loan Repay Amount ', 'Loan RepayAmount', 'LoanRepayAmount'];
    const disburseDateKeys = ['Disburse Date', 'Disburse date', 'disburse date', 'DISBURSE DATE', 'Disburse Date ', 'DisburseDate', 'Disburse_Date'];

    function getCaseTypeValue(row, keys) {
      for (const key of keys) {
        const value = row[key];
        if (value !== undefined && value !== null && value !== '') {
          const str = value.toString().trim().toUpperCase();
          return str;
        }
      }
      return '';
    }

    const dailyGroups = {};
    
    for (const row of filteredData) {
      let disburseDate = null;
      for (const key of disburseDateKeys) {
        if (row[key]) {
          disburseDate = parseDate(row[key]);
          break;
        }
      }
      
      if (!disburseDate) continue;
      
      const dateKey = `${disburseDate.getFullYear()}-${String(disburseDate.getMonth() + 1).padStart(2, '0')}-${String(disburseDate.getDate()).padStart(2, '0')}`;
      
      if (!dailyGroups[dateKey]) {
        dailyGroups[dateKey] = {
          date: disburseDate,
          rows: []
        };
      }
      dailyGroups[dateKey].rows.push(row);
    }
    
    const dailyData = Object.values(dailyGroups).sort((a, b) => a.date - b.date);

    const dailyDataArray = [];
    let grandTotalNew = 0;
    let grandTotalRepeat = 0;
    let grandTotalCases = 0;
    let grandTotalLoanAmount = 0;
    let grandTotalPFAmount = 0;
    let grandTotalDisbursalAmount = 0;
    let grandTotalRepayAmount = 0;

    for (const dayGroup of dailyData) {
      let dayNew = 0;
      let dayRepeat = 0;
      let dayLoanAmount = 0;
      let dayPFAmount = 0;
      let dayDisbursalAmount = 0;
      let dayRepayAmount = 0;
      
      for (const row of dayGroup.rows) {
        const caseTypeValue = getCaseTypeValue(row, caseTypeKeys);
        if (caseTypeValue === 'FRESH') {
          dayNew++;
        } else if (caseTypeValue === 'REPEAT') {
          dayRepeat++;
        }
        
        const loanAmt = getNumericValue(row, loanAmountKeys);
        const pfAmt = getNumericValue(row, processingFeeKeys);
        const netDisbAmt = getNumericValue(row, netDisbursalKeys);
        const repayAmt = getNumericValue(row, loanRepayKeys);
        
        dayLoanAmount += loanAmt;
        dayPFAmount += pfAmt;
        dayDisbursalAmount += netDisbAmt;
        dayRepayAmount += repayAmt;
      }
      
      const dayTotalCases = dayNew + dayRepeat;
      const displayDate = `${String(dayGroup.date.getDate()).padStart(2, '0')}-${String(dayGroup.date.getMonth() + 1).padStart(2, '0')}-${dayGroup.date.getFullYear()}`;
      
      grandTotalNew += dayNew;
      grandTotalRepeat += dayRepeat;
      grandTotalCases += dayTotalCases;
      grandTotalLoanAmount += dayLoanAmount;
      grandTotalPFAmount += dayPFAmount;
      grandTotalDisbursalAmount += dayDisbursalAmount;
      grandTotalRepayAmount += dayRepayAmount;

      const dailyRow = {
        'Date': displayDate,
        'New': dayNew,
        'Repeat': dayRepeat,
        'Total Cases': dayTotalCases,
        'Loan Amount': dayLoanAmount,
        'PF Amount': dayPFAmount,
        'Disbursal Amount': dayDisbursalAmount,
        'Repay Amount': dayRepayAmount,
        '_isGrandTotal': false
      };

      dailyDataArray.push(dailyRow);
    }
    
    const grandTotalRow = {
      'Date': 'GRAND TOTAL',
      'New': grandTotalNew,
      'Repeat': grandTotalRepeat,
      'Total Cases': grandTotalCases,
      'Loan Amount': grandTotalLoanAmount,
      'PF Amount': grandTotalPFAmount,
      'Disbursal Amount': grandTotalDisbursalAmount,
      'Repay Amount': grandTotalRepayAmount,
      '_isGrandTotal': true
    };
    
    dailyDataArray.push(grandTotalRow);

    return dailyDataArray;
  } catch (error) {
    console.error('Error fetching Salary4Sure leaderboard data:', error.message);
    throw error;
  }
}

// Salary4Sure Executive Report
async function fetchSalary4SureExecutiveReportData(fromDate = null, toDate = null) {
  try {
    const filteredData = await fetchSalary4SureData(fromDate, toDate);

    const sanctionedByKeys = ['Sanctioned By', 'Sanctioned by', 'sanctioned by', 'SANCTIONED BY', 
                              'Sanctioned By ', 'SanctionedBy', 'Sanctioned_By'];
    const loanAmountKeys = ['Loan Amount', 'Loan amount', 'loan amount', 'LOAN AMOUNT', 'Loan Amount ', 'LoanAmount'];

    const executiveGroups = {};
    
    for (const row of filteredData) {
      let executiveName = null;
      for (const key of sanctionedByKeys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
          executiveName = row[key].toString().trim();
          if (executiveName) break;
        }
      }
      
      if (!executiveName || executiveName.toLowerCase().includes('sanctioned')) continue;
      
      if (!executiveGroups[executiveName]) {
        executiveGroups[executiveName] = {
          name: executiveName,
          cases: 0,
          loanAmount: 0
        };
      }
      
      executiveGroups[executiveName].cases++;
      executiveGroups[executiveName].loanAmount += getNumericValue(row, loanAmountKeys);
    }

    const executiveData = Object.values(executiveGroups).sort((a, b) => b.loanAmount - a.loanAmount);
    
    let grandTotalCases = 0;
    let grandTotalLoanAmount = 0;
    
    executiveData.forEach(exec => {
      grandTotalCases += exec.cases;
      grandTotalLoanAmount += exec.loanAmount;
    });

    const result = executiveData.map((exec, index) => ({
      'Sr': index + 1,
      'Executive Name': exec.name,
      'Number of Cases': exec.cases,
      'Loan Amount': exec.loanAmount,
      '_isGrandTotal': false
    }));

    result.push({
      'Sr': '',
      'Executive Name': 'Grand Total',
      'Number of Cases': grandTotalCases,
      'Loan Amount': grandTotalLoanAmount,
      '_isGrandTotal': true
    });

    return result;
  } catch (error) {
    console.error('Error fetching Salary4Sure executive report data:', error.message);
    throw error;
  }
}

// Salary4Sure Today Sanction Report
async function fetchSalary4SureTodaySanctionReportData() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const filteredData = await fetchSalary4SureData(today, tomorrow);

    const sanctionedByKeys = ['Sanctioned By', 'Sanctioned by', 'sanctioned by', 'SANCTIONED BY', 
                              'Sanctioned By ', 'SanctionedBy', 'Sanctioned_By'];
    const loanAmountKeys = ['Loan Amount', 'Loan amount', 'loan amount', 'LOAN AMOUNT', 'Loan Amount ', 'LoanAmount'];
    // Salary4Sure uses "Case Type" column with "FRESH" and "REPEAT" values
    const caseTypeKeys = ['Case Type', 'Case type', 'case type', 'CASE TYPE', 'Case Type ', 'CaseType', 'Case_Type'];

    function getCaseTypeValue(row, keys) {
      for (const key of keys) {
        const value = row[key];
        if (value !== undefined && value !== null && value !== '') {
          const str = value.toString().trim().toUpperCase();
          return str;
        }
      }
      return '';
    }

    const newCasesGroups = {};
    const repeatCasesGroups = {};
    
    for (const row of filteredData) {
      let executiveName = null;
      for (const key of sanctionedByKeys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
          executiveName = row[key].toString().trim();
          if (executiveName) break;
        }
      }
      
      if (!executiveName || executiveName.toLowerCase().includes('sanctioned')) continue;
      
      const caseTypeValue = getCaseTypeValue(row, caseTypeKeys);
      const isNew = caseTypeValue === 'FRESH';
      const isRepeat = caseTypeValue === 'REPEAT';
      
      if (!isNew && !isRepeat) continue;
      
      const targetGroup = isNew ? newCasesGroups : repeatCasesGroups;
      
      if (!targetGroup[executiveName]) {
        targetGroup[executiveName] = {
          name: executiveName,
          cases: 0,
          loanAmount: 0
        };
      }
      
      targetGroup[executiveName].cases++;
      targetGroup[executiveName].loanAmount += getNumericValue(row, loanAmountKeys);
    }

    const newCasesData = Object.values(newCasesGroups).sort((a, b) => b.loanAmount - a.loanAmount);
    const repeatCasesData = Object.values(repeatCasesGroups).sort((a, b) => b.loanAmount - a.loanAmount);
    
    let newGrandTotalCases = 0;
    let newGrandTotalLoanAmount = 0;
    newCasesData.forEach(exec => {
      newGrandTotalCases += exec.cases;
      newGrandTotalLoanAmount += exec.loanAmount;
    });

    let repeatGrandTotalCases = 0;
    let repeatGrandTotalLoanAmount = 0;
    repeatCasesData.forEach(exec => {
      repeatGrandTotalCases += exec.cases;
      repeatGrandTotalLoanAmount += exec.loanAmount;
    });

    const newCasesResult = newCasesData.map((exec, index) => ({
      'Sr': index + 1,
      'Executive Name': exec.name,
      'Number of Cases': exec.cases,
      'Loan Amount': exec.loanAmount,
      '_isGrandTotal': false
    }));

    newCasesResult.push({
      'Sr': '',
      'Executive Name': 'Grand Total',
      'Number of Cases': newGrandTotalCases,
      'Loan Amount': newGrandTotalLoanAmount,
      '_isGrandTotal': true
    });

    const repeatCasesResult = repeatCasesData.map((exec, index) => ({
      'Sr': index + 1,
      'Executive Name': exec.name,
      'Number of Cases': exec.cases,
      'Loan Amount': exec.loanAmount,
      '_isGrandTotal': false
    }));

    repeatCasesResult.push({
      'Sr': '',
      'Executive Name': 'Grand Total',
      'Number of Cases': repeatGrandTotalCases,
      'Loan Amount': repeatGrandTotalLoanAmount,
      '_isGrandTotal': true
    });
    
    return {
      new: newCasesResult,
      repeat: repeatCasesResult
    };
  } catch (error) {
    console.error('Error fetching Salary4Sure today sanction report data:', error.message);
    throw error;
  }
}

// Salary4Sure PF Wise Report
async function fetchSalary4SurePFWiseReportData() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const filteredData = await fetchSalary4SureData(today, tomorrow);

    const pfPercentKeys = ['PF %', 'PF%', 'pf %', 'PF % ', 'PF_Percent', 'PF Percent', 'Processing Fee %', 'Processing Fee%'];
    const loanAmountKeys = ['Loan Amount', 'Loan amount', 'loan amount', 'LOAN AMOUNT', 'Loan Amount ', 'LoanAmount'];
    // Salary4Sure uses "Net disburse Amt" and "Repayment Amt"
    const netDisbursalKeys = ['Net disburse Amt', 'Net disburse amt', 'net disburse amt', 'NET DISBURSE AMT', 'Net disburse Amt ', 'Net Disburse Amt', 'NetDisburseAmt',
                               'Net Disbursal Amount', 'Net Disbursal amount', 'net disbursal amount', 'NET DISBURSAL AMOUNT', 'Net Disbursal Amount ', 'Net DisbursalAmount', 'NetDisbursalAmount', 
                               'Net Disbused Amount', 'Net Disbused amount', 'net disbused amount', 'NET DISBUSED AMOUNT', 'Net Disbused Amount ', 'Net DisbusedAmount'];
    const loanRepayKeys = ['Repayment Amt', 'Repayment amt', 'repayment amt', 'REPAYMENT AMT', 'Repayment Amt ', 'RepaymentAmt',
                           'Loan Repay Amount', 'Loan Repay amount', 'loan repay amount', 'LOAN REPAY AMOUNT', 'Loan Repay Amount ', 'Loan RepayAmount', 'LoanRepayAmount'];

    function getPFPercentValue(row, keys) {
      for (const key of keys) {
        const value = row[key];
        if (value !== undefined && value !== null && value !== '') {
          const str = value.toString().trim();
          const percentMatch = str.match(/(\d+(?:\.\d+)?)\s*%?/);
          if (percentMatch) {
            return percentMatch[1];
          }
          const num = parseFloat(str);
          if (!isNaN(num)) {
            return num.toString();
          }
        }
      }
      return null;
    }

    const pfGroups = {};
    
    for (const row of filteredData) {
      const pfPercent = getPFPercentValue(row, pfPercentKeys);
      
      if (!pfPercent) continue;
      
      if (!pfGroups[pfPercent]) {
        pfGroups[pfPercent] = {
          pfPercent: pfPercent,
          cases: 0,
          loanAmount: 0,
          disbursalAmount: 0,
          repayAmount: 0
        };
      }
      
      pfGroups[pfPercent].cases++;
      pfGroups[pfPercent].loanAmount += getNumericValue(row, loanAmountKeys);
      pfGroups[pfPercent].disbursalAmount += getNumericValue(row, netDisbursalKeys);
      pfGroups[pfPercent].repayAmount += getNumericValue(row, loanRepayKeys);
    }

    const pfData = Object.values(pfGroups).sort((a, b) => parseFloat(a.pfPercent) - parseFloat(b.pfPercent));
    
    let grandTotalCases = 0;
    let grandTotalLoanAmount = 0;
    let grandTotalDisbursalAmount = 0;
    let grandTotalRepayAmount = 0;
    
    pfData.forEach(pf => {
      grandTotalCases += pf.cases;
      grandTotalLoanAmount += pf.loanAmount;
      grandTotalDisbursalAmount += pf.disbursalAmount;
      grandTotalRepayAmount += pf.repayAmount;
    });

    const reportDate = new Date();
    const displayDate = `${String(reportDate.getDate()).padStart(2, '0')}-${String(reportDate.getMonth() + 1).padStart(2, '0')}-${reportDate.getFullYear()}`;

    const result = pfData.map(pf => ({
      'DATE': displayDate,
      'PF %': `${pf.pfPercent}%`,
      'Total cases': pf.cases,
      'Loan Amount': pf.loanAmount,
      'DISBURSE Amount': pf.disbursalAmount,
      'Repay Amount': pf.repayAmount,
      '_isGrandTotal': false
    }));

    result.push({
      'DATE': '',
      'PF %': 'Grand Total',
      'Total cases': grandTotalCases,
      'Loan Amount': grandTotalLoanAmount,
      'DISBURSE Amount': grandTotalDisbursalAmount,
      'Repay Amount': grandTotalRepayAmount,
      '_isGrandTotal': true
    });

    return result;
  } catch (error) {
    console.error('Error fetching Salary4Sure PF wise report data:', error.message);
    throw error;
  }
}

// API endpoint to get executive report data
app.get('/api/executive-report', async (req, res) => {
  try {
    const data = await fetchExecutiveReportData();
    res.json(data);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch executive report data',
      message: error.message,
      url: PUBLISHED_SHEET_URL
    });
  }
});

// API endpoint to get today sanction report data
app.get('/api/today-sanction-report', async (req, res) => {
  try {
    const data = await fetchTodaySanctionReportData();
    res.json(data);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch today sanction report data',
      message: error.message,
      url: PUBLISHED_SHEET_URL
    });
  }
});

// API endpoint to get PF wise report data
app.get('/api/pf-wise-report', async (req, res) => {
  try {
    const data = await fetchPFWiseReportData();
    res.json(data);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch PF wise report data',
      message: error.message,
      url: PUBLISHED_SHEET_URL
    });
  }
});

// ==================== SALARY4SURE API ENDPOINTS ====================
// API endpoint to get Salary4Sure leaderboard data
app.get('/api/salary4sure/leaderboard', async (req, res) => {
  try {
    const fromDate = parseDateFromQuery(req.query.fromDate);
    const toDate = parseDateFromQuery(req.query.toDate);
    const data = await fetchSalary4SureLeaderboardData(fromDate, toDate);
    res.json(data);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Salary4Sure leaderboard data',
      message: error.message,
      url: SALARY4SURE_SHEET_URL
    });
  }
});

// API endpoint to get Salary4Sure executive report data
app.get('/api/salary4sure/executive-report', async (req, res) => {
  try {
    const fromDate = parseDateFromQuery(req.query.fromDate);
    const toDate = parseDateFromQuery(req.query.toDate);
    const data = await fetchSalary4SureExecutiveReportData(fromDate, toDate);
    res.json(data);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Salary4Sure executive report data',
      message: error.message,
      url: SALARY4SURE_SHEET_URL
    });
  }
});

// API endpoint to get Salary4Sure today sanction report data
app.get('/api/salary4sure/today-sanction-report', async (req, res) => {
  try {
    const data = await fetchSalary4SureTodaySanctionReportData();
    res.json(data);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Salary4Sure today sanction report data',
      message: error.message,
      url: SALARY4SURE_SHEET_URL
    });
  }
});

// API endpoint to get Salary4Sure PF wise report data
app.get('/api/salary4sure/pf-wise-report', async (req, res) => {
  try {
    const data = await fetchSalary4SurePFWiseReportData();
    res.json(data);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Salary4Sure PF wise report data',
      message: error.message,
      url: SALARY4SURE_SHEET_URL
    });
  }
});

// Debug endpoint to check raw CSV data
app.get('/api/debug', async (req, res) => {
  try {
    const response = await axios.get(PUBLISHED_SHEET_URL, {
      responseType: 'text',
      timeout: 10000,
    });
    res.json({
      url: PUBLISHED_SHEET_URL,
      csvLength: response.data.length,
      first500Chars: response.data.substring(0, 500),
      rawCsv: response.data
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      url: PUBLISHED_SHEET_URL
    });
  }
});

// Serve the main page (daily performance report)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the executive report page
app.get('/executive-report', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'executive-report.html'));
});

// Serve the today sanction report page
app.get('/today-sanction-report', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'today-sanction-report.html'));
});

// Serve the PF wise report page
app.get('/pf-wise-report', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pf-wise-report.html'));
});

// ==================== SALARY4SURE ROUTES ====================
// Serve Salary4Sure daily performance report page
app.get('/salary4sure', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'salary4sure', 'index.html'));
});

// Serve Salary4Sure executive report page
app.get('/salary4sure/executive-report', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'salary4sure', 'executive-report.html'));
});

// Serve Salary4Sure today sanction report page
app.get('/salary4sure/today-sanction-report', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'salary4sure', 'today-sanction-report.html'));
});

// Serve Salary4Sure PF wise report page
app.get('/salary4sure/pf-wise-report', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'salary4sure', 'pf-wise-report.html'));
});

// WebSocket connection for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send initial data
  fetchLeaderboardData()
    .then(data => {
      socket.emit('leaderboard-update', data);
    })
    .catch(error => {
      socket.emit('error', { message: 'Failed to fetch data' });
    });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Poll Google Sheets every 10 minutes and broadcast updates
const UPDATE_INTERVAL = 600000; // 10 minutes (600000 milliseconds)
setInterval(async () => {
  try {
    const data = await fetchLeaderboardData();
    io.emit('leaderboard-update', data);
  } catch (error) {
    console.error('Error in periodic update:', error);
    io.emit('error', { message: 'Failed to update leaderboard' });
  }
}, UPDATE_INTERVAL);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Fetching data from: ${PUBLISHED_SHEET_URL}`);
  console.log(`Update interval: ${UPDATE_INTERVAL / 1000 / 60} minutes`);
  console.log(`No Google Cloud Console setup needed - using published sheet!`);
});

