// Connect to Socket.IO server
const socket = io();

const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const tableBody = document.getElementById('tableBody');
const grandTotalRow = document.getElementById('grandTotalRow');
const lastUpdate = document.getElementById('lastUpdate');
const reportDate = document.getElementById('reportDate');

// Track current month for filtering (default to February)
let currentMonth = 2;

// Update report date
function updateReportDate(month) {
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const monthIndex = month ? month - 1 : 1;
    reportDate.textContent = `Daily Performance Report - ${monthNames[monthIndex]} 2026`;
}

// Initialize with February
updateReportDate(currentMonth);

// Socket connection events
socket.on('connect', () => {
    console.log('Connected to server');
    statusDot.className = 'status-dot connected';
    statusText.textContent = 'Connected';
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    statusDot.className = 'status-dot disconnected';
    statusText.textContent = 'Disconnected';
});

socket.on('connect_error', () => {
    statusDot.className = 'status-dot disconnected';
    statusText.textContent = 'Connection Error';
});

// Receive data updates
socket.on('leaderboard-update', (data) => {
    console.log('Received data update:', data);
    updateReport(data);
    updateLastUpdateTime();
});

socket.on('error', (error) => {
    console.error('Error:', error);
    statusText.textContent = 'Error: ' + error.message;
});

// Update the report table
function updateReport(data) {
    console.log('updateReport called with data:', data);
    
    if (!data || data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="loading">No data available</td></tr>';
        grandTotalRow.innerHTML = '';
        return;
    }

    // Log all column names from first row to debug
    if (data.length > 0) {
        console.log('Available columns:', Object.keys(data[0]));
        console.log('Sample row:', data[0]);
    }

    // Separate daily data rows from grand total
    const dataRows = data.filter(row => {
        // Skip grand total row (server marks it with _isGrandTotal flag or Date === 'GRAND TOTAL')
        if (row._isGrandTotal || (row.Date && row.Date.toString().toUpperCase() === 'GRAND TOTAL')) {
            return false;
        }
        return true;
    });
    
    // Find grand total row
    const grandTotal = data.find(row => row._isGrandTotal || (row.Date && row.Date.toString().toUpperCase() === 'GRAND TOTAL'));

    console.log('Data rows to display:', dataRows.length);
    console.log('Grand total found:', !!grandTotal);

    // Render data rows (daily totals, not accumulated)
    renderDataRows(dataRows);
    
    // Render grand total
    renderGrandTotal(grandTotal);
}

