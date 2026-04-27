import { apiGet } from './api.js';
import { state } from './state.js';

export async function loadUsers() {
    state.users = await apiGet('getUsers');
}

export function renderAdminUsersPage() {
    const usersHtml = state.users.map((user) => `
        <tr>
            <td><strong>${user.username}</strong></td>
            <td><span class="order-status status-${user.role === 'admin' ? 'Complete' : 'Preparing'}" style="background:${user.role === 'admin' ? '#d1fae5' : '#ffe3c9'}">${user.role}</span></td>
        </tr>
    `).join('');

    return `
    <div class="admin-page-content">
        <div class="page-header">
            <h1>User Management</h1>
        </div>
        <div class="panel">
            <h2>System Users</h2>
            <div style="overflow-x:auto;">
                <table>
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Role</th>
                        </tr>
                    </thead>
                    <tbody>${usersHtml || '<tr><td colspan="2" style="text-align:center;color:#aaa;padding:24px;">No users found.</td></tr>'}</tbody>
                </table>
            </div>
        </div>
    </div>`;
}
