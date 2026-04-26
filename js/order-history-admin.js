import { apiGet, apiPost } from './api.js';
import { state } from './state.js';

export async function loadAdminOrders() {
    state.orders = await apiGet('getOrders');
}

async function updateOrderStatus(orderId, status) {
    await apiPost('updateOrderStatus', { orderId, status });
}

export function renderAdminOrdersPage() {
    const ordersHtml = state.orders.map((order) => `
        <tr>
            <td><strong>#${order.OrderID}</strong></td>
            <td>${order.customer_name || 'Unknown'}</td>
            <td>${order.order_date ? new Date(order.order_date).toLocaleString() : '-'}</td>
            <td><strong>P${(order.TotalPayment / 100).toFixed(2)}</strong></td>
            <td><span class="order-status status-${order.Status}">${order.Status}</span></td>
            <td>
                <select class="statusSelect" data-id="${order.OrderID}">
                    <option ${order.Status === 'Preparing' ? 'selected' : ''}>Preparing</option>
                    <option ${order.Status === 'Complete' ? 'selected' : ''}>Complete</option>
                    <option ${order.Status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
            </td>
            <td>${order.referenceNumber || 'N/A'}</td>
        </tr>
    `).join('');

    return `
    <div class="admin-page-content">
        <div class="page-header">
            <h1>All Orders</h1>
        </div>
        <div class="panel">
            <h2>Order Management</h2>
            <div style="overflow-x:auto;">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th><th>Customer</th><th>Date</th><th>Total</th>
                            <th>Status</th><th>Update Status</th><th>Payment Ref</th>
                        </tr>
                    </thead>
                    <tbody>${ordersHtml || '<tr><td colspan="7" style="text-align:center;color:#aaa;padding:24px;">No orders yet.</td></tr>'}</tbody>
                </table>
            </div>
        </div>
    </div>`;
}

export function attachAdminOrderEvents(renderApp) {
    document.querySelectorAll('.statusSelect').forEach((select) => {
        select.addEventListener('change', function () {
            updateOrderStatus(parseInt(this.dataset.id, 10), this.value)
                .then(() => renderApp())
                .catch((error) => alert(error.message));
        });
    });
}