// Render data rows
function renderDataRows(rows) {
    tableBody.innerHTML = '';
    
    if (rows.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="loading">No data rows found</td></tr>';
        return;
    }
    
    rows.forEach(row => {
        const tr = document.createElement('tr');
        
        // Date column - try multiple possible column names
        const dateTd = document.createElement('td');
        const dateValue = row.Date || row.date || row.DATE || row['Date'] || row['DATE'] || '';
        dateTd.textContent = formatDate(dateValue);
        tr.appendChild(dateTd);
        
        // New column - try multiple possible column names
        const newTd = document.createElement('td');
        const newValue = row.New || row.new || row.NEW || row['New'] || row['NEW'] || '0';
        newTd.textContent = formatNumber(newValue);
        newTd.className = 'number-cell';
        tr.appendChild(newTd);
        
        // Repeat column
        const repeatTd = document.createElement('td');
        const repeatValue = row.Repeat || row.repeat || row.REPEAT || row['Repeat'] || row['REPEAT'] || '0';
        repeatTd.textContent = formatNumber(repeatValue);
        repeatTd.className = 'number-cell';
        tr.appendChild(repeatTd);
        
        // Total Cases column
        const totalCasesTd = document.createElement('td');
        const totalCasesValue = row['Total Cases'] || row['Total cases'] || row['total cases'] || 
                               row['TOTAL CASES'] || row['Total Cases'] || row['Total Cases '] || '0';
        totalCasesTd.textContent = formatNumber(totalCasesValue);
        totalCasesTd.className = 'number-cell';
        tr.appendChild(totalCasesTd);
        
        // Loan Amount column
        const loanAmountTd = document.createElement('td');
        const loanAmountValue = row['Loan Amount'] || row['Loan amount'] || row['loan amount'] || 
                               row['LOAN AMOUNT'] || row['Loan Amount '] || '0';
        loanAmountTd.textContent = formatCurrency(loanAmountValue);
        loanAmountTd.className = 'number-cell';
        tr.appendChild(loanAmountTd);
        
        // PF Amount column
        const pfAmountTd = document.createElement('td');
        const pfAmountValue = row['PF Amount'] || row['PF amount'] || row['pf amount'] || 
                             row['PF AMOUNT'] || row['PF Amount '] || '0';
        pfAmountTd.textContent = formatCurrency(pfAmountValue);
        pfAmountTd.className = 'number-cell';
        tr.appendChild(pfAmountTd);
        
        // Disbursal Amount column
        const disbursalAmountTd = document.createElement('td');
        const disbursalAmountValue = row['Disbursal Amount'] || row['Disbursal amount'] || row['disbursal amount'] || 
                                    row['DISBURSAL AMOUNT'] || row['Disbursal Amount '] || '0';
        disbursalAmountTd.textContent = formatCurrency(disbursalAmountValue);
        disbursalAmountTd.className = 'number-cell';
        tr.appendChild(disbursalAmountTd);
        
        // Repay Amount column
        const repayAmountTd = document.createElement('td');
        const repayAmountValue = row['Repay Amount'] || row['Repay amount'] || row['repay amount'] || 
                                row['Repay-Amount'] || row['REPAY AMOUNT'] || row['Repay Amount '] || '0';
        repayAmountTd.textContent = formatCurrency(repayAmountValue);
        repayAmountTd.className = 'number-cell';
        tr.appendChild(repayAmountTd);
        
        tableBody.appendChild(tr);
    });
}

// Render grand total row
function renderGrandTotal(totalRow) {
    if (!totalRow) {
        grandTotalRow.innerHTML = '';
        return;
    }
    
    // Try multiple possible column names
    const newValue = totalRow.New || totalRow.new || totalRow.NEW || totalRow['New'] || totalRow['NEW'] || '0';
    const repeatValue = totalRow.Repeat || totalRow.repeat || totalRow.REPEAT || totalRow['Repeat'] || totalRow['REPEAT'] || '0';
    const totalCasesValue = totalRow['Total Cases'] || totalRow['Total cases'] || totalRow['total cases'] || 
                           totalRow['TOTAL CASES'] || totalRow['Total Cases '] || '0';
    const loanAmountValue = totalRow['Loan Amount'] || totalRow['Loan amount'] || totalRow['loan amount'] || 
                           totalRow['LOAN AMOUNT'] || totalRow['Loan Amount '] || '0';
    const pfAmountValue = totalRow['PF Amount'] || totalRow['PF amount'] || totalRow['pf amount'] || 
                         totalRow['PF AMOUNT'] || totalRow['PF Amount '] || '0';
    const disbursalAmountValue = totalRow['Disbursal Amount'] || totalRow['Disbursal amount'] || totalRow['disbursal amount'] || 
                                totalRow['DISBURSAL AMOUNT'] || totalRow['Disbursal Amount '] || '0';
    const repayAmountValue = totalRow['Repay Amount'] || totalRow['Repay amount'] || totalRow['repay amount'] || 
                            totalRow['Repay-Amount'] || totalRow['REPAY AMOUNT'] || totalRow['Repay Amount '] || '0';
    
    grandTotalRow.innerHTML = `
        <tr class="grand-total-row">
            <td class="grand-total-label">GRAND TOTAL</td>
            <td class="number-cell">${formatNumber(newValue)}</td>
            <td class="number-cell">${formatNumber(repeatValue)}</td>
            <td class="number-cell">${formatNumber(totalCasesValue)}</td>
            <td class="number-cell">${formatCurrency(loanAmountValue)}</td>
            <td class="number-cell">${formatCurrency(pfAmountValue)}</td>
            <td class="number-cell">${formatCurrency(disbursalAmountValue)}</td>
            <td class="number-cell">${formatCurrency(repayAmountValue)}</td>
        </tr>
    `;
}

