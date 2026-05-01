export const state = {
    currentUser: null,
    customerCart: [],
    currentPage: 'login',
    adminPage: 'menu',
    firstLoad: true,
    menuItems: [],
    categories: [],
    adminCategories: [],
    orders: [],
    users: [],
    salesByDate: [],
    salesByCustomer: [],
    currentResetToken: null,
    currentResetUsername: null,
    isOrderHistoryOpen: false,
    isCartOpen: false,
    adminOrderFilter: {
        user: '',
        status: ''
    },
    salesFilter: {
        year: '',
        month: '',
        day: '',
        user: ''
    },
};