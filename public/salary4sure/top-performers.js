// DOM Elements
let freshContainer;
let repeatContainer;
let freshTableBody;
let repeatTableBody;
let freshGrandTotal;
let repeatGrandTotal;

const DEFAULT_TARGET = 6000000; // Default 60 Lac

// Initialize DOM elements on page load
document.addEventListener('DOMContentLoaded', function() {
    freshContainer = document.getElementById('freshContainer');
    repeatContainer = document.getElementById('repeatContainer');
    freshTableBody = document.getElementById('freshTableBody');
    repeatTableBody = document.getElementById('repeatTableBody');
    freshGrandTotal = document.getElementById('freshGrandTotal');
    repeatGrandTotal = document.getElementById('repeatGrandTotal');
    
    fetchData();
});

// Fetch data from API
async function fetchData() {
    try {
        const response = await fetch('/api/salary4sure/top-performers');
        const data = await response.json();
        
        if (!data || data.length === 0) {
            return;
        }
        console.log('Sample data:', data[0]);
        // Filter data: Fresh = Fresh or Both, Repeat = Repeat or Both
        const freshData = data.filter(exec => exec['Case Type'] === 'Fresh' || exec['Case Type'] === 'Both');
        const repeatData = data.filter(exec => exec['Case Type'] === 'Repeat' || exec['Case Type'] === 'Both');
        
        // Sort by achieved amounts (highest first)
        freshData.sort((a, b) => (b['Fresh Amount'] || 0) - (a['Fresh Amount'] || 0));
        repeatData.sort((a, b) => (b['Repeat Amount'] || 0) - (a['Repeat Amount'] || 0));
        
        // Display Fresh section (with Fresh amounts and counts)
        displayPerformers(freshData.slice(0, 3), freshContainer);
        displayExecutiveTable(freshData, freshTableBody, freshGrandTotal, 'Fresh');
        
        // Display Repeat section (with Repeat amounts and counts)
        displayPerformers(repeatData.slice(0, 3), repeatContainer);
        displayExecutiveTable(repeatData, repeatTableBody, repeatGrandTotal, 'Repeat');
        
        // Update metrics and timestamp
        updateMetricsDashboard();
        updateLastUpdateTime();
        
    } catch (error) {
        console.error('Failed to fetch data:', error);
    }
}

// Display top 3 performers as cards
function displayPerformers(data, container) {
    container.innerHTML = '';
    
    if (!data || data.length === 0) {
        return;
    }
    
    const medals = ['🥇', '🥈', '🥉'];
    const placeClasses = ['first-place', 'second-place', 'third-place'];
    
    data.forEach((performer, index) => {
        const card = document.createElement('div');
        card.className = `performer-card ${placeClasses[index] || ''}`;
        
        // Determine if this is fresh or repeat based on container
        const isFresh = container.id === 'freshContainer';
        const amount = isFresh 
            ? parseFloat(performer['Fresh Amount'] || 0)
            : parseFloat(performer['Repeat Amount'] || 0);
        const cases = isFresh 
            ? performer['Fresh Cases'] || 0
            : performer['Repeat Cases'] || 0;
        
        // Format amount: Fresh in Lakhs, Repeat in Crores
        let amountDisplay;
        if (isFresh) {
            const amountInLakh = (amount / 100000).toFixed(0);
            amountDisplay = `₹${amountInLakh} Lakh`;
        } else {
            const amountInCr = (amount / 10000000).toFixed(2);
            amountDisplay = `₹${amountInCr} Cr`;
        }
        
        card.innerHTML = `
            <div class="medal-container">
                <div class="medal">${medals[index]}</div>
            </div>
            <div class="performer-name">${performer['Executive Name'] || 'N/A'}</div>
            <div class="amount-badge">${amountDisplay}</div>
            <div class="cases-label">Cases</div>
            <div class="cases-badge">${cases}</div>
        `;
        
        container.appendChild(card);
    });
}