// Format date - keep MM/DD/YYYY format as received from server
function formatDate(dateStr) {
    if (!dateStr) return '';
    
    // Return as-is (server sends MM/DD/YYYY format)
    return dateStr.toString();
}

// Format number with commas
function formatNumber(value) {
    const num = parseFloat(value) || 0;
    return num.toLocaleString('en-US');
}

// Format currency with commas
function formatCurrency(value) {
    const num = parseFloat(value) || 0;
    return num.toLocaleString('en-US');
}

// Update last update time
function updateLastUpdateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    lastUpdate.textContent = timeString;
}

// Fallback: Fetch data via REST API if WebSocket fails
async function fetchDataViaAPI() {
    try {
        // Use month-based endpoint
        const endpoint = `/api/leaderboard/${currentMonth}`;
        console.log('Fetching from:', endpoint);
        const response = await fetch(endpoint);
        const data = await response.json();
        updateReport(data);
        updateLastUpdateTime();
    } catch (error) {
        console.error('Failed to fetch data via API:', error);
    }
}

// Date filter variables
let currentFromDate = null;
let currentToDate = null;

// Helper function to format date for API (YYYY-MM-DD)
function formatDateForAPI(date) {
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Update fetchDataViaAPI to use date filter
const originalFetchDataViaAPI = fetchDataViaAPI;
fetchDataViaAPI = async function() {
    try {
        const params = new URLSearchParams();
        if (currentFromDate) {
            const fromDateStr = formatDateForAPI(currentFromDate);
            params.append('fromDate', fromDateStr);
        }
        if (currentToDate) {
            const toDateStr = formatDateForAPI(currentToDate);
            params.append('toDate', toDateStr);
        }
        
        const url = '/api/leaderboard' + (params.toString() ? '?' + params.toString() : '');
        const response = await fetch(url);
        const data = await response.json();
        updateReport(data);
        updateLastUpdateTime();
    } catch (error) {
        console.error('Failed to fetch data via API:', error);
    }
};

// Initialize date filter when DOM is ready
let dateFilter = null;
function initDateFilter() {
    const container = document.getElementById('dateFilterContainer');
    if (container) {
        dateFilter = new DateFilter('dateFilterContainer', (fromDate, toDate) => {
            currentFromDate = fromDate;
            currentToDate = toDate;
            fetchDataViaAPI();
        });
    }
}

// Initialize date filter
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDateFilter);
} else {
    initDateFilter();
}

// Initialize month quick-filters (Jan/Feb)
function initMonthFilters() {
    const container = document.getElementById('monthFilterContainer');
    if (!container) return;

    const buttons = container.querySelectorAll('.month-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const month = parseInt(btn.getAttribute('data-month'), 10);
            applyMonthFilter(month);
            // Toggle active state
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

function applyMonthFilter(month) {
    // month: 1 = January, 2 = February
    currentMonth = month;
    
    const year = 2026;
    const fromDate = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0).getDate();
    const toDate = new Date(year, month - 1, lastDay);

    // Set current filter values
    currentFromDate = new Date(fromDate);
    currentFromDate.setHours(0,0,0,0);
    currentToDate = new Date(toDate);
    currentToDate.setHours(23,59,59,999);

    // Update report title to show month
    updateReportDate(month);

    // Fetch data for the selected month
    fetchDataViaAPI();
}

// Helper used above to set input values in YYYY-MM-DD
function formatDateForInput(date) {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Initialize month filters after DOM ready
function initMonthFiltersWithDefault() {
    initMonthFilters();
    
    // Set February button as active by default
    const container = document.getElementById('monthFilterContainer');
    if (container) {
        const febBtn = container.querySelector('[data-month="2"]');
        if (febBtn) {
            febBtn.classList.add('active');
        }
    }
    
    // Load February data
    applyMonthFilter(currentMonth);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMonthFiltersWithDefault);
} else {
    initMonthFiltersWithDefault();
}

// Fallback polling every 10 seconds as backup
setInterval(() => {
    if (!socket.connected) {
        fetchDataViaAPI();
    }
}, 10000);
