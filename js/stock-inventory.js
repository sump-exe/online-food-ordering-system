import { apiGet } from './api.js';
import { state } from './state.js';

export async function loadInventoryData() {
    try {
        const menuItems = await apiGet('getMenuItems');
        state.menuItems = menuItems || [];
        return state.menuItems;
    } catch (error) {
        console.error('Failed to load inventory:', error);
        state.menuItems = [];
        return [];
    }
}

export function renderInventoryPage() {
    const items = state.menuItems || [];
    
    const totalItems = items.length;
    const totalStock = items.reduce((sum, item) => sum + (item.stock || 0), 0);
    const totalValue = items.reduce((sum, item) => sum + ((item.price || 0) * (item.stock || 0)), 0);
    const lowStockItems = items.filter(item => (item.stock || 0) <= 10);
    const outOfStockItems = items.filter(item => (item.stock || 0) === 0);
    
    const categories = {};
    items.forEach(item => {
        const catName = item.category_name || 'Uncategorized';
        if (!categories[catName]) {
            categories[catName] = [];
        }
        categories[catName].push(item);
    });
    
    let categoriesHtml = '';
    for (const [categoryName, categoryItems] of Object.entries(categories)) {
        const categoryTotalStock = categoryItems.reduce((sum, item) => sum + (item.stock || 0), 0);
        const categoryTotalValue = categoryItems.reduce((sum, item) => sum + ((item.price || 0) * (item.stock || 0)), 0);
        
        const rowsHtml = categoryItems.map(item => {
            const stockStatus = item.stock === 0 ? 'out-of-stock' : (item.stock <= 10 ? 'low-stock' : 'in-stock');
            const stockStatusText = item.stock === 0 ? 'Out of Stock' : (item.stock <= 10 ? 'Low Stock' : 'In Stock');
            
            return `
                <tr class="stock-row ${stockStatus}">
                    <td><strong>${escapeHtml(item.name)}</strong></td>
                    <td>P${((item.price || 0) / 100).toFixed(2)}</td>
                    <td class="stock-quantity ${stockStatus}">${item.stock || 0}</td>
                    <td><span class="stock-badge ${stockStatus}">${stockStatusText}</span></td>
                    <td>P${(((item.price || 0) * (item.stock || 0)) / 100).toFixed(2)}</td>
                </tr>
            `;
        }).join('');
        
        categoriesHtml += `
            <div class="inventory-category-group">
                <div class="inventory-category-header">
                    <h3>${escapeHtml(categoryName)}</h3>
                    <div class="category-stats">
                        <span>📦 ${categoryItems.length} items</span>
                        <span>📊 ${categoryTotalStock} total stock</span>
                        <span>💰 P${(categoryTotalValue / 100).toFixed(2)} value</span>
                    </div>
                </div>
                <div style="overflow-x: auto;">
                    <table class="inventory-table">
                        <thead>
                            <tr>
                                <th>Item Name</th>
                                <th>Price</th>
                                <th>Stock</th>
                                <th>Status</th>
                                <th>Total Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    return `
    <div class="admin-page-content">
        <div class="page-header">
            <h1>📊 Stock Inventory Report</h1>
            <p>Complete inventory overview with stock levels and valuations</p>
        </div>
        
        <div class="inventory-stats-grid">
            <div class="stat-card" style="--accent:#ff5722;">
                <div class="stat-icon">🍽️</div>
                <div class="stat-val">${totalItems}</div>
                <div class="stat-label">Total Menu Items</div>
            </div>
            <div class="stat-card" style="--accent:#10b981;">
                <div class="stat-icon">📦</div>
                <div class="stat-val">${totalStock}</div>
                <div class="stat-label">Total Stock Units</div>
            </div>
            <div class="stat-card" style="--accent:#f59e0b;">
                <div class="stat-icon">💰</div>
                <div class="stat-val">P${(totalValue / 100).toFixed(2)}</div>
                <div class="stat-label">Total Inventory Value</div>
            </div>
            <div class="stat-card" style="--accent:#dc2626;">
                <div class="stat-icon">⚠️</div>
                <div class="stat-val">${lowStockItems.length}</div>
                <div class="stat-label">Low Stock Items (≤10)</div>
            </div>
        </div>
        
        ${lowStockItems.length > 0 ? `
        <div class="alert-banner warning">
            <strong>⚠️ Low Stock Alert!</strong> The following items have low stock (≤10 units):
            <ul style="margin-top: 10px; margin-left: 20px;">
                ${lowStockItems.map(item => `<li>${escapeHtml(item.name)} - Only ${item.stock} left</li>`).join('')}
            </ul>
        </div>
        ` : ''}
        
        ${outOfStockItems.length > 0 ? `
        <div class="alert-banner danger">
            <strong>🚫 Out of Stock Alert!</strong> The following items are out of stock:
            <ul style="margin-top: 10px; margin-left: 20px;">
                ${outOfStockItems.map(item => `<li>${escapeHtml(item.name)}</li>`).join('')}
            </ul>
        </div>
        ` : ''}
        
        <div class="panel">
            <h2>Inventory by Category</h2>
            <div class="inventory-categories-container">
                ${categoriesHtml || '<p style="text-align: center; padding: 40px; color: #aaa;">No inventory items found.</p>'}
            </div>
        </div>
    </div>`;
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

export function attachInventoryEvents(callbacks) {
    const { renderApp, refreshInventory } = callbacks;
}