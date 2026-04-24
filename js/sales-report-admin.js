import { apiGet } from './api.js';
import { state } from './state.js';

export async function loadAdminSalesData() {
    [
        state.orderStats,
        state.dailySales,
        state.monthlySales,
        state.salesByDate,
        state.salesByCustomer,
    ] = await Promise.all([
        apiGet('getOrderStats'),
        apiGet('getSalesReport', { period: 'daily' }),
        apiGet('getSalesReport', { period: 'monthly' }),
        apiGet('getSalesByDate'),
        apiGet('getSalesByCustomer'),
    ]);
}

export function renderAdminSalesReportPage() {
    const totalOrders = state.orderStats.Complete + state.orderStats.Preparing + state.orderStats.Cancelled;
    const completionRate = totalOrders > 0
        ? ((state.orderStats.Complete / totalOrders) * 100).toFixed(1)
        : 0;

    return `
    <div class="admin-page-content">
        <div class="page-header">
            <h1>Sales Report</h1>
            <p>Overview of revenue, orders and performance metrics</p>
        </div>
        <div class="grid-2col" style="margin-bottom:28px;">
            <div class="stat-card big" style="--accent:#ff7b2c;">
                <div class="stat-val">P${(state.dailySales.totalSales / 100).toFixed(2)}</div>
                <div class="stat-label">Today's Revenue</div>
                <div class="stat-sub">${state.dailySales.orderCount} orders completed</div>
            </div>
            <div class="stat-card big" style="--accent:#ff5722;">
                <div class="stat-val">P${(state.monthlySales.totalSales / 100).toFixed(2)}</div>
                <div class="stat-label">Monthly Revenue (30 days)</div>
                <div class="stat-sub">${state.monthlySales.orderCount} orders completed</div>
            </div>
        </div>
        <div class="grid-3col" style="margin-bottom:28px;">
            <div class="stat-card" style="--accent:#10b981;"><div class="stat-val">${state.orderStats.Complete}</div><div class="stat-label">Completed Orders</div></div>
            <div class="stat-card" style="--accent:#f59e0b;"><div class="stat-val">${state.orderStats.Preparing}</div><div class="stat-label">In Progress</div></div>
            <div class="stat-card" style="--accent:#dc2626;"><div class="stat-val">${state.orderStats.Cancelled}</div><div class="stat-label">Cancelled</div></div>
        </div>
        <div class="panel">
            <h2>Performance Summary</h2>
            <div style="display:flex;flex-direction:column;gap:16px;">
                <div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                        <span style="font-weight:600;">Order Completion Rate</span>
                        <span style="color:#10b981;font-weight:700;">${completionRate}%</span>
                    </div>
                    <div class="stock-bar-wrap" style="height:12px;">
                        <div class="stock-bar-fill" style="width:${completionRate}%;background:#10b981;height:12px;border-radius:6px;"></div>
                    </div>
                </div>
                <div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                        <span style="font-weight:600;">Total Orders</span>
                        <span style="color:#ff5722;font-weight:700;">${totalOrders}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

export function renderAdminSalesPage() {
    const totalRevenue = state.salesByDate.reduce((sum, row) => sum + row.revenue, 0);
    const totalOrderCount = state.salesByDate.reduce((sum, row) => sum + row.order_count, 0);

    const dateRows = state.salesByDate.map((row) => `
        <tr>
            <td>${row.sale_date}</td>
            <td>${row.order_count}</td>
            <td><strong style="color:#ff5722;">P${(row.revenue / 100).toFixed(2)}</strong></td>
        </tr>
    `).join('');

    const customerRows = state.salesByCustomer.map((row) => `
        <tr>
            <td>${row.customer_name}</td>
            <td>${row.order_count} orders</td>
            <td><strong style="color:#ff5722;">P${(row.revenue / 100).toFixed(2)}</strong></td>
        </tr>
    `).join('');

    return `
    <div class="admin-page-content">
        <div class="page-header">
            <h1>Sales</h1>
            <p>Detailed sales breakdown by date and customer</p>
        </div>
        <div class="stat-card big" style="--accent:#ff5722;margin-bottom:28px;">
            <div class="stat-val">P${(totalRevenue / 100).toFixed(2)}</div>
            <div class="stat-label">Total Revenue (All Time)</div>
            <div class="stat-sub">From ${totalOrderCount} completed orders</div>
        </div>
        <div class="grid-2col">
            <div class="panel" style="margin-bottom:0;">
                <h2>Sales by Date</h2>
                <div style="overflow-x:auto;">
                    <table>
                        <thead><tr><th>Date</th><th>Orders</th><th>Revenue</th></tr></thead>
                        <tbody>${dateRows || '<tr><td colspan="3" style="text-align:center;color:#aaa;padding:20px;">No sales data yet.</td></tr>'}</tbody>
                    </table>
                </div>
            </div>
            <div class="panel" style="margin-bottom:0;">
                <h2>Sales by Customer</h2>
                <div style="overflow-x:auto;">
                    <table>
                        <thead><tr><th>Customer</th><th>Orders</th><th>Total Spent</th></tr></thead>
                        <tbody>${customerRows || '<tr><td colspan="3" style="text-align:center;color:#aaa;padding:20px;">No customer data yet.</td></tr>'}</tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>`;
}
