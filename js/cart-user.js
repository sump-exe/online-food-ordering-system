import { apiPost } from './api.js';
import { state } from './state.js';

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

    renderInPlace();
}

export function removeFromCart(itemId, renderInPlace) {
    state.customerCart = state.customerCart.filter((item) => item.ItemID !== itemId);
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

    try {
        const totalAmount = getCartTotal();
        const cartItems = state.customerCart.map((item) => ({
            itemID: item.ItemID,
            quantity: item.quantity,
            price: item.price,
        }));

        const result = await apiPost('createOrder', {
            customerId: state.currentUser.userID,
            totalPayment: totalAmount,
            cartItems,
        });

        state.customerCart = [];
        alert(
            `Order #${result.OrderID} placed!\n` +
            `Total: P${(totalAmount / 100).toFixed(2)}\n` +
            `Payment Reference: ${result.referenceNumber}`
        );
        await renderApp();
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}
