import { apiGet, apiPost } from './api.js';
import { state } from './state.js';

export async function loadAdminOrders() {
    state.orders = await apiGet('getOrders');
}

async function updateOrderStatus(orderId, status) {
    await apiPost('updateOrderStatus', { orderId, status });
}

function renderOrderFilterOptions(options, selectedValue, placeholder) {
    const html = options.map((option) => (
        `<option value="${option}" ${selectedValue === option ? 'selected' : ''}>${option}</option>`
    )).join('');

    return `<option value="">${placeholder}</option>${html}`;
}

export function renderAdminOrdersPage() {
    const usernames = [...new Set(state.orders.map((order) => order.customer_name).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));
    const statuses = [...new Set(state.orders.map((order) => order.Status).filter(Boolean))];

    const filteredOrders = state.orders.filter((order) => {
        if (state.adminOrderFilter.user && order.customer_name !== state.adminOrderFilter.user) {
            return false;
        }
        if (state.adminOrderFilter.status && order.Status !== state.adminOrderFilter.status) {
            return false;
        }
        return true;
    });

    const ordersHtml = filteredOrders.map((order) => `
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
            <h2>Filters</h2>
            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:20px;">
                <div class="form-group" style="min-width:220px;margin-bottom:0;">
                    <label for="adminOrderUserFilter">Username</label>
                    <select id="adminOrderUserFilter">
                        ${renderOrderFilterOptions(usernames, state.adminOrderFilter.user, 'All Users')}
                    </select>
                </div>
                <div class="form-group" style="min-width:180px;margin-bottom:0;">
                    <label for="adminOrderStatusFilter">Order Status</label>
                    <select id="adminOrderStatusFilter">
                        ${renderOrderFilterOptions(statuses, state.adminOrderFilter.status, 'All Statuses')}
                    </select>
                </div>
            </div>
            <h2>Order Management</h2>
            <div style="overflow-x:auto;">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th><th>Customer</th><th>Date</th><th>Total</th>
                            <th>Status</th><th>Update Status</th><th>Payment Ref</th>
                        </tr>
                    </thead>
                    <tbody>${ordersHtml || '<tr><td colspan="7" style="text-align:center;color:#aaa;padding:24px;">No matching orders found.</td></tr>'}</tbody>
                </table>
            </div>
        </div>
    </div>`;
}

export function attachAdminOrderEvents(callbacks) {
    const { renderApp, renderInPlace } = callbacks;

    const userFilter = document.getElementById('adminOrderUserFilter');
    if (userFilter) {
        userFilter.addEventListener('change', function () {
            state.adminOrderFilter.user = this.value;
            renderInPlace();
        });
    }

    const statusFilter = document.getElementById('adminOrderStatusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', function () {
            state.adminOrderFilter.status = this.value;
            renderInPlace();
        });
    }

    document.querySelectorAll('.statusSelect').forEach((select) => {
        select.addEventListener('change', function () {
            updateOrderStatus(parseInt(this.dataset.id, 10), this.value)
                .then(() => renderApp())
                .catch((error) => alert(error.message));
        });
    });
}
