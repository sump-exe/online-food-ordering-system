import { apiPost } from './api.js';
import { state } from './state.js';
import { processPayment } from './payment-receipt.js';

let cartSaveTimeout = null;
let isCheckingOut = false;

export function addToCart(item, renderInPlace) {
    const existing = state.customerCart.find((entry) => entry.ItemID === item.itemID);

    if (existing) {
        if (existing.quantity + 1 > item.stock) {
            alert(`Only ${item.stock} items left in stock!`);
            return;
        }
        existing.quantity += 1;
    } else {
        if (item.stock === 0) {
            alert('Item is out of stock!');
            return;
        }
        state.customerCart.push({
            ItemID: item.itemID,
            name: item.name,
            price: item.price,
            quantity: 1,
            maxStock: item.stock,
        });
    }

    debouncedCartSync();
    renderInPlace();
}

export function removeFromCart(itemId, renderInPlace) {
    state.customerCart = state.customerCart.filter((item) => item.ItemID !== itemId);
    debouncedCartSync();
    renderInPlace();
}

export function updateQuantity(itemId, delta, renderInPlace) {
    const index = state.customerCart.findIndex((item) => item.ItemID === itemId);
    if (index === -1) {
        return;
    }

    const nextQty = state.customerCart[index].quantity + delta;
    const maxStock = state.customerCart[index].maxStock;

    if (nextQty <= 0) {
        state.customerCart.splice(index, 1);
    } else if (nextQty > maxStock) {
        alert(`Cannot add more than ${maxStock} items`);
        return;
    } else {
        state.customerCart[index].quantity = nextQty;
    }

    debouncedCartSync();
    renderInPlace();
}

