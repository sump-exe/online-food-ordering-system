import { apiGet } from './api.js';
import { state } from './state.js';

export async function loadAdminSalesData() {
    try {
        const period = state.salesFilter?.period || 'monthly';
        const startDate = state.salesFilter?.startDate || null;
        const endDate = state.salesFilter?.endDate || null;
        
        const params = { period };
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        
        const [salesReport, orderStats, salesByDate, salesByCustomer] = await Promise.all([
            apiGet('getSalesReport', params),
            apiGet('getOrderStats'),
            apiGet('getSalesByDate', params),
            apiGet('getSalesByCustomer', params)
        ]);
        
        state.salesReport = salesReport || { totalSales: 0, orderCount: 0 };
        state.orderStats = orderStats || { Preparing: 0, Complete: 0, Cancelled: 0 };
        state.salesByDate = salesByDate || [];
        state.salesByCustomer = salesByCustomer || [];
        
        return { salesReport, orderStats, salesByDate, salesByCustomer };
    } catch (error) {
        console.error('Failed to load sales data:', error);
        state.salesByDate = [];
        state.salesByCustomer = [];
        state.salesReport = { totalSales: 0, orderCount: 0 };
        state.orderStats = { Preparing: 0, Complete: 0, Cancelled: 0 };
        return null;
    }
}

export function setSalesFilter(period, startDate = null, endDate = null) {
    state.salesFilter = { period, startDate, endDate };
}

export function renderAdminSalesPage() {
    const salesByDate = state.salesByDate || [];
    const salesByCustomer = state.salesByCustomer || [];
    const salesReport = state.salesReport || { totalSales: 0, orderCount: 0 };
    const orderStats = state.orderStats || { Preparing: 0, Complete: 0, Cancelled: 0 };
    
    const totalRevenue = salesByDate.reduce((sum, row) => sum + (row.revenue || 0), 0);
    const totalOrderCount = salesByDate.reduce((sum, row) => sum + (row.order_count || 0), 0);
    const currentPeriod = state.salesFilter?.period || 'monthly';
    
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
                    <label>Period</label>
                    <select id="periodSelect">
                        <option value="daily" ${currentPeriod === 'daily' ? 'selected' : ''}>Daily</option>
                        <option value="weekly" ${currentPeriod === 'weekly' ? 'selected' : ''}>Weekly</option>
                        <option value="monthly" ${currentPeriod === 'monthly' ? 'selected' : ''}>Monthly</option>
                        <option value="yearly" ${currentPeriod === 'yearly' ? 'selected' : ''}>Yearly</option>
                        <option value="custom" ${currentPeriod === 'custom' ? 'selected' : ''}>Custom Range</option>
                    </select>
                </div>
                <div id="customDateRange" style="display: ${currentPeriod === 'custom' ? 'flex' : 'none'}; gap: 12px;">
                    <div class="form-group" style="margin-bottom: 0;">
                        <label>From</label>
                        <input type="date" id="startDate" value="${state.salesFilter?.startDate || ''}">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label>To</label>
                        <input type="date" id="endDate" value="${state.salesFilter?.endDate || ''}">
                    </div>
                </div>
                <button id="applyFilterBtn" class="btn-primary">Apply Filter</button>
                <button id="resetFilterBtn" class="btn-secondary">Reset</button>
            </div>
        </div>
        
        <div class="grid-3col" style="margin-bottom: 28px;">
            <div class="stat-card" style="--accent:#ff5722;">
                <div class="stat-icon">💰</div>
                <div class="stat-val">P${((salesReport.totalSales || totalRevenue) / 100).toFixed(2)}</div>
                <div class="stat-label">Total Revenue</div>
                <div class="stat-sub">From ${salesReport.orderCount || totalOrderCount} completed orders</div>
            </div>
            <div class="stat-card" style="--accent:#10b981;">
                <div class="stat-icon">📦</div>
                <div class="stat-val">${orderStats.Complete || 0}</div>
                <div class="stat-label">Completed Orders</div>
                <div class="stat-sub">Successfully delivered</div>
            </div>
            <div class="stat-card" style="--accent:#f59e0b;">
                <div class="stat-icon">⏳</div>
                <div class="stat-val">${orderStats.Preparing || 0}</div>
                <div class="stat-label">Preparing Orders</div>
                <div class="stat-sub">In progress</div>
            </div>
            <div class="stat-card" style="--accent:#dc2626;">
                <div class="stat-icon">❌</div>
                <div class="stat-val">${orderStats.Cancelled || 0}</div>
                <div class="stat-label">Cancelled Orders</div>
                <div class="stat-sub">Cancelled by customers</div>
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
    
    const periodSelect = document.getElementById('periodSelect');
    const customDateRange = document.getElementById('customDateRange');
    
    if (periodSelect) {
        periodSelect.addEventListener('change', () => {
            const isCustom = periodSelect.value === 'custom';
            if (customDateRange) {
                customDateRange.style.display = isCustom ? 'flex' : 'none';
            }
        });
    }
    
    const applyBtn = document.getElementById('applyFilterBtn');
    if (applyBtn) {
        applyBtn.addEventListener('click', async () => {
            const period = periodSelect ? periodSelect.value : 'monthly';
            let startDate = null;
            let endDate = null;
            
            if (period === 'custom') {
                startDate = document.getElementById('startDate')?.value || null;
                endDate = document.getElementById('endDate')?.value || null;
                
                if (!startDate || !endDate) {
                    alert('Please select both start and end dates');
                    return;
                }
            }
            
            setSalesFilter(period, startDate, endDate);
            if (loadSalesData) await loadSalesData();
            if (renderApp) await renderApp();
        });
    }
    
    const resetBtn = document.getElementById('resetFilterBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            setSalesFilter('monthly', null, null);
            if (loadSalesData) await loadSalesData();
            if (renderApp) await renderApp();
        });
    }
}