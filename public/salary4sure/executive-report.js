const tableBody = document.getElementById('tableBody');
const grandTotalRow = document.getElementById('grandTotalRow');
const lastUpdate = document.getElementById('lastUpdate');

// Fetch data from API
async function fetchData() {
    try {
        const response = await fetch('/api/salary4sure/executive-report');
        const data = await response.json();
        updateReport(data);
        updateLastUpdateTime();
    } catch (error) {
        console.error('Failed to fetch data:', error);
        tableBody.innerHTML = '<tr><td colspan="4" class="loading">Failed to load data</td></tr>';
    }
}

// Update the report table
function updateReport(data) {
    if (!data || data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="loading">No data available</td></tr>';
        grandTotalRow.innerHTML = '';
        return;
    }

    // Separate data rows from grand total
    const dataRows = data.filter(row => !row._isGrandTotal);
    const grandTotal = data.find(row => row._isGrandTotal);

    // Render data rows
    renderDataRows(dataRows);
    
    // Render grand total
    renderGrandTotal(grandTotal);
}

// Render data rows
function renderDataRows(rows) {
    tableBody.innerHTML = '';
    
    if (rows.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="loading">No data rows found</td></tr>';
        return;
    }
    
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
        
        // Loan Amount
        const loanAmountTd = document.createElement('td');
        const loanAmountValue = row['Loan Amount'] || row['Loan amount'] || row['loan amount'] || '0';
        loanAmountTd.textContent = formatCurrency(loanAmountValue);
        loanAmountTd.className = 'number-cell';
        
        // Gradient based on row position (0 = first row/deep green, rows.length - 1 = last row/red)
        const totalRows = rows.length;
        const position = totalRows > 1 ? index / (totalRows - 1) : 0;
        
        // Apply gradient class based on position for smooth transition
        if (position <= 0.2) {
            // Top 20% - Deep green
            tr.classList.add('row-gradient-deep-green');
        } else if (position <= 0.4) {
            // 20-40% - Green
            tr.classList.add('row-gradient-green');
        } else if (position <= 0.55) {
            // 40-55% - Light green/Yellow-green
            tr.classList.add('row-gradient-light-green');
        } else if (position <= 0.7) {
            // 55-70% - Yellow
            tr.classList.add('row-gradient-yellow');
        } else if (position <= 0.85) {
            // 70-85% - Orange
            tr.classList.add('row-gradient-orange');
        } else {
            // Bottom 15% - Red
            tr.classList.add('row-gradient-red');
        }
        
        tr.appendChild(loanAmountTd);
        
        tableBody.appendChild(tr);
    });
}

// Render grand total row
function renderGrandTotal(totalRow) {
    if (!totalRow) {
        grandTotalRow.innerHTML = '';
        return;
    }
    
    const casesValue = totalRow['Number of Cases'] || totalRow['Number of cases'] || totalRow['number of cases'] || '0';
    const loanAmountValue = totalRow['Loan Amount'] || totalRow['Loan amount'] || totalRow['loan amount'] || '0';
    
    grandTotalRow.innerHTML = `
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

