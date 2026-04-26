import { apiGet } from './api.js';
import { state } from './state.js';

export async function loadAdminSalesData() {
    [
        state.salesByDate,
        state.salesByCustomer,
    ] = await Promise.all([
        apiGet('getSalesByDate'),
        apiGet('getSalesByCustomer'),
    ]);
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
