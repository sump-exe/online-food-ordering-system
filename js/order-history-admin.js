import { apiGet, apiPost } from './api.js';
import { state } from './state.js';

export async function loadAdminOrders() {
    try {
        const orders = await apiGet('getOrders');
        state.orders = orders || [];
        return state.orders;
    } catch (error) {
        console.error('Failed to load orders:', error);
        state.orders = [];
        return [];
    }
}

async function updateOrderStatus(orderId, status) {
    return apiPost('updateOrderStatus', { orderId, status });
}

async function getOrderDetails(orderId) {
    return apiGet('getOrderDetails', { orderId });
}

export function renderAdminOrdersPage() {
    const orders = state.orders || [];

    if (orders.length === 0) {
        return `
        <div class="admin-page-content">
            <div class="page-header">
                <h1>All Orders</h1>
                <p>View and manage all customer orders</p>
            </div>
            <div class="panel">
                <h2>Order Management</h2>
                <div style="text-align:center; padding:60px; color:#aaa;">
                    <p>No orders found.</p>
                </div>
            </div>
        </div>`;
    }

    const ordersHtml = orders.map((order) => `
        <tr>
            <td><strong>#${order.OrderID}</strong></td>
            <td>${escapeHtml(order.customer_name || 'Unknown')}</td>
            <td>${formatDate(order.order_date)}</td>
            <td><strong>P${((order.TotalPayment || 0) / 100).toFixed(2)}</strong></td>
            <td><span class="order-status status-${order.Status || 'Preparing'}">${order.Status || 'Preparing'}</span></td>
            <td>
                <select class="statusSelect" data-id="${order.OrderID}" data-current-status="${order.Status || 'Preparing'}">
                    <option value="Preparing" ${order.Status === 'Preparing' ? 'selected' : ''}>Preparing</option>
                    <option value="Complete" ${order.Status === 'Complete' ? 'selected' : ''}>Complete</option>
                    <option value="Cancelled" ${order.Status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
            </td>
            <td>${escapeHtml(order.referenceNumber || 'N/A')}</td>
            <td class="actions-cell">
                <button class="viewOrderBtn btn-secondary small-btn" data-id="${order.OrderID}">
                    View Details
                </button>
            </td>
        </tr>
    `).join('');

    return `
    <div class="admin-page-content">
        <div class="page-header">
            <h1>All Orders</h1>
            <p>View and manage all customer orders</p>
        </div>
        <div class="panel">
            <h2>Order Management</h2>
            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>Customer</th>
                            <th>Date</th>
                            <th>Total</th>
                            <th>Status</th>
                            <th>Update Status</th>
                            <th>Payment Ref</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>${ordersHtml}</tbody>
                </table>
            </div>
        </div>
    </div>`;
}

function showOrderDetailsModal(orderId) {
    const existingModal = document.getElementById('orderDetailsModal');
    if (existingModal) {
        existingModal.remove();
    }

    const modalHtml = `
    <div id="orderDetailsModal" class="modal-overlay">
        <div class="modal-container" style="max-width:600px;">
            <div class="modal-header">
                <h2>Order Details #${orderId}</h2>
                <button class="modal-close" id="closeDetailsModalBtn">&times;</button>
            </div>
            <div class="modal-body">
                <div id="detailsModalMessage" class="modal-message" style="display:none;"></div>
                <div id="orderItemsContainer">
                    <p style="text-align:center; padding:20px;">Loading order items...</p>
                </div>
            </div>
            <div class="modal-footer">
                <button id="closeDetailsBtn" class="btn-secondary">Close</button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById('orderDetailsModal');
    const messageDiv = document.getElementById('detailsModalMessage');
    const itemsContainer = document.getElementById('orderItemsContainer');

    getOrderDetails(orderId)
        .then((items) => {
            if (!items || items.length === 0) {
                itemsContainer.innerHTML = '<p style="text-align:center; color:#aaa;">No items found for this order.</p>';
                return;
            }

            let total = 0;
            const rowsHtml = items.map((item) => {
                const subtotal = (item.price || 0) * (item.quantity || 0);
                total += subtotal;

                return `
                    <tr>
                        <td>${escapeHtml(item.item_name)}</td>
                        <td>${item.quantity}</td>
                        <td>P${((item.price || 0) / 100).toFixed(2)}</td>
                        <td>P${(subtotal / 100).toFixed(2)}</td>
                    </tr>
                `;
            }).join('');

            itemsContainer.innerHTML = `
                <table style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Quantity</th>
                            <th>Price</th>
                            <th>Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" style="text-align:right; font-weight:700;">Total:</td>
                            <td style="font-weight:700; color:#ff5722;">P${(total / 100).toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
            `;
        })
        .catch((error) => {
            messageDiv.textContent = `Failed to load order details: ${error.message}`;
            messageDiv.className = 'modal-message error';
            messageDiv.style.display = 'block';
            itemsContainer.innerHTML = '<p style="text-align:center; color:#dc2626;">Failed to load order items.</p>';
        });

    const closeModal = () => {
        modal.remove();
    };

    document.getElementById('closeDetailsModalBtn').addEventListener('click', closeModal);
    document.getElementById('closeDetailsBtn').addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });
}

function formatDate(dateString) {
    if (!dateString) {
        return '-';
    }

    try {
        const date = new Date(dateString);
        return date.toLocaleString();
    } catch {
        return dateString;
    }
}

function escapeHtml(str) {
    if (!str) {
        return '';
    }

    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function attachAdminOrderEvents(renderApp) {
    document.querySelectorAll('.statusSelect').forEach((select) => {
        const newSelect = select.cloneNode(true);
        select.parentNode.replaceChild(newSelect, select);

        newSelect.addEventListener('change', async function () {
            const orderId = parseInt(this.dataset.id, 10);
            const newStatus = this.value;
            const oldStatus = this.dataset.currentStatus;

            if (newStatus === oldStatus) {
                return;
            }

            const confirmed = confirm(`Change order #${orderId} status from "${oldStatus}" to "${newStatus}"?`);
            if (!confirmed) {
                this.value = oldStatus;
                return;
            }

            try {
                await updateOrderStatus(orderId, newStatus);
                alert(`Order #${orderId} status updated to ${newStatus}`);
                await renderApp();
            } catch (error) {
                alert(`Failed to update status: ${error.message}`);
                this.value = oldStatus;
            }
        });
    });

    document.querySelectorAll('.viewOrderBtn').forEach((btn) => {
        btn.addEventListener('click', function () {
            const orderId = parseInt(this.dataset.id, 10);
            showOrderDetailsModal(orderId);
        });
    });
}
