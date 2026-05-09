// ============================================================
// File: js/sales-report-admin.js (completely rewritten)
// ============================================================
import { apiGet } from './api.js';
import { state } from './state.js';

let salesOrders = [];

export async function loadSalesOrders() {
    try {
        const orders = await apiGet('getSalesOrders');
        salesOrders = orders || [];
        return salesOrders;
    } catch (error) {
        console.error('Failed to load sales orders:', error);
        salesOrders = [];
        return [];
    }
}

export async function getOrderDetails(orderId) {
    return await apiGet('getOrderDetails', { orderId });
}

function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return { date: '-', time: '-' };
    const date = new Date(dateTimeStr);
    const datePart = date.toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    const timePart = date.toLocaleTimeString('en-PH', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    return { date: datePart, time: timePart };
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

// Show order items in a drawer (similar to order history)
function showOrderDetailsDrawer(orderId, customerName, totalAmount) {
    const existingDrawer = document.getElementById('orderDetailsDrawer');
    const existingOverlay = document.getElementById('orderDetailsOverlay');
    if (existingDrawer) existingDrawer.remove();
    if (existingOverlay) existingOverlay.remove();

    const drawerHtml = `
    <div id="orderDetailsOverlay" class="order-history-overlay open"></div>
    <aside id="orderDetailsDrawer" class="order-history-drawer open" style="width: min(600px, 95vw);">
        <div class="order-history-drawer-header">
            <div>
                <div class="order-history-kicker">Order Details</div>
                <h2>Order #${orderId}</h2>
                <p style="margin-top: 8px; color: #7a6070;">Customer: ${escapeHtml(customerName)}<br>Total: P${(totalAmount / 100).toFixed(2)}</p>
            </div>
            <button class="btn-secondary order-history-close" id="closeOrderDetailsBtn">Close</button>
        </div>
        <div class="order-history-drawer-body" id="orderDetailsBody">
            <div style="text-align:center; padding: 40px;">Loading items...</div>
        </div>
    </aside>`;

    document.body.insertAdjacentHTML('beforeend', drawerHtml);

    const closeBtn = document.getElementById('closeOrderDetailsBtn');
    const overlay = document.getElementById('orderDetailsOverlay');
    const closeDrawer = () => {
        document.getElementById('orderDetailsDrawer')?.remove();
        document.getElementById('orderDetailsOverlay')?.remove();
    };
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (overlay) overlay.addEventListener('click', closeDrawer);

    // Fetch and render items
    getOrderDetails(orderId)
        .then(items => {
            const body = document.getElementById('orderDetailsBody');
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
        .catch(err => {
            document.getElementById('orderDetailsBody').innerHTML = `<div class="error-message">Failed to load items: ${err.message}</div>`;
        });
}

export function renderAdminSalesPage() {
    const totalRevenue = salesOrders.reduce((sum, order) => sum + order.total_payment, 0);
    const totalOrders = salesOrders.length;

    const rowsHtml = salesOrders.map(order => {
        const { date, time } = formatDateTime(order.order_date);
        return `
            <tr>
                <td>${escapeHtml(order.receipt_number)}</td>
                <td>${date}</td>
                <td>${time}</td>
                <td>${escapeHtml(order.customer_name)}</td>
                <td>P${(order.total_payment / 100).toFixed(2)}</td>
                <td><button class="viewOrderBtn btn-primary small-btn" data-order-id="${order.orderID}" data-customer="${escapeHtml(order.customer_name)}" data-total="${order.total_payment}">View</button></td>
            </tr>
        `;
    }).join('');

    return `
    <div class="admin-page-content">
        <div class="page-header">
            <h1>Sales Report</h1>
            <p>All completed orders with receipt details</p>
        </div>

        <div class="grid-3col" style="margin-bottom: 28px;">
            <div class="stat-card" style="--accent:#ff5722;">
                <div class="stat-icon">💰</div>
                <div class="stat-val">P${(totalRevenue / 100).toFixed(2)}</div>
                <div class="stat-label">Total Revenue</div>
                <div class="stat-sub">From completed orders</div>
            </div>
            <div class="stat-card" style="--accent:#10b981;">
                <div class="stat-icon">📦</div>
                <div class="stat-val">${totalOrders}</div>
                <div class="stat-label">Total Orders</div>
                <div class="stat-sub">Completed</div>
            </div>
            <div class="stat-card" style="--accent:#3b82f6;">
                <div class="stat-icon">🧾</div>
                <div class="stat-val">${salesOrders.length}</div>
                <div class="stat-label">Receipts Issued</div>
                <div class="stat-sub">All with receipt numbers</div>
            </div>
        </div>

        <div class="panel">
            <h2>Order List</h2>
            <div style="overflow-x: auto;">
                <table style="width: 100%; min-width: 700px;">
                    <thead>
                        <tr>
                            <th>Receipt No.</th>
                            <th>Date</th>
                            <th>Time</th>
                            <th>User</th>
                            <th>Revenue</th>
                            <th>Order</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml || '<tr><td colspan="6" style="text-align:center; padding:40px; color:#aaa;">No completed orders found.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    </div>`;
}

export function attachSalesEvents(callbacks) {
    const { renderApp, loadSalesData } = callbacks;

    // Delegate event for dynamically rendered View buttons
    document.addEventListener('click', (e) => {
        const viewBtn = e.target.closest('.viewOrderBtn');
        if (viewBtn) {
            const orderId = parseInt(viewBtn.dataset.orderId, 10);
            const customerName = viewBtn.dataset.customer;
            const totalPayment = parseInt(viewBtn.dataset.total, 10);
            showOrderDetailsDrawer(orderId, customerName, totalPayment);
        }
    });
}

// Keep compatibility with existing loadAdminSalesData if called by main.js
export async function loadAdminSalesData() {
    await loadSalesOrders();
}