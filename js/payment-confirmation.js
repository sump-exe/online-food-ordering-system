import { state } from './state.js';

export function getCartSummaryHtml() {
    if (state.customerCart.length === 0) {
        return '<p style="text-align:center;color:#aaa;padding:32px 0;">No items in cart</p>';
    }

    let itemsHtml = '';
    let subtotal = 0;
    for (const item of state.customerCart) {
        const lineTotal = item.price * item.quantity;
        subtotal += lineTotal;
        itemsHtml += `
            <div class="payment-item">
                <span>
                    <strong>${escapeHtml(item.name)}</strong><br>
                    <small style="color:#7a6070;">P${(item.price / 100).toFixed(2)} x ${item.quantity}</small>
                </span>
                <span>P${(lineTotal / 100).toFixed(2)}</span>
            </div>`;
    }

    return `
        <div style="margin-bottom:24px;">
            ${itemsHtml}
            <div style="border-top:2px solid #ffe0c4;margin-top:16px;padding-top:16px;">
                <div style="display:flex;justify-content:space-between;font-weight:700;font-size:1.1rem;">
                    <span>Total:</span>
                    <span>P${(subtotal / 100).toFixed(2)}</span>
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

export function openPaymentConfirmationDrawer(renderInPlace, renderApp) {
    const existingDrawer = document.getElementById('paymentDrawer');
    const existingOverlay = document.getElementById('paymentOverlay');
    if (existingDrawer) existingDrawer.remove();
    if (existingOverlay) existingOverlay.remove();

    if (state.customerCart.length === 0) {
        alert('Cart is empty');
        return;
    }

    const summaryHtml = getCartSummaryHtml();
    const totalPaid = state.customerCart.reduce((sum, item) => sum + (item.price * item.quantity), 0) / 100;

    const drawerHtml = `
    <div id="paymentOverlay" class="payment-overlay open"></div>
    <aside id="paymentDrawer" class="payment-drawer open">
        <div class="order-history-drawer-header">
            <div>
                <div class="order-history-kicker">Secure Checkout</div>
                <h2>Confirm Payment</h2>
            </div>
            <button class="btn-secondary order-history-close" id="closePaymentBtn">Close</button>
        </div>
        <div class="order-history-drawer-body">
            <div id="paymentMessage"></div>

            <div class="payment-method-info">
                <div class="payment-method-title">Payment Method: Cash on Counter</div>
                <small>Pay cash when your order is ready for pickup or delivery.</small>
            </div>

            ${summaryHtml}

            <div style="display:flex;gap:12px;">
                <button id="confirmPaymentBtn" class="btn-primary" style="flex:1;padding:14px;font-weight:700;">Confirm Payment</button>
                <button id="cancelPaymentBtn" class="btn-secondary" style="flex:1;padding:14px;">Cancel</button>
            </div>
        </div>
    </aside>`;

    document.body.insertAdjacentHTML('beforeend', drawerHtml);

    const closePayment = () => {
        document.getElementById('paymentDrawer')?.remove();
        document.getElementById('paymentOverlay')?.remove();
    };

    document.getElementById('closePaymentBtn')?.addEventListener('click', closePayment);
    document.getElementById('paymentOverlay')?.addEventListener('click', closePayment);
    document.getElementById('cancelPaymentBtn')?.addEventListener('click', closePayment);

    document.getElementById('confirmPaymentBtn')?.addEventListener('click', async () => {
        const msgDiv = document.getElementById('paymentMessage');

        try {
            msgDiv.innerHTML = '<div style="text-align:center;padding:20px;"><div style="width:24px;height:24px;border:2px solid #ffe0c4;border-top:2px solid #ff5722;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 12px;"></div>Processing your order...</div>';

            const result = await import('./cart-user.js').then((module) => {
                return module.confirmPayment({
                    paymentMethod: 'Cash',
                    amountPaid: totalPaid,
                    renderApp
                });
            });

            msgDiv.innerHTML = `<div class="success-message" style="text-align:center;padding:20px;">
                <div style="font-size:1.4rem;font-weight:800;color:#10b981;margin-bottom:8px;">Order #${result.order.OrderID} Confirmed!</div>
                <div style="font-size:0.95rem;color:#6c757d;margin-bottom:12px;">Receipt ${result.payment.receipt_number} | Total: P${result.payment.total_amount.toFixed(2)}</div>
            </div>`;

            setTimeout(() => {
                closePayment();
            }, 2500);
        } catch (error) {
            msgDiv.innerHTML = `<div class="error-message">${error.message}</div>`;
        }
    });
}
