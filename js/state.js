export const state = {
    currentUser: null,
    customerCart: [],
    currentPage: 'login',
    adminPage: 'menu',
    firstLoad: true,
    customerMenuSearch: '',
    menuItems: [],
    deletedMenuItems: [],
    categories: [],
    adminCategories: [],
    deletedAdminCategories: [],
    orders: [],
    users: [],
    salesByDate: [],
    salesByCustomer: [],
    currentResetToken: null,
    currentResetUsername: null,
    isOrderHistoryOpen: false,
    isCartOpen: false,
    salesFilter: {
        period: 'monthly',
        startDate: null,
        endDate: null
    },
    salesReport: {
        totalSales: 0,
        orderCount: 0
    },
    orderStats: {
        Preparing: 0,
        Complete: 0,
        Cancelled: 0
    }
};
