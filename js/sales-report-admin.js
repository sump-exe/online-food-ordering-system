// ============================================================
// File: js/sales-report-admin.js
// ============================================================
import { apiGet } from './api.js';
import { state } from './state.js';

const MONTH_LABELS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
];

let salesOrders = [];
let salesTrendData = [];

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

async function loadSalesTrend() {
    try {
        const data = await apiGet('getMonthlySalesTrend', {
            username: state.salesFilter.username || ''
        });
        salesTrendData = Array.isArray(data) ? data : [];
        return salesTrendData;
    } catch (error) {
        console.error('Failed to load sales trend:', error);
        salesTrendData = [];
        return [];
    }
}

function formatSalesMonthLabel(year, month) {
    const monthIndex = Number(month) - 1;
    const monthName = MONTH_LABELS[monthIndex] || '';
    return `${monthName} ${year}`;
}

function renderSalesTrendChart(canvas, data) {
    if (!canvas || !canvas.getContext) return;

    const normalizedData = data
        .map((item) => ({
            year: Number(item.year),
            month: Number(item.month),
            revenue: Number(item.revenue) || 0,
            label: formatSalesMonthLabel(item.year, item.month)
        }))
        .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);

    if (normalizedData.length === 0) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    const devicePixelRatio = window.devicePixelRatio || 1;
    const width = Math.min(820, Math.max(560, canvas.clientWidth || 720));
    const height = 360;
    canvas.width = width * devicePixelRatio;
    canvas.height = height * devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const margin = { top: 32, right: 28, bottom: 56, left: 62 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    const revenues = normalizedData.map((item) => item.revenue);
    const maxRevenue = Math.max(...revenues, 1);
    const yRange = maxRevenue;

    const points = normalizedData.map((item, idx) => {
        const x = margin.left + (chartWidth * idx) / Math.max(1, normalizedData.length - 1);
        const y = margin.top + chartHeight - ((item.revenue / yRange) * chartHeight);
        return { x, y, revenue: item.revenue, label: item.label };
    });

    ctx.strokeStyle = '#e9e4dd';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#7b6c68';
    ctx.font = '12px Inter, system-ui, sans-serif';

    for (let i = 0; i <= 4; i += 1) {
        const y = margin.top + (chartHeight * i) / 4;
        ctx.beginPath();
        ctx.moveTo(margin.left, y);
        ctx.lineTo(width - margin.right, y);
        ctx.stroke();

        const value = Math.round((maxRevenue * (1 - i / 4)) / 100) / 100;
        ctx.fillText(`P${value.toFixed(2)}`, 8, y + 4);
    }

    ctx.strokeStyle = '#d7cfc4';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, margin.top + chartHeight);
    ctx.lineTo(width - margin.right, margin.top + chartHeight);
    ctx.stroke();

    ctx.beginPath();
    points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
    });
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2.6;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.beginPath();
    points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
    });
    ctx.lineTo(points[points.length - 1].x, margin.top + chartHeight);
    ctx.lineTo(points[0].x, margin.top + chartHeight);
    ctx.closePath();
    ctx.fillStyle = 'rgba(59, 130, 246, 0.14)';
    ctx.fill();

    ctx.strokeStyle = '#1f2937';
    ctx.font = '600 14px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#1f2937';
    ctx.fillText('Monthly Sales Trend', margin.left, 22);

    ctx.fillStyle = '#3b82f6';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    points.forEach((point, index) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (index === 0 || index === points.length - 1 || points.length <= 6) {
            ctx.fillStyle = '#1f2937';
            ctx.font = '12px Inter, system-ui, sans-serif';
            ctx.fillText(point.label, point.x - 24, margin.top + chartHeight + 24);
            ctx.fillStyle = '#3b82f6';
        }
    });
}

