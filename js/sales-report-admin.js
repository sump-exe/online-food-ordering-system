import { apiGet } from './api.js';
import { state } from './state.js';

export async function loadAdminSalesData() {
    try {
        const year = state.salesFilter?.year || '';
        const month = state.salesFilter?.month || '';
        const day = state.salesFilter?.day || '';
        const username = state.salesFilter?.username || '';
        
        // Build filter params - only include non-empty values
        const filteredParams = {};
        if (year) filteredParams.year = year;
        if (month) filteredParams.month = month;
        if (day) filteredParams.day = day;
        if (username) filteredParams.username = username;
        
        // Always load unfiltered data for filter options (only once or when filters reset)
        if (!state.allSalesData.salesByDate || state.allSalesData.salesByDate.length === 0) {
            const unfiltered = await Promise.all([
                apiGet('getSalesByDate', {}).catch(err => {
                    console.error('Error loading all sales data:', err);
                    return [];
                }),
                apiGet('getSalesByCustomer', {}).catch(err => {
                    console.error('Error loading all customers:', err);
                    return [];
                })
            ]);
            state.allSalesData.salesByDate = unfiltered[0] || [];
            state.allSalesData.salesByCustomer = unfiltered[1] || [];
        }
        
        // Load filtered data for display
        const [salesByDate, salesByCustomer, mostOrderedItem] = await Promise.all([
            apiGet('getSalesByDate', filteredParams).catch(err => {
                console.error('Error loading filtered sales by date:', err);
                return [];
            }),
            apiGet('getSalesByCustomer', filteredParams).catch(err => {
                console.error('Error loading filtered sales by customer:', err);
                return [];
            }),
            apiGet('getMostOrderedItem', filteredParams).catch(err => {
                console.error('Error loading most ordered item:', err);
                console.error('Params were:', filteredParams);
                return { name: 'No data', frequency: 0 };
            })
        ]);
        
        state.salesByDate = salesByDate || [];
        state.salesByCustomer = salesByCustomer || [];
        state.mostOrderedItem = mostOrderedItem || { name: 'No data', frequency: 0 };
        
        return { salesByDate, salesByCustomer, mostOrderedItem };
    } catch (error) {
        console.error('Failed to load sales data:', error);
        state.salesByDate = [];
        state.salesByCustomer = [];
        state.mostOrderedItem = { name: 'No data', frequency: 0 };
        return null;
    }
}

export function setSalesFilter(year = null, month = null, day = null, username = null) {
    state.salesFilter = { year, month, day, username };
}

function getUniqueYears() {
    const years = state.allSalesData.salesByDate
        .map(row => {
            const date = row.sale_date;
            if (date) {
                const year = date.split('-')[0];
                return year;
            }
            return null;
        })
        .filter(Boolean);
    
    return [...new Set(years)].sort((a, b) => b - a);
}

function getUniqueMonths() {
    const months = state.allSalesData.salesByDate
        .map(row => {
            const date = row.sale_date;
            if (date) {
                const month = date.split('-')[1];
                return month;
            }
            return null;
        })
        .filter(Boolean);
    
    return [...new Set(months)].sort((a, b) => a - b);
}

function getUniqueDays() {
    const days = state.allSalesData.salesByDate
        .map(row => {
            const date = row.sale_date;
            if (date) {
                const day = date.split('-')[2];
                return day;
            }
            return null;
        })
        .filter(Boolean);
    
    return [...new Set(days)].sort((a, b) => a - b);
}

function getUniqueUsernames() {
    const usernames = (state.allSalesData.salesByCustomer || [])
        .map(row => row.customer_name)
        .filter(Boolean);
    
    return [...new Set(usernames)].sort((a, b) => a.localeCompare(b));
}

