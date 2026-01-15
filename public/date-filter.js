// Global Date Filter Component
// Usage: Include this script and call initDateFilter(apiEndpoint, onFilterChange)

class DateFilter {
    constructor(containerId, onFilterChange) {
        this.container = document.getElementById(containerId);
        this.onFilterChange = onFilterChange;
        this.fromDate = null;
        this.toDate = null;
        this.init();
    }

    init() {
        if (!this.container) return;

        // Set default dates (January 1, 2026 to today)
        const today = new Date();
        const jan1_2026 = new Date(2026, 0, 1);
        
        this.fromDate = jan1_2026;
        this.toDate = today;

        this.render();
    }

    render() {
        const fromDateStr = this.formatDateForInput(this.fromDate);
        const toDateStr = this.formatDateForInput(this.toDate);

        this.container.innerHTML = `
            <div class="date-filter-container">
                <div class="filter-label">Filter by Date Range:</div>
                <div class="date-inputs">
                    <div class="date-input-group">
                        <label for="fromDate">From:</label>
                        <input type="date" id="fromDate" value="${fromDateStr}" class="date-input">
                    </div>
                    <div class="date-input-group">
                        <label for="toDate">To:</label>
                        <input type="date" id="toDate" value="${toDateStr}" class="date-input">
                    </div>
                    <button id="applyFilter" class="filter-btn">Apply Filter</button>
                    <button id="resetFilter" class="filter-btn filter-btn-secondary">Reset</button>
                </div>
            </div>
        `;

        // Add event listeners
        document.getElementById('applyFilter').addEventListener('click', () => this.applyFilter());
        document.getElementById('resetFilter').addEventListener('click', () => this.resetFilter());
        
        // Apply filter on Enter key
        document.getElementById('fromDate').addEventListener('change', () => this.applyFilter());
        document.getElementById('toDate').addEventListener('change', () => this.applyFilter());
    }

    formatDateForInput(date) {
        if (!date) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    applyFilter() {
        const fromDateInput = document.getElementById('fromDate');
        const toDateInput = document.getElementById('toDate');

        if (fromDateInput && toDateInput) {
            this.fromDate = new Date(fromDateInput.value);
            this.toDate = new Date(toDateInput.value);
            
            // Set time to start/end of day
            this.fromDate.setHours(0, 0, 0, 0);
            this.toDate.setHours(23, 59, 59, 999);

            if (this.onFilterChange) {
                this.onFilterChange(this.fromDate, this.toDate);
            }
        }
    }

    resetFilter() {
        const today = new Date();
        const jan1_2026 = new Date(2026, 0, 1);
        
        this.fromDate = jan1_2026;
        this.toDate = today;

        // Update inputs
        document.getElementById('fromDate').value = this.formatDateForInput(this.fromDate);
        document.getElementById('toDate').value = this.formatDateForInput(this.toDate);

        if (this.onFilterChange) {
            this.onFilterChange(this.fromDate, this.toDate);
        }
    }

    getDateRange() {
        return {
            fromDate: this.fromDate,
            toDate: this.toDate
        };
    }
}

// Helper function to format date for API (YYYY-MM-DD)
function formatDateForAPI(date) {
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