function openSalesTrendDrawer(data) {
    const existingDrawer = document.getElementById('salesTrendDrawer');
    const existingOverlay = document.getElementById('salesTrendOverlay');
    if (existingDrawer) existingDrawer.remove();
    if (existingOverlay) existingOverlay.remove();

    const bodyContent = data && data.length > 0
        ? `<canvas id="salesTrendCanvas" style="width:100%; height:360px; display:block; background:#fff;"></canvas>`
        : `<div style="padding: 48px 12px; text-align:center; color:#8f7d75;">No monthly sales data available for the current filter.</div>`;

    const drawerHtml = `
    <div id="salesTrendOverlay" class="order-history-overlay open"></div>
    <aside id="salesTrendDrawer" class="order-history-drawer open" style="width: min(760px, 95vw);">
        <div class="order-history-drawer-header">
            <div>
                <div class="order-history-kicker">Sales Graph</div>
                <h2>Sales Report Graph</h2>
                <p style="margin-top: 8px; color: #7a6070;">Monthly revenue trend based on completed orders.</p>
            </div>
            <button class="btn-secondary order-history-close" id="closeSalesTrendBtn">Close</button>
        </div>
        <div class="order-history-drawer-body" id="salesTrendDrawerBody">
            ${bodyContent}
        </div>
    </aside>`;

    document.body.insertAdjacentHTML('beforeend', drawerHtml);

    const closeBtn = document.getElementById('closeSalesTrendBtn');
    const overlay = document.getElementById('salesTrendOverlay');
    const closeDrawer = () => {
        document.getElementById('salesTrendDrawer')?.remove();
        document.getElementById('salesTrendOverlay')?.remove();
    };
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (overlay) overlay.addEventListener('click', closeDrawer);

    if (data && data.length > 0) {
        const canvas = document.getElementById('salesTrendCanvas');
        if (canvas) {
            renderSalesTrendChart(canvas, data);
        }
    }
}

async function loadMostSoldItem() {
    try {
        const result = await apiGet('getMostOrderedItem', buildSalesFilterParams());
        state.mostOrderedItem = result || { name: 'No data', frequency: 0 };
        return state.mostOrderedItem;
    } catch (error) {
        console.error('Failed to load most sold item:', error);
        state.mostOrderedItem = { name: 'No data', frequency: 0 };
        return state.mostOrderedItem;
    }
}

export async function getOrderDetails(orderId) {
    return await apiGet('getOrderDetails', { orderId });
}

function buildSalesFilterParams() {
    return {
        year: state.salesFilter.year,
        month: state.salesFilter.month,
        day: state.salesFilter.day,
        username: state.salesFilter.username
    };
}

function getOrderDateParts(order) {
    const rawValue = String(order.order_date || '');
    const [datePart = ''] = rawValue.split(' ');
    const [year = '', month = '', day = ''] = datePart.split('-');

    return {
        year,
        month: month ? String(Number(month)) : '',
        day: day ? String(Number(day)) : ''
    };
}

function filterOrders(orders, filters = state.salesFilter) {
    return orders.filter((order) => {
        const parts = getOrderDateParts(order);

        if (filters.year && parts.year !== String(filters.year)) {
            return false;
        }

        if (filters.month && parts.month !== String(filters.month)) {
            return false;
        }

        if (filters.day && parts.day !== String(filters.day)) {
            return false;
        }

        if (filters.username && order.customer_name !== filters.username) {
            return false;
        }

        return true;
    });
}

function getUniqueValues(list, selector, numeric = false) {
    const values = [...new Set(list.map(selector).filter(Boolean))];

    if (numeric) {
        return values.sort((a, b) => Number(a) - Number(b));
    }

    return values.sort((a, b) => String(a).localeCompare(String(b)));
}

function getYearOptions() {
    return getUniqueValues(
        salesOrders,
        (order) => getOrderDateParts(order).year,
        true
    );
}

function getMonthOptions() {
    return getUniqueValues(
        filterOrders(salesOrders, {
            year: state.salesFilter.year,
            month: null,
            day: null,
            username: null
        }),
        (order) => getOrderDateParts(order).month,
        true
    );
}

