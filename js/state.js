export const state = {
    currentUser: null,
    customerCart: [],
    currentPage: 'login',
    adminPage: 'menu',
    firstLoad: true,
    menuItems: [],
    categories: [],
    adminCategories: [],
    deletedAdminCategories: [],
    deletedMenuItems: [],
    tags: [],
    orders: [],
    users: [],
    salesByDate: [],
    salesByCustomer: [],
    currentResetToken: null,
    currentResetUsername: null,
    isOrderHistoryOpen: false,
    isCartOpen: false,
    customerMenuSearch: '',
    salesFilter: {
        year: null,
        month: null,
        day: null,
        username: null
    },
    allSalesData: {
        salesByDate: [],
        salesByCustomer: []
    },
    adminOrderFilter: {
        user: '',
        status: ''
    },
    mostOrderedItem: {
        name: 'No data',
        frequency: 0
    },
    salesReport: {
        totalSales: 0,
        orderCount: 0
    },
    orderStats: {
        Preparing: 0,
        Complete: 0,
        Cancelled: 0
    },
    // Used to preserve customer menu state across re-renders
    activeCustomerCategory: null,
    customerScrollPos: 0
};