export function getCartTotal() {
    return state.customerCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

export async function placeOrder(renderApp) {
    if (!state.currentUser || state.currentUser.role !== 'customer') {
        alert('Please login as customer');
        return;
    }
    if (state.customerCart.length === 0) {
        alert('Cart is empty');
        return;
    }

    showPaymentMethodModal(async (paymentMethod, amountPaid) => {
        try {
            await createOrderAndProcessPayment({ paymentMethod, amountPaid });
            await renderApp();
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    });
}

async function createOrderAndProcessPayment({ paymentMethod = 'Cash', amountPaid = null } = {}) {
    if (!state.currentUser || state.currentUser.role !== 'customer') {
        throw new Error('Please login as customer');
    }
    if (state.customerCart.length === 0) {
        throw new Error('Cart is empty');
    }

    isCheckingOut = true;
    if (cartSaveTimeout) {
        clearTimeout(cartSaveTimeout);
        cartSaveTimeout = null;
    }

    const totalAmount = getCartTotal();
    const totalAmountPesos = totalAmount / 100;
    const finalAmountPaid = amountPaid ?? totalAmountPesos;
    const cartItems = state.customerCart.map((item) => ({
        itemID: item.ItemID,
        quantity: item.quantity,
        price: item.price,
    }));

    const order = await apiPost('createOrder', {
        customerId: state.currentUser.userID,
        totalPayment: totalAmount,
        cartItems,
        paymentMethod,
        amountPaid: finalAmountPaid,
    });

    const payment = await processPayment(
        order.OrderID,
        totalAmountPesos,
        paymentMethod,
        finalAmountPaid
    );

    if (!payment) {
        throw new Error('Payment processing failed.');
    }

    for (const cartItem of cartItems) {
        const menuItem = state.menuItems.find((item) => item.itemID === cartItem.itemID);
        if (menuItem) {
            menuItem.stock = Math.max(0, Number(menuItem.stock || 0) - cartItem.quantity);
            menuItem.available = menuItem.stock > 0;
        }
    }

    state.customerCart = [];
    isCheckingOut = false;
    return { order, payment };
}

function showPaymentMethodModal(callback) {
    const total = getCartTotal() / 100;

    const modalHtml = `
    <div id="paymentModal" class="modal-overlay">
        <div class="modal-container" style="max-width: 450px;">
            <div class="modal-header">
                <h2>Payment Method</h2>
                <button class="modal-close" id="closePaymentModal">&times;</button>
            </div>
            <div class="modal-body">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h3>Total Amount: P${total.toFixed(2)}</h3>
                </div>
                <div class="form-group">
                    <label>Select Payment Method:</label>
                    <select id="paymentMethodSelect" class="form-control">
                        <option value="Cash">Cash</option>
                        <option value="GCash">GCash</option>
                        <option value="Card">Credit/Debit Card</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                </div>
                <div class="form-group" id="amountPaidGroup">
                    <label>Amount Paid:</label>
                    <input type="number" id="amountPaid" step="0.01" min="${total}" value="${total}" class="form-control">
                    <small id="changeDisplay" style="color: #10b981;"></small>
                </div>
            </div>
            <div class="modal-footer">
                <button id="cancelPaymentBtn" class="btn-secondary">Cancel</button>
                <button id="confirmPaymentBtn" class="btn-primary">Confirm Payment</button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById('paymentModal');
    const paymentMethodSelect = document.getElementById('paymentMethodSelect');
    const amountPaidInput = document.getElementById('amountPaid');
    const changeDisplay = document.getElementById('changeDisplay');

    const updateChangeDisplay = () => {
        const amountPaid = parseFloat(amountPaidInput.value) || 0;
        const change = amountPaid - total;

        changeDisplay.style.color = change < 0 ? '#dc2626' : '#10b981';

        if (change > 0) {
            changeDisplay.textContent = `Change: P${change.toFixed(2)}`;
        } else if (change === 0) {
            changeDisplay.textContent = 'Exact amount';
        } else {
            changeDisplay.textContent = `Need P${Math.abs(change).toFixed(2)} more`;
        }
    };

    amountPaidInput.addEventListener('input', updateChangeDisplay);
    paymentMethodSelect.addEventListener('change', () => {
        document.getElementById('amountPaidGroup').style.display =
            paymentMethodSelect.value === 'Cash' ? 'block' : 'none';
    });

    updateChangeDisplay();

    const closeModal = () => modal.remove();

    document.getElementById('closePaymentModal').addEventListener('click', closeModal);
    document.getElementById('cancelPaymentBtn').addEventListener('click', closeModal);
    document.getElementById('confirmPaymentBtn').addEventListener('click', () => {
        const method = paymentMethodSelect.value;
        let amountPaid = total;

        if (method === 'Cash') {
            amountPaid = parseFloat(amountPaidInput.value) || 0;
            if (amountPaid < total) {
                alert(`Insufficient amount. Please pay at least P${total.toFixed(2)}`);
                return;
            }
        }

        modal.remove();
        callback(method, amountPaid);
    });

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });
}

async function syncCartToDb() {
    if (isCheckingOut) {
        return;
    }
    if (!state.currentUser || state.currentUser.role !== 'customer') {
        return;
    }
    if (state.customerCart.length === 0) {
        return;
    }

    const cartItems = state.customerCart.map((item) => ({
        itemID: item.ItemID,
        quantity: item.quantity,
        price: item.price,
    }));

    try {
        await apiPost('saveCartToDb', {
            customerId: state.currentUser.userID,
            cartItems,
        });
    } catch (error) {
        console.error('Failed to sync cart to DB:', error.message);
    }
}

function debouncedCartSync() {
    if (cartSaveTimeout) {
        clearTimeout(cartSaveTimeout);
    }
    cartSaveTimeout = setTimeout(syncCartToDb, 500);
}

export async function loadCartFromDb() {
    if (!state.currentUser || state.currentUser.role !== 'customer') {
        return;
    }

    try {
        const result = await apiPost('loadCartFromDb', {
            customerId: state.currentUser.userID,
        });

        state.customerCart = result.cartItems && result.cartItems.length > 0
            ? result.cartItems
            : [];
    } catch (error) {
        console.error('Failed to load cart from DB:', error.message);
        state.customerCart = [];
    }
}

// NOTE: renderApp is intentionally NOT called here.
// The caller (payment-confirmation.js) is responsible for showing the
// success modal first and only calling renderApp when the user dismisses it.
export async function confirmPayment(options = {}) {
    const { paymentMethod = 'Cash', amountPaid = null } = options;
    try {
        return await createOrderAndProcessPayment({ paymentMethod, amountPaid });
    } finally {
        isCheckingOut = false;
    }
}