function getDayOptions() {
    return getUniqueValues(
        filterOrders(salesOrders, {
            year: state.salesFilter.year,
            month: state.salesFilter.month,
            day: null,
            username: null
        }),
        (order) => getOrderDateParts(order).day,
        true
    );
}

function getUserOptions() {
    return getUniqueValues(
        filterOrders(salesOrders, {
            year: state.salesFilter.year,
            month: state.salesFilter.month,
            day: state.salesFilter.day,
            username: null
        }),
        (order) => order.customer_name,
        false
    );
}

function normalizeSalesFilter() {
    const yearOptions = getYearOptions();
    if (state.salesFilter.year && !yearOptions.includes(String(state.salesFilter.year))) {
        state.salesFilter.year = null;
    }

    const monthOptions = getMonthOptions();
    if (state.salesFilter.month && !monthOptions.includes(String(state.salesFilter.month))) {
        state.salesFilter.month = null;
    }

    const dayOptions = getDayOptions();
    if (state.salesFilter.day && !dayOptions.includes(String(state.salesFilter.day))) {
        state.salesFilter.day = null;
    }

    const userOptions = getUserOptions();
    if (state.salesFilter.username && !userOptions.includes(state.salesFilter.username)) {
        state.salesFilter.username = null;
    }
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

function renderSelectOptions(values, selectedValue, placeholder, formatter = (value) => value) {
    const options = values.map((value) => `
        <option value="${escapeHtml(value)}" ${String(selectedValue) === String(value) ? 'selected' : ''}>
            ${escapeHtml(formatter(value))}
        </option>
    `).join('');

    return `<option value="">${placeholder}</option>${options}`;
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
    normalizeSalesFilter();

    const filteredOrders = filterOrders(salesOrders);
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.total_payment, 0);
    const totalOrders = filteredOrders.length;
    const mostSoldItem = state.mostOrderedItem || { name: 'No data', frequency: 0 };

    const yearOptions = getYearOptions();
    const monthOptions = getMonthOptions();
    const dayOptions = getDayOptions();
    const userOptions = getUserOptions();

    const rowsHtml = filteredOrders.map(order => {
        const { date, time } = formatDateTime(order.order_date);
        return `
            <tr>
                <td>${escapeHtml(order.receipt_number)}</td>
                <td>${date}</td>
                <td>${time}</td>
                <td>${escapeHtml(order.customer_name)}</td>
                <td>P${(order.total_payment / 100).toFixed(2)}</td>
                <td><button class="viewOrderBtn btn-primary small-btn" data-order-id="${order.orderID}" data-customer="${escapeHtml(order.customer_name)}" data-total="${order.total_payment}" type="button">View</button></td>
            </tr>
        `;
    }).join('');

    return `
    <div class="admin-page-content">
        <div class="page-header">
            <h1>Sales Report</h1>
            <p>All completed orders with receipt details</p>
        </div>

        <div class="panel">
            <h2>Filters</h2>
            <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end;">
                <div class="form-group" style="min-width:140px; margin-bottom:0;">
                    <label for="salesYearFilter">Year</label>
                    <select id="salesYearFilter">
                        ${renderSelectOptions(yearOptions, state.salesFilter.year, 'All Years')}
                    </select>
                </div>
                <div class="form-group" style="min-width:140px; margin-bottom:0;">
                    <label for="salesMonthFilter">Month</label>
                    <select id="salesMonthFilter">
                        ${renderSelectOptions(monthOptions, state.salesFilter.month, 'All Months', (value) => MONTH_LABELS[Number(value) - 1] || value)}
                    </select>
                </div>
                <div class="form-group" style="min-width:140px; margin-bottom:0;">
                    <label for="salesDayFilter">Day</label>
                    <select id="salesDayFilter">
                        ${renderSelectOptions(dayOptions, state.salesFilter.day, 'All Days')}
                    </select>
                </div>
                <div class="form-group" style="min-width:220px; margin-bottom:0; flex:1;">
                    <label for="salesUserFilter">User</label>
                    <select id="salesUserFilter">
                        ${renderSelectOptions(userOptions, state.salesFilter.username, 'All Users')}
                    </select>
                </div>
                <div style="display:flex; align-items:flex-end; margin-left:auto; margin-top:2px;">
                    <button id="showSalesTrendBtn" class="btn-secondary" type="button" style="white-space:nowrap; height:42px;">Sales Report Graph</button>
                </div>
            </div>
        </div>

        <div class="grid-3col" style="margin-bottom: 28px;">
            <div class="stat-card" style="--accent:#ff5722;">
                <div class="stat-icon">&#128176;</div>
                <div class="stat-val">P${(totalRevenue / 100).toFixed(2)}</div>
                <div class="stat-label">Total Revenue</div>
                <div class="stat-sub">From filtered completed orders</div>
            </div>
            <div class="stat-card" style="--accent:#10b981;">
                <div class="stat-icon">&#128230;</div>
                <div class="stat-val">${totalOrders}</div>
                <div class="stat-label">Total Orders</div>
                <div class="stat-sub">Filtered completed orders</div>
            </div>
            <div class="stat-card" style="--accent:#3b82f6;">
                <div class="stat-icon">&#127942;</div>
                <div class="stat-val" style="font-size:${mostSoldItem.name && mostSoldItem.name.length > 18 ? '1.2rem' : '1.55rem'};">
                    ${escapeHtml(mostSoldItem.name || 'No data')}
                </div>
                <div class="stat-label">Most Sold Item</div>
                <div class="stat-sub">${mostSoldItem.frequency > 0 ? `${mostSoldItem.frequency} sold` : 'No matching sales data'}</div>
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
                        ${rowsHtml || '<tr><td colspan="6" style="text-align:center; padding:40px; color:#aaa;">No completed orders found for the selected filters.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    </div>`;
}

