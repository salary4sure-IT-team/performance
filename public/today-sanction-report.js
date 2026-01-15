const freshTableBody = document.getElementById('freshTableBody');
const freshGrandTotalRow = document.getElementById('freshGrandTotalRow');
const repeatTableBody = document.getElementById('repeatTableBody');
const repeatGrandTotalRow = document.getElementById('repeatGrandTotalRow');
const lastUpdate = document.getElementById('lastUpdate');

// Fetch data from API
async function fetchData() {
    try {
        const response = await fetch('/api/today-sanction-report');
        const data = await response.json();
        updateReports(data);
        updateLastUpdateTime();
    } catch (error) {
        console.error('Failed to fetch data:', error);
        freshTableBody.innerHTML = '<tr><td colspan="4" class="loading">Failed to load data</td></tr>';
        repeatTableBody.innerHTML = '<tr><td colspan="4" class="loading">Failed to load data</td></tr>';
    }
}

// Update both reports
function updateReports(data) {
    // Update Fresh (New) cases table
    if (data.new && data.new.length > 0) {
        const freshDataRows = data.new.filter(row => !row._isGrandTotal);
        const freshGrandTotal = data.new.find(row => row._isGrandTotal);
        renderDataRows(freshTableBody, freshDataRows);
        renderGrandTotal(freshGrandTotalRow, freshGrandTotal);
    } else {
        freshTableBody.innerHTML = '<tr><td colspan="4" class="loading">No data available</td></tr>';
        freshGrandTotalRow.innerHTML = '';
    }

    // Update Repeat cases table
    if (data.repeat && data.repeat.length > 0) {
        const repeatDataRows = data.repeat.filter(row => !row._isGrandTotal);
        const repeatGrandTotal = data.repeat.find(row => row._isGrandTotal);
        renderDataRows(repeatTableBody, repeatDataRows);
        renderGrandTotal(repeatGrandTotalRow, repeatGrandTotal);
    } else {
        repeatTableBody.innerHTML = '<tr><td colspan="4" class="loading">No data available</td></tr>';
        repeatGrandTotalRow.innerHTML = '';
    }
}

// Render data rows with gradient on Loan Amount column
function renderDataRows(tbody, rows) {
    tbody.innerHTML = '';
    
    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading">No data rows found</td></tr>';
        return;
    }
    
    // Find max loan amount for gradient
    const maxLoanAmount = Math.max(...rows.map(row => parseFloat(row['Loan Amount'] || 0)));
    
    rows.forEach((row, index) => {
        const tr = document.createElement('tr');
        
        // Serial number
        const srTd = document.createElement('td');
        srTd.textContent = row.Sr || row['Sr'] || '';
        srTd.className = 'sr-cell';
        tr.appendChild(srTd);
        
        // Executive Name
        const nameTd = document.createElement('td');
        nameTd.textContent = row['Executive Name'] || row['Executive name'] || row['executive name'] || '';
        nameTd.className = 'name-cell';
        tr.appendChild(nameTd);
        
        // Number of Cases
        const casesTd = document.createElement('td');
        const casesValue = row['Number of Cases'] || row['Number of cases'] || row['number of cases'] || '0';
        casesTd.textContent = formatNumber(casesValue);
        casesTd.className = 'number-cell';
        tr.appendChild(casesTd);
        
        // Loan Amount (with gradient)
        const loanAmountTd = document.createElement('td');
        const loanAmountValue = row['Loan Amount'] || row['Loan amount'] || row['loan amount'] || '0';
        loanAmountTd.textContent = formatCurrency(loanAmountValue);
        loanAmountTd.className = 'number-cell';
        
        // Apply gradient based on position (0 = first/highest, rows.length - 1 = last/lowest)
        const totalRows = rows.length;
        const position = totalRows > 1 ? index / (totalRows - 1) : 0;
        
        if (position <= 0.2) {
            loanAmountTd.classList.add('loan-amount-deep-green');
        } else if (position <= 0.4) {
            loanAmountTd.classList.add('loan-amount-green');
        } else if (position <= 0.55) {
            loanAmountTd.classList.add('loan-amount-light-green');
        } else if (position <= 0.7) {
            loanAmountTd.classList.add('loan-amount-yellow');
        } else if (position <= 0.85) {
            loanAmountTd.classList.add('loan-amount-orange');
        } else {
            loanAmountTd.classList.add('loan-amount-red');
        }
        
        tr.appendChild(loanAmountTd);
        tbody.appendChild(tr);
    });
}

// Render grand total row
function renderGrandTotal(tfoot, totalRow) {
    if (!totalRow) {
        tfoot.innerHTML = '';
        return;
    }
    
    const casesValue = totalRow['Number of Cases'] || totalRow['Number of cases'] || totalRow['number of cases'] || '0';
    const loanAmountValue = totalRow['Loan Amount'] || totalRow['Loan amount'] || totalRow['loan amount'] || '0';
    
    tfoot.innerHTML = `
        <tr class="grand-total-row">
            <td class="grand-total-label"></td>
            <td class="grand-total-label">GRAND TOTAL</td>
            <td class="number-cell">${formatNumber(casesValue)}</td>
            <td class="number-cell">${formatCurrency(loanAmountValue)}</td>
        </tr>
    `;
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

// Initial fetch
fetchData();

// Refresh every 10 minutes
setInterval(fetchData, 600000);

