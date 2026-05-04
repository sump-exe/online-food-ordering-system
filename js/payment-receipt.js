import { apiPost, apiGet } from './api.js';
import { state } from './state.js';

let currentReceiptData = null;

export async function processPayment(orderId, totalAmount, paymentMethod, amountPaid) {
    try {
        const result = await apiPost('processPayment', {
            orderId,
            customerId: state.currentUser.userID,
            paymentMethod,
            amountPaid,
            totalAmount
        });

        if (result.success) {
            currentReceiptData = result.payment;
            showPaymentConfirmation(result.payment);
            return result.payment;
        }
    } catch (error) {
        console.error('Payment failed:', error);
        alert('Payment failed: ' + error.message);
    }

    return null;
}

function showPaymentConfirmation(payment) {
    const modalHtml = `
    <div id="paymentConfirmationModal" class="modal-overlay">
        <div class="modal-container" style="max-width: 500px;">
            <div class="modal-header" style="background: linear-gradient(135deg, #10b981, #059669); color: white;">
                <h2 style="color: white;">Payment Successful</h2>
                <button class="modal-close" id="closePaymentModal" style="color: white;">&times;</button>
            </div>
            <div class="modal-body">
                <div style="background: #f0fdf4; padding: 15px; border-radius: 12px; margin-bottom: 20px;">
                    <p><strong>Order ID:</strong> #${payment.order_id}</p>
                    <p><strong>Receipt Number:</strong> ${payment.receipt_number}</p>
                    <p><strong>Date & Time:</strong> ${formatDateTime(payment.transaction_datetime)}</p>
                    <p><strong>Customer:</strong> ${escapeHtml(payment.customer_name)}</p>
                    <p><strong>Payment Method:</strong> ${payment.payment_method}</p>
                    <p><strong>Total Amount:</strong> P${Number(payment.total_amount || 0).toFixed(2)}</p>
                    ${payment.change_amount > 0 ? `<p><strong>Change:</strong> P${Number(payment.change_amount || 0).toFixed(2)}</p>` : ''}
                </div>
            </div>
            <div class="modal-footer" style="justify-content: center; gap: 12px; flex-wrap: wrap;">
                <button id="viewReceiptBtn" class="btn-primary">View Receipt</button>
                <button id="downloadReceiptBtn" class="btn-secondary">Download Receipt (PDF)</button>
                <button id="printPaymentReceiptBtn" class="btn-secondary">Print Receipt</button>
                <button id="homeBtn" class="btn-success">Back to Home</button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById('paymentConfirmationModal');

    document.getElementById('closePaymentModal').addEventListener('click', () => modal.remove());
    document.getElementById('viewReceiptBtn').addEventListener('click', () => {
        modal.remove();
        showReceipt(payment.receipt_number);
    });
    document.getElementById('downloadReceiptBtn').addEventListener('click', () => downloadReceiptPDF(payment.receipt_number));
    document.getElementById('printPaymentReceiptBtn').addEventListener('click', () => printReceipt(payment.receipt_number));
    document.getElementById('homeBtn').addEventListener('click', () => {
        modal.remove();
        window.location.reload();
    });

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.remove();
        }
    });
}

export async function showReceipt(receiptNumber) {
    try {
        const result = await apiGet('getReceipt', { receipt_number: receiptNumber });
        const receipt = result.receipt;
        const receiptHtml = generateReceiptHTML(receipt);

        const modalHtml = `
        <div id="receiptModal" class="modal-overlay">
            <div class="modal-container" style="max-width: 500px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h2>Official Receipt</h2>
                    <button class="modal-close" id="closeReceiptModal">&times;</button>
                </div>
                <div class="modal-body" id="receiptContent">
                    ${receiptHtml}
                </div>
                <div class="modal-footer" style="justify-content: center; gap: 12px;">
                    <button id="printReceiptBtn" class="btn-primary">Print</button>
                    <button id="downloadReceiptPDFBtn" class="btn-secondary">Download PDF</button>
                    <button id="closeReceiptBtn" class="btn-secondary">Close</button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('receiptModal');

        document.getElementById('closeReceiptModal').addEventListener('click', () => modal.remove());
        document.getElementById('closeReceiptBtn').addEventListener('click', () => modal.remove());
        document.getElementById('printReceiptBtn').addEventListener('click', () => printReceipt(receiptNumber));
        document.getElementById('downloadReceiptPDFBtn').addEventListener('click', () => downloadReceiptPDF(receiptNumber));

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.remove();
            }
        });
    } catch (error) {
        console.error('Failed to load receipt:', error);
        alert('Failed to load receipt: ' + error.message);
    }
}