export function attachSalesEvents(callbacks) {
    const { renderInPlace, loadSalesData } = callbacks;

    const applyFilters = async (updater) => {
        updater();
        normalizeSalesFilter();

        if (loadSalesData) {
            await loadSalesData();
        }

        if (renderInPlace) {
            renderInPlace();
        }
    };

    const yearFilter = document.getElementById('salesYearFilter');
    if (yearFilter) {
        yearFilter.addEventListener('change', async function () {
            await applyFilters(() => {
                state.salesFilter.year = this.value || null;
                state.salesFilter.month = null;
                state.salesFilter.day = null;
            });
        });
    }

    const monthFilter = document.getElementById('salesMonthFilter');
    if (monthFilter) {
        monthFilter.addEventListener('change', async function () {
            await applyFilters(() => {
                state.salesFilter.month = this.value || null;
                state.salesFilter.day = null;
            });
        });
    }

    const dayFilter = document.getElementById('salesDayFilter');
    if (dayFilter) {
        dayFilter.addEventListener('change', async function () {
            await applyFilters(() => {
                state.salesFilter.day = this.value || null;
            });
        });
    }

    const userFilter = document.getElementById('salesUserFilter');
    if (userFilter) {
        userFilter.addEventListener('change', async function () {
            await applyFilters(() => {
                state.salesFilter.username = this.value || null;
            });
        });
    }

    const showSalesTrendBtn = document.getElementById('showSalesTrendBtn');
    if (showSalesTrendBtn) {
        showSalesTrendBtn.addEventListener('click', async () => {
            const trendData = await loadSalesTrend();
            openSalesTrendDrawer(trendData);
        });
    }

    document.querySelectorAll('.viewOrderBtn').forEach((button) => {
        button.addEventListener('click', () => {
            const orderId = parseInt(button.dataset.orderId, 10);
            const customerName = button.dataset.customer;
            const totalPayment = parseInt(button.dataset.total, 10);
            showOrderDetailsDrawer(orderId, customerName, totalPayment);
        });
    });
}

export async function loadAdminSalesData() {
    await Promise.all([loadSalesOrders(), loadMostSoldItem()]);
}