export function renderAdminSalesPage() {
    const salesByDate = state.salesByDate || [];
    const salesByCustomer = state.salesByCustomer || [];
    const mostOrderedItem = state.mostOrderedItem || { name: 'No data', frequency: 0 };
    
    const totalRevenue = salesByDate.reduce((sum, row) => sum + (row.revenue || 0), 0);
    const totalOrderCount = salesByDate.reduce((sum, row) => sum + (row.order_count || 0), 0);
    
    const years = getUniqueYears();
    const months = getUniqueMonths();
    const days = getUniqueDays();
    const usernames = getUniqueUsernames();
    
    const yearOptions = years.map(y => `<option value="${y}" ${state.salesFilter?.year === y ? 'selected' : ''}>${y}</option>`).join('');
    const monthOptions = months.map(m => `<option value="${m}" ${state.salesFilter?.month === m ? 'selected' : ''}>${parseInt(m)}</option>`).join('');
    const dayOptions = days.map(d => `<option value="${d}" ${state.salesFilter?.day === d ? 'selected' : ''}>${parseInt(d)}</option>`).join('');
    const usernameOptions = usernames.map(u => `<option value="${u}" ${state.salesFilter?.username === u ? 'selected' : ''}>${u}</option>`).join('');
    
    const dateRows = salesByDate.map((row) => `
        <tr>
            <td>${row.sale_date || '-'}</td>
            <td>${row.order_count || 0}</td>
            <td><strong style="color:#ff5722;">P${((row.revenue || 0) / 100).toFixed(2)}</strong></td>
        </tr>
    `).join('');
    
    const customerRows = salesByCustomer.map((row) => `
        <tr>
            <td>${row.customer_name || 'Unknown'}</td>
            <td>${row.order_count || 0} orders</td>
            <td><strong style="color:#ff5722;">P${((row.revenue || 0) / 100).toFixed(2)}</strong></td>
        </tr>
    `).join('');
    
    return `
    <div class="admin-page-content">
        <div class="page-header">
            <h1>Sales Reports</h1>
            <p>Detailed sales breakdown and analytics</p>
        </div>
        
        <div class="panel" style="margin-bottom: 24px;">
            <div style="display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap;">
                <div class="form-group" style="margin-bottom: 0;">
                    <label for="yearSelect">Year</label>
                    <select id="yearSelect">
                        <option value="">All Years</option>
                        ${yearOptions}
                    </select>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label for="monthSelect">Month</label>
                    <select id="monthSelect">
                        <option value="">All Months</option>
                        ${monthOptions}
                    </select>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label for="daySelect">Day</label>
                    <select id="daySelect">
                        <option value="">All Days</option>
                        ${dayOptions}
                    </select>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label for="usernameSelect">Username</label>
                    <select id="usernameSelect">
                        <option value="">All Users</option>
                        ${usernameOptions}
                    </select>
                </div>
                <button id="applyFilterBtn" class="btn-primary">Apply Filter</button>
                <button id="resetFilterBtn" class="btn-secondary">Reset</button>
            </div>
        </div>
        
        <div class="grid-3col" style="margin-bottom: 28px;">
            <div class="stat-card" style="--accent:#ff5722;">
                <div class="stat-icon">💰</div>
                <div class="stat-val">P${(totalRevenue / 100).toFixed(2)}</div>
                <div class="stat-label">Total Revenue</div>
                <div class="stat-sub">From ${totalOrderCount} completed orders</div>
            </div>
            <div class="stat-card" style="--accent:#10b981;">
                <div class="stat-icon">🔥</div>
                <div class="stat-val">${mostOrderedItem.name}</div>
                <div class="stat-label">Most Ordered Item</div>
                <div class="stat-sub">Ordered ${mostOrderedItem.frequency} times</div>
            </div>
            <div class="stat-card" style="--accent:#3b82f6;">
                <div class="stat-icon">📦</div>
                <div class="stat-val">${totalOrderCount}</div>
                <div class="stat-label">Total Orders</div>
                <div class="stat-sub">Completed orders</div>
            </div>
        </div>
        
        <div class="panel" style="margin-bottom: 28px;">
            <h2>Sales by Date</h2>
            <div style="overflow-x: auto;">
                <table style="width: 100%;">
                    <thead>
                        <tr><th>Date</th><th>Orders</th><th>Revenue</th></tr>
                    </thead>
                    <tbody>
                        ${dateRows || '<tr><td colspan="3" style="text-align: center; padding: 40px; color: #aaa;">No sales data available for selected period.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
        
        <div class="panel">
            <h2>Top Customers</h2>
            <div style="overflow-x: auto;">
                <table style="width: 100%;">
                    <thead>
                        <tr><th>Customer</th><th>Orders</th><th>Total Spent</th></tr>
                    </thead>
                    <tbody>
                        ${customerRows || '<tr><td colspan="3" style="text-align: center; padding: 40px; color: #aaa;">No customer data available.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    </div>`;
}

export function attachSalesEvents(callbacks) {
    const { renderApp, loadSalesData } = callbacks;
    
    const applyBtn = document.getElementById('applyFilterBtn');
    if (applyBtn) {
        applyBtn.addEventListener('click', async () => {
            const year = document.getElementById('yearSelect')?.value || null;
            const month = document.getElementById('monthSelect')?.value || null;
            const day = document.getElementById('daySelect')?.value || null;
            const username = document.getElementById('usernameSelect')?.value || null;
            
            setSalesFilter(year, month, day, username);
            if (loadSalesData) await loadSalesData();
            if (renderApp) await renderApp();
        });
    }
    
    const resetBtn = document.getElementById('resetFilterBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            setSalesFilter(null, null, null, null);
            if (loadSalesData) await loadSalesData();
            if (renderApp) await renderApp();
        });
    }
}