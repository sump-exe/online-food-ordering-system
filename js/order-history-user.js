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

async function getOrderDetails(orderId) {
    return await apiGet('getOrderDetails', { orderId });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function openUserOrderDetailsDrawer(orderId, totalAmount) {
    const existingDrawer = document.getElementById('customerOrderDetailsDrawer');
    const existingOverlay = document.getElementById('customerOrderDetailsOverlay');
    if (existingDrawer) existingDrawer.remove();
    if (existingOverlay) existingOverlay.remove();

    const drawerHtml = `
    <div id="customerOrderDetailsOverlay" class="order-history-overlay open"></div>
    <aside id="customerOrderDetailsDrawer" class="order-history-drawer open" style="width: min(600px, 95vw);">
        <div class="order-history-drawer-header">
            <div>
                <div class="order-history-kicker">Customer</div>
                <h2>Order #${orderId}</h2>
                <p style="margin-top: 8px; color: #7a6070;">Total: P${(totalAmount / 100).toFixed(2)}</p>
            </div>
            <button class="btn-secondary order-history-close" id="closeCustomerOrderDetailsBtn">Close</button>
        </div>
        <div class="order-history-drawer-body" id="customerOrderDetailsBody">
            <div style="text-align:center; padding: 40px;">Loading items...</div>
        </div>
    </aside>`;

    document.body.insertAdjacentHTML('beforeend', drawerHtml);

    const closeDrawer = () => {
        document.getElementById('customerOrderDetailsDrawer')?.remove();
        document.getElementById('customerOrderDetailsOverlay')?.remove();
    };

    document.getElementById('closeCustomerOrderDetailsBtn')?.addEventListener('click', closeDrawer);
    document.getElementById('customerOrderDetailsOverlay')?.addEventListener('click', closeDrawer);

    getOrderDetails(orderId)
        .then((items) => {
            const body = document.getElementById('customerOrderDetailsBody');
            if (!body) {
                return;
            }

            if (!items || items.length === 0) {
                body.innerHTML = '<p style="text-align:center;color:#aaa;">No items found.</p>';
                return;
            }

            let itemsHtml = `
            <table style="width:100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th style="text-align:left; padding:8px;">Item</th>
                        <th style="text-align:center; padding:8px;">Qty</th>
                        <th style="text-align:right; padding:8px;">Price</th>
                        <th style="text-align:right; padding:8px;">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
            `;

            for (const item of items) {
                itemsHtml += `
                    <tr>
                        <td style="padding:8px;">${escapeHtml(item.item_name)}</td>
                        <td style="text-align:center; padding:8px;">${item.quantity}</td>
                        <td style="text-align:right; padding:8px;">P${(item.price / 100).toFixed(2)}</td>
                        <td style="text-align:right; padding:8px;">P${(item.subtotal / 100).toFixed(2)}</td>
                    </tr>
                `;
            }

            itemsHtml += `
                </tbody>
            </table>`;

            body.innerHTML = itemsHtml;
        })
        .catch((error) => {
            const body = document.getElementById('customerOrderDetailsBody');
            if (body) {
                body.innerHTML = `<div class="error-message">Failed to load items: ${error.message}</div>`;
            }
        });
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
            `<td>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button class="viewOrderDetailsBtn small-btn btn-secondary" data-id="${order.OrderID}" data-total="${order.TotalPayment}">View</button>
                    ${order.Status === 'Preparing' ? `<button class="cancelOrderBtn small-btn btn-danger" data-id="${order.OrderID}">Cancel</button>` : ''}
                </div>
            </td>` +
        '</tr>'
    )).join('');
}
