import { apiGet, apiPost } from './api.js';
import { state } from './state.js';

export async function loadUserOrders(customerId) {
    state.orders = await apiGet('getOrders', { customerId });
}

export async function cancelOrder(orderId, renderApp) {
    if (!confirm('Cancel this order?')) {
        return;
    }

    try {
        await apiPost('updateOrderStatus', { orderId, status: 'Cancelled' });
        alert('Order cancelled');
        await renderApp();
    } catch (error) {
        alert(error.message);
    }
}

export function renderUserOrdersRows() {
    if (state.orders.length === 0) {
        return '<tr><td colspan="6" style="text-align:center;">No orders yet</td></tr>';
    }

    return state.orders.map((order) => (
        '<tr>' +
            `<td>#${order.OrderID}</td>` +
            `<td>${order.order_date ? new Date(order.order_date).toLocaleString() : '-'}</td>` +
            `<td>P${(order.TotalPayment / 100).toFixed(2)}</td>` +
            `<td><span class="order-status status-${order.Status}">${order.Status}</span></td>` +
            `<td>${order.referenceNumber || 'N/A'}</td>` +
            `<td>${order.Status === 'Preparing' ? `<button class="cancelOrderBtn small-btn btn-danger" data-id="${order.OrderID}">Cancel</button>` : '-'}</td>` +
        '</tr>'
    )).join('');
}