// Display executive performance table
function displayExecutiveTable(data, tableBody, grandTotalFooter, typeFilter) {
    tableBody.innerHTML = '';
    
    if (!data || data.length === 0) {
        return;
    }
    
    let totalAchieved = 0;
    let totalTarget = 0;
    
    data.forEach((performer, index) => {
        // Get amount and cases based on type filter
        let amount, cases;
        if (typeFilter === 'Fresh') {
            amount = parseFloat(performer['Fresh Amount'] || 0);
            cases = performer['Fresh Cases'] || 0;
        } else {
            amount = parseFloat(performer['Repeat Amount'] || 0);
            cases = performer['Repeat Cases'] || 0;
        }
        
        const targetAmount = performer['Target Amount'] || DEFAULT_TARGET;
        const percentAchieved = (amount / targetAmount) * 100;
        
        totalAchieved += amount;
        totalTarget += targetAmount;
        
        // Determine percentage color
        let percentClass = 'percentage-poor';
        if (percentAchieved >= 90) {
            percentClass = 'percentage-excellent';
        } else if (percentAchieved >= 75) {
            percentClass = 'percentage-good';
        } else if (percentAchieved >= 50) {
            percentClass = 'percentage-moderate';
        }
        
        // Determine rank badge class
        let rankClass = 'rank-other';
        if (index === 0) rankClass = 'rank-1';
        else if (index === 1) rankClass = 'rank-2';
        else if (index === 2) rankClass = 'rank-3';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><div class="rank-badge-table ${rankClass}">${index + 1}</div></td>
            <td class="executive-name">${performer['Executive Name'] || 'N/A'}</td>
            <td>${cases}</td>
            <td class="target-cell">₹${(targetAmount / 100000).toFixed(1)}</td>
            <td class="achievement-cell">₹${(amount / 100000).toFixed(2)}</td>
            <td><span class="percentage-cell ${percentClass}">${percentAchieved.toFixed(2)}%</span></td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Grand Total Footer
    const totalPercentage = (totalAchieved / totalTarget) * 100;
    const footerRow = document.createElement('tr');
    footerRow.className = 'grand-total-row';
    footerRow.innerHTML = `
        <td></td>
        <td>GRAND TOTAL</td>
        <td></td>
        <td class="target-cell">₹${(totalTarget / 100000).toFixed(1)}</td>
        <td class="achievement-cell">₹${(totalAchieved / 100000).toFixed(2)}</td>
        <td>${totalPercentage.toFixed(2)}%</td>
    `;
    
    grandTotalFooter.innerHTML = '';
    grandTotalFooter.appendChild(footerRow);
}

// Update metrics dashboard
function updateMetricsDashboard() {
    const freshRows = document.querySelectorAll('#freshTableBody tr');
    const repeatRows = document.querySelectorAll('#repeatTableBody tr');
    
    let freshTotal = 0;
    let repeatTotal = 0;
    
    freshRows.forEach(row => {
        if (row.cells[4]) {
            const val = parseFloat(row.cells[4].textContent.replace(/[^0-9.]/g, '') || 0);
            freshTotal += val * 100000;
        }
    });
    
    repeatRows.forEach(row => {
        if (row.cells[4]) {
            const val = parseFloat(row.cells[4].textContent.replace(/[^0-9.]/g, '') || 0);
            repeatTotal += val * 100000;
        }
    });
    
    const totalAchieved = freshTotal + repeatTotal;
    const totalTarget = 21 * 10000000;
    const percentage = ((totalAchieved / totalTarget) * 100).toFixed(2);
    
    document.getElementById('freshDisbursalAchieved').textContent = `₹${(freshTotal / 10000000).toFixed(2)} Cr`;
    document.getElementById('repeatDisbursalAchieved').textContent = `₹${(repeatTotal / 10000000).toFixed(2)} Cr`;
    document.getElementById('totalDisbursalAchieved').textContent = `₹${(totalAchieved / 10000000).toFixed(2)} Cr`;
    document.getElementById('totalAchieved').textContent = `₹${(totalAchieved / 10000000).toFixed(2)} Cr`;
    document.getElementById('totalPercentage').textContent = `${percentage}%`;
}

// Update last update timestamp
function updateLastUpdateTime() {
    const now = new Date();
    const timeString = now.toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata'
    });
    document.getElementById('lastUpdate').textContent = 'Last updated: ' + timeString;
    
    // Update report date
    const reportDateElem = document.getElementById('reportDate');
    if (reportDateElem) {
        const reportDate = now.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            timeZone: 'Asia/Kolkata'
        });
        reportDateElem.textContent = reportDate;
    }
}