function generateReceiptHTML(receipt) {
    const itemsHtml = (receipt.items || []).map((item) => `
        <tr>
            <td style="padding: 8px 4px;">${escapeHtml(item.item_name)}</td>
            <td style="padding: 8px 4px; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px 4px; text-align: right;">P${Number(item.unit_price || 0).toFixed(2)}</td>
            <td style="padding: 8px 4px; text-align: right;">P${Number(item.subtotal || 0).toFixed(2)}</td>
        </tr>
    `).join('');

    return `
    <div class="receipt" style="font-family: monospace; font-size: 12px;">
        <div style="text-align: center; border-bottom: 1px dashed #ccc; padding-bottom: 10px; margin-bottom: 10px;">
            <h2 style="margin: 0; color: #ff5722;">FoodieDash</h2>
            <p style="margin: 5px 0;">123 Food Street, Manila</p>
            <p style="margin: 5px 0;">Tel: (02) 1234-5678</p>
            <p style="margin: 5px 0; font-weight: bold;">OFFICIAL RECEIPT</p>
        </div>

        <div style="margin-bottom: 10px;">
            <p><strong>Receipt #:</strong> ${receipt.receipt_number}</p>
            <p><strong>Order #:</strong> ${receipt.order_id}</p>
            <p><strong>Date:</strong> ${formatDateTime(receipt.transaction_datetime)}</p>
            <p><strong>Cashier:</strong> ${receipt.generated_by || 'System'}</p>
            <p><strong>Customer:</strong> ${escapeHtml(receipt.customer_name)}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
            <thead>
                <tr>
                    <th style="text-align: left;">Item</th>
                    <th style="text-align: center;">Qty</th>
                    <th style="text-align: right;">Price</th>
                    <th style="text-align: right;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
            </tbody>
        </table>

        <div style="border-top: 1px dashed #ccc; padding-top: 10px;">
            <p><strong>Subtotal:</strong> <span style="float: right;">P${Number(receipt.subtotal || 0).toFixed(2)}</span></p>
            <p><strong>Tax:</strong> <span style="float: right;">P${Number(receipt.tax || 0).toFixed(2)}</span></p>
            <p><strong>Total:</strong> <span style="float: right;">P${Number(receipt.total_amount || 0).toFixed(2)}</span></p>
            <p><strong>Payment:</strong> ${receipt.payment_method}</p>
            <p><strong>Amount Paid:</strong> <span style="float: right;">P${Number(receipt.amount_paid || 0).toFixed(2)}</span></p>
            ${receipt.change_amount > 0 ? `<p><strong>Change:</strong> <span style="float: right;">P${Number(receipt.change_amount || 0).toFixed(2)}</span></p>` : ''}
        </div>

        <div style="text-align: center; border-top: 1px dashed #ccc; padding-top: 10px; margin-top: 10px;">
            <p>Thank you for ordering at FoodieDash!</p>
            <p>This serves as your official receipt.</p>
            <p>Rate your order on our app</p>
        </div>
    </div>`;
}

async function downloadReceiptPDF(receiptNumber) {
    try {
        const result = await apiGet('getReceipt', { receipt_number: receiptNumber });
        const receipt = result.receipt;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>Receipt ${receiptNumber}</title>
                <style>
                    body { font-family: monospace; padding: 20px; }
                    .receipt { max-width: 400px; margin: 0 auto; }
                    @media print {
                        body { margin: 0; padding: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                ${generateReceiptHTML(receipt)}
                <div class="no-print" style="text-align: center; margin-top: 20px;">
                    <button onclick="window.print()">Print</button>
                    <button onclick="window.close()">Close</button>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
    } catch (error) {
        console.error('Failed to generate PDF:', error);
        alert('Failed to generate PDF: ' + error.message);
    }
}

async function printReceipt(receiptNumber) {
    try {
        const result = await apiGet('getReceipt', { receipt_number: receiptNumber });
        const receipt = result.receipt;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>Receipt ${receiptNumber}</title>
                <style>
                    body { font-family: monospace; padding: 20px; }
                    .receipt { max-width: 80mm; margin: 0 auto; }
                    @media print {
                        body { margin: 0; padding: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                ${generateReceiptHTML(receipt)}
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    } catch (error) {
        console.error('Failed to print receipt:', error);
        alert('Failed to print receipt: ' + error.message);
    }
}

function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return '-';
    const date = new Date(dateTimeStr);
    return date.toLocaleString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
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
