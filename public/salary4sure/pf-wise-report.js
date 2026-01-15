const tableBody = document.getElementById('tableBody');
const grandTotalRow = document.getElementById('grandTotalRow');
const lastUpdate = document.getElementById('lastUpdate');

// Fetch data from API
async function fetchData() {
    try {
        const response = await fetch('/api/salary4sure/pf-wise-report');
        const data = await response.json();
        updateReport(data);
        updateLastUpdateTime();
    } catch (error) {
        console.error('Failed to fetch data:', error);
        tableBody.innerHTML = '<tr><td colspan="6" class="loading">Failed to load data</td></tr>';
    }
}

// Update the report table
function updateReport(data) {
    if (!data || data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="loading">No data available</td></tr>';
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
        tableBody.innerHTML = '<tr><td colspan="6" class="loading">No data rows found</td></tr>';
        return;
    }
    
    rows.forEach(row => {
        const tr = document.createElement('tr');
        
        // DATE column
        const dateTd = document.createElement('td');
        dateTd.textContent = row.DATE || row['DATE'] || row['Date'] || '';
        dateTd.className = 'date-cell';
        tr.appendChild(dateTd);
        
        // PF % column
        const pfTd = document.createElement('td');
        pfTd.textContent = row['PF %'] || row['PF%'] || row['pf %'] || '';
        pfTd.className = 'pf-percent-cell';
        tr.appendChild(pfTd);
        
        // Total cases column
        const casesTd = document.createElement('td');
        const casesValue = row['Total cases'] || row['Total Cases'] || row['total cases'] || '0';
        casesTd.textContent = formatNumber(casesValue);
        casesTd.className = 'number-cell';
        tr.appendChild(casesTd);
        
        // Loan Amount column
        const loanAmountTd = document.createElement('td');
        const loanAmountValue = row['Loan Amount'] || row['Loan amount'] || row['loan amount'] || '0';
        loanAmountTd.textContent = formatCurrency(loanAmountValue);
        loanAmountTd.className = 'number-cell';
        tr.appendChild(loanAmountTd);
        
        // DISBURSE Amount column
        const disbursalTd = document.createElement('td');
        const disbursalValue = row['DISBURSE Amount'] || row['DISBURSE amount'] || row['Disburse Amount'] || row['disburse amount'] || '0';
        disbursalTd.textContent = formatCurrency(disbursalValue);
        disbursalTd.className = 'number-cell';
        tr.appendChild(disbursalTd);
        
        // Repay Amount column
        const repayTd = document.createElement('td');
        const repayValue = row['Repay Amount'] || row['Repay amount'] || row['repay amount'] || '0';
        repayTd.textContent = formatCurrency(repayValue);
        repayTd.className = 'number-cell';
        tr.appendChild(repayTd);
        
        tableBody.appendChild(tr);
    });
}

// Render grand total row
function renderGrandTotal(totalRow) {
    if (!totalRow) {
        grandTotalRow.innerHTML = '';
        return;
    }
    
    const dateValue = totalRow.DATE || totalRow['DATE'] || '';
    const pfValue = totalRow['PF %'] || totalRow['PF%'] || '';
    const casesValue = totalRow['Total cases'] || totalRow['Total Cases'] || totalRow['total cases'] || '0';
    const loanAmountValue = totalRow['Loan Amount'] || totalRow['Loan amount'] || totalRow['loan amount'] || '0';
    const disbursalValue = totalRow['DISBURSE Amount'] || totalRow['DISBURSE amount'] || totalRow['Disburse Amount'] || totalRow['disburse amount'] || '0';
    const repayValue = totalRow['Repay Amount'] || totalRow['Repay amount'] || totalRow['repay amount'] || '0';
    
    grandTotalRow.innerHTML = `
        <tr class="grand-total-row">
            <td class="grand-total-label">${dateValue}</td>
            <td class="grand-total-label">${pfValue}</td>
            <td class="number-cell">${formatNumber(casesValue)}</td>
            <td class="number-cell">${formatCurrency(loanAmountValue)}</td>
            <td class="number-cell">${formatCurrency(disbursalValue)}</td>
            <td class="number-cell">${formatCurrency(repayValue)}</td>
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

