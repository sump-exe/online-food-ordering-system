<?php

require __DIR__ . '/api/bootstrap.php';
require __DIR__ . '/api/login.php';
require __DIR__ . '/api/cart-user.php';
require __DIR__ . '/api/order-history-user.php';
require __DIR__ . '/api/menu-user.php';
require __DIR__ . '/api/menu-inventory-admin.php';
require __DIR__ . '/api/sales-report-admin.php';
require __DIR__ . '/api/order-history-admin.php';
require __DIR__ . '/api/users-management-admin.php';

$routes = [
    'login' => $loginActions,
    'cart_user' => $userCartActions,
    'order_history_user' => $userOrderHistoryActions,
    'menu_user' => $userMenuActions,
    'menu_inventory_admin' => $adminMenuInventoryActions,
    'sales_report_admin' => $adminSalesReportActions,
    'order_history_admin' => $adminOrderHistoryActions,
    'users_management_admin' => $adminUsersManagementActions,
];

$actionMap = [
    'login' => ['group' => 'login', 'handler' => 'login'],
    'register' => ['group' => 'login', 'handler' => 'register'],
    'forgotPassword' => ['group' => 'login', 'handler' => 'forgotPassword'],
    'resetPassword' => ['group' => 'login', 'handler' => 'resetPassword'],
    'verifyResetToken' => ['group' => 'login', 'handler' => 'verifyResetToken'],
    'getAccountSettings' => ['group' => 'login', 'handler' => 'getAccountSettings'],
    'updateAccountSettings' => ['group' => 'login', 'handler' => 'updateAccountSettings'],
    'createOrder' => ['group' => 'cart_user', 'handler' => 'createOrder'],
    'getOrders' => [
        'group' => isset($_GET['customerId']) ? 'order_history_user' : 'order_history_admin',
        'handler' => isset($_GET['customerId']) ? 'getOrders' : 'getAllOrders',
    ],
    'updateOrderStatus' => [
        'group' => (($body['status'] ?? '') === 'Cancelled') ? 'order_history_user' : 'order_history_admin',
        'handler' => (($body['status'] ?? '') === 'Cancelled') ? 'updateOrderStatus' : 'updateOrderStatusAdmin',
    ],
    'getMenuItems' => ['group' => 'menu_user', 'handler' => 'getMenuItems'],
    'getCategories' => ['group' => 'menu_user', 'handler' => 'getCategories'],
    'addMenuItem' => ['group' => 'menu_inventory_admin', 'handler' => 'addMenuItem'],
    'updateStock' => ['group' => 'menu_inventory_admin', 'handler' => 'updateStock'],
    'updatePrice' => ['group' => 'menu_inventory_admin', 'handler' => 'updatePrice'],
    'getAdminSalesReport' => ['group' => 'sales_report_admin', 'handler' => 'getAdminSalesReport'],
    'getUsers' => ['group' => 'users_management_admin', 'handler' => 'getUsers'],
];

if (!isset($actionMap[$action])) {
    respondError("Unknown action: '$action'", 404);
}

$route = $actionMap[$action];
$handler = $routes[$route['group']][$route['handler']] ?? null;

if (!$handler) {
    respondError("No handler found for action: '$action'", 500);
}

$handler($conn, $body);

$conn->close();
