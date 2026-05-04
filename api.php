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
require __DIR__ . '/api/category-management-admin.php';
require __DIR__ . '/api/tags-management-admin.php';

$routes = [
    'login' => $loginActions,
    'cart_user' => $userCartActions,
    'order_history_user' => $userOrderHistoryActions,
    'menu_user' => $userMenuActions,
    'menu_inventory_admin' => $adminMenuInventoryActions,
    'sales_report_admin' => $adminSalesReportActions,
    'order_history_admin' => $adminOrderHistoryActions,
    'users_management_admin' => $adminUsersManagementActions,
    'category_management_admin' => $adminCategoryActions,
    'tags_management_admin' => $adminTagsActions,
];

$actionMap = [
    // Login & Authentication
    'login' => ['group' => 'login', 'handler' => 'login'],
    'register' => ['group' => 'login', 'handler' => 'register'],
    'forgotPassword' => ['group' => 'login', 'handler' => 'forgotPassword'],
    'resetPassword' => ['group' => 'login', 'handler' => 'resetPassword'],
    'verifyResetToken' => ['group' => 'login', 'handler' => 'verifyResetToken'],
    
    // Cart & Orders
    'createOrder' => ['group' => 'cart_user', 'handler' => 'createOrder'],
    
    // Order History
    'getOrders' => [
        'group' => isset($_GET['customerId']) ? 'order_history_user' : 'order_history_admin',
        'handler' => isset($_GET['customerId']) ? 'getOrders' : 'getAllOrders',
    ],
    'updateOrderStatus' => [
        'group' => (($body['status'] ?? '') === 'Cancelled') ? 'order_history_user' : 'order_history_admin',
        'handler' => (($body['status'] ?? '') === 'Cancelled') ? 'updateOrderStatus' : 'updateOrderStatusAdmin',
    ],
    'getOrderDetails' => ['group' => 'order_history_admin', 'handler' => 'getOrderDetails'],
    
    // Menu (User)
    'getMenuItems' => ['group' => 'menu_user', 'handler' => 'getMenuItems'],
    'getCategories' => ['group' => 'menu_user', 'handler' => 'getCategories'],
    
    // Admin Menu & Inventory
    'addMenuItem' => ['group' => 'menu_inventory_admin', 'handler' => 'addMenuItem'],
    'getMenuItem' => ['group' => 'menu_inventory_admin', 'handler' => 'getMenuItem'],
    'updateMenuItem' => ['group' => 'menu_inventory_admin', 'handler' => 'updateMenuItem'],
    'deleteMenuItem' => ['group' => 'menu_inventory_admin', 'handler' => 'deleteMenuItem'],
    'updateStock' => ['group' => 'menu_inventory_admin', 'handler' => 'updateStock'],
    'updatePrice' => ['group' => 'menu_inventory_admin', 'handler' => 'updatePrice'],
    
    // Admin Sales Reports
    'getSalesReport' => ['group' => 'sales_report_admin', 'handler' => 'getSalesReport'],
    'getOrderStats' => ['group' => 'sales_report_admin', 'handler' => 'getOrderStats'],
    'getSalesByDate' => ['group' => 'sales_report_admin', 'handler' => 'getSalesByDate'],
    'getSalesByCustomer' => ['group' => 'sales_report_admin', 'handler' => 'getSalesByCustomer'],
    
    // Admin Users Management
    'getUsers' => ['group' => 'users_management_admin', 'handler' => 'getUsers'],
    
    // Admin Category Management
    'getAdminCategories' => ['group' => 'category_management_admin', 'handler' => 'getCategories'],
    'getCategoriesByType' => ['group' => 'category_management_admin', 'handler' => 'getCategoriesByType'],
    'getMenuItemsByCategory' => ['group' => 'category_management_admin', 'handler' => 'getMenuItemsByCategory'],
    'addCategory' => ['group' => 'category_management_admin', 'handler' => 'addCategory'],
    'updateCategory' => ['group' => 'category_management_admin', 'handler' => 'updateCategory'],
    'deleteCategory' => ['group' => 'category_management_admin', 'handler' => 'deleteCategory'],
    'reassignMenuItems' => ['group' => 'category_management_admin', 'handler' => 'reassignMenuItems'],
    
    // Admin Tags Management
    'getTags' => ['group' => 'tags_management_admin', 'handler' => 'getTags'],
    'addTag' => ['group' => 'tags_management_admin', 'handler' => 'addTag'],
    'updateTag' => ['group' => 'tags_management_admin', 'handler' => 'updateTag'],
    'deleteTag' => ['group' => 'tags_management_admin', 'handler' => 'deleteTag'],
    'getTagById' => ['group' => 'tags_management_admin', 'handler' => 'getTagById'],
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