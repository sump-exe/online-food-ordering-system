import { apiGet } from './api.js';
import { state } from './state.js';

export async function loadAdminSalesData() {
    const params = {};
    const { year, month, day, user } = state.salesFilter;

    if (year) {
        params.year = year;
    }
    if (month) {
        params.month = month;
    }
    if (day) {
        params.day = day;
    }
    if (user) {
        params.customerId = user;
    }

    state.salesReport = await apiGet('getAdminSalesReport', params);
}

function getActiveFilterLabel() {
    const { year, month, day, user } = state.salesFilter;
    const active = [];

    if (year) {
        active.push(`Year: ${year}`);
    }
    if (month) {
        active.push(`Month: ${String(month).padStart(2, '0')}`);
    }
    if (day) {
        active.push(`Day: ${String(day).padStart(2, '0')}`);
    }
    if (user) {
        const match = state.salesReport.filterOptions.users.find((entry) => String(entry.id) === String(user));
        active.push(`User: ${match?.username || 'Selected User'}`);
    }

    return active.length > 0 ? `Active Filters: ${active.join(' | ')}` : 'Showing all completed orders';
}

function renderSelectOptions(options, selectedValue, placeholder, mapLabel) {
    const optionHtml = options.map((option) => {
        const value = String(option.value ?? option.id);
        const label = mapLabel(option);
        const selected = String(selectedValue) === value ? 'selected' : '';
        return `<option value="${value}" ${selected}>${label}</option>`;
    }).join('');

    return `<option value="">${placeholder}</option>${optionHtml}`;
}

export function renderAdminSalesPage() {
    const { totalRevenue, orderCount, bestSeller, orders, filterOptions } = state.salesReport;
    const orderRows = orders.map((row) => `
        <tr>
            <td><strong>#${row.OrderID}</strong></td>
            <td>${row.order_date ? new Date(row.order_date).toLocaleString() : '-'}</td>
            <td>${row.customer_name || 'Unknown'}</td>
            <td>${row.referenceNumber || 'N/A'}</td>
            <td><strong style="color:#ff5722;">P${(row.TotalPayment / 100).toFixed(2)}</strong></td>
        </tr>
    `).join('');

    return `
    <div class="admin-page-content">
        <div class="page-header">
            <h1>Sales</h1>
        </div>
        <div class="panel">
            <h2>Filters</h2>
            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">
                <div class="form-group" style="min-width:150px;margin-bottom:0;">
                    <label for="salesYearFilter">Year</label>
                    <select id="salesYearFilter">
                        ${renderSelectOptions(filterOptions.years, state.salesFilter.year, 'All Years', (option) => option.value)}
                    </select>
                </div>
                <div class="form-group" style="min-width:150px;margin-bottom:0;">
                    <label for="salesMonthFilter">Month</label>
                    <select id="salesMonthFilter">
                        ${renderSelectOptions(filterOptions.months, state.salesFilter.month, 'All Months', (option) => String(option.value).padStart(2, '0'))}
                    </select>
                </div>
                <div class="form-group" style="min-width:150px;margin-bottom:0;">
                    <label for="salesDayFilter">Day</label>
                    <select id="salesDayFilter">
                        ${renderSelectOptions(filterOptions.days, state.salesFilter.day, 'All Days', (option) => String(option.value).padStart(2, '0'))}
                    </select>
                </div>
                <div class="form-group" style="min-width:220px;margin-bottom:0;">
                    <label for="salesUserFilter">User</label>
                    <select id="salesUserFilter">
                        ${renderSelectOptions(filterOptions.users, state.salesFilter.user, 'All Users', (option) => option.username)}
                    </select>
                </div>
            </div>
            <div style="margin-top:12px;color:#7a6070;">${getActiveFilterLabel()}</div>
        </div>
        <div class="grid-2col">
            <div class="stat-card big" style="--accent:#ff5722;margin-bottom:0;">
                <div class="stat-val">P${(totalRevenue / 100).toFixed(2)}</div>
                <div class="stat-label">Total Revenue</div>
                <div class="stat-sub">From ${orderCount} completed orders</div>
            </div>
            <div class="stat-card big" style="--accent:#22c55e;margin-bottom:0;">
                <div class="stat-val" style="font-size:1.9rem;">${bestSeller?.item_name || 'None'}</div>
                <div class="stat-label">Best Selling Item</div>
                <div class="stat-sub">${bestSeller ? `${bestSeller.quantity_sold} sold` : 'No completed orders in this filter'}</div>
            </div>
        </div>
        <div class="panel">
            <h2>Completed Orders</h2>
            <div style="overflow-x:auto;">
                <table>
                    <thead><tr><th>ID</th><th>Date</th><th>Customer</th><th>Payment Ref</th><th>Total</th></tr></thead>
                    <tbody>${orderRows || '<tr><td colspan="5" style="text-align:center;color:#aaa;padding:20px;">No completed orders found.</td></tr>'}</tbody>
                </table>
            </div>
        </div>
    </div>`;
}

export function attachAdminSalesEvents(renderApp) {
    const bindFilter = (id, field) => {
        const element = document.getElementById(id);
        if (!element) {
            return;
        }

        element.addEventListener('change', function () {
            const nextValue = this.value || '';
            const nextFilter = {
                ...state.salesFilter,
                [field]: nextValue,
            };

            if (field === 'year' && nextValue === '') {
                nextFilter.month = '';
                nextFilter.day = '';
            }
            if (field === 'month' && nextValue === '') {
                nextFilter.day = '';
            }

            state.salesFilter = nextFilter;
            renderApp();
        });
    };

    bindFilter('salesYearFilter', 'year');
    bindFilter('salesMonthFilter', 'month');
    bindFilter('salesDayFilter', 'day');
    bindFilter('salesUserFilter', 'user');

    const hasSelectedValue = (items, value) => items.some((item) => String(item.value ?? item.id) === String(value));
    const { years, months, days, users } = state.salesReport.filterOptions;

    if (
        (state.salesFilter.year && !hasSelectedValue(years, state.salesFilter.year)) ||
        (state.salesFilter.month && !hasSelectedValue(months, state.salesFilter.month)) ||
        (state.salesFilter.day && !hasSelectedValue(days, state.salesFilter.day)) ||
        (state.salesFilter.user && !hasSelectedValue(users, state.salesFilter.user))
    ) {
        state.salesFilter = {
            year: state.salesFilter.year && hasSelectedValue(years, state.salesFilter.year) ? state.salesFilter.year : '',
            month: state.salesFilter.month && hasSelectedValue(months, state.salesFilter.month) ? state.salesFilter.month : '',
            day: state.salesFilter.day && hasSelectedValue(days, state.salesFilter.day) ? state.salesFilter.day : '',
            user: state.salesFilter.user && hasSelectedValue(users, state.salesFilter.user) ? state.salesFilter.user : '',
        };
        renderApp();
    }
}
