import { apiGet } from './api.js';
import { state } from './state.js';

export async function loadUsers() {
    state.users = await apiGet('getUsers');
}

export function renderAdminUsersPage() {
    const usersHtml = state.users.map((user) => `
        <tr>
            <td>${user.id}</td>
            <td><strong>${user.username}</strong></td>
            <td><span class="order-status status-${user.role === 'admin' ? 'Complete' : 'Preparing'}" style="background:${user.role === 'admin' ? '#d1fae5' : '#ffe3c9'}">${user.role}</span></td>
            <td><code style="font-size:0.75rem;color:#666;">${user.password_display || '******** (encrypted)'}</code></td>
        </tr>
    `).join('');

    return `
    <div class="admin-page-content">
        <div class="page-header">
            <h1>User Management</h1>
            <p>View all registered users (passwords are securely encrypted)</p>
        </div>
        <div class="panel">
            <h2>System Users</h2>
            <div style="overflow-x:auto;">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Username</th>
                            <th>Role</th>
                            <th>Password Storage</th>
                        </tr>
                    </thead>
                    <tbody>${usersHtml || '<tr><td colspan="4" style="text-align:center;color:#aaa;padding:24px;">No users found.</td></tr>'}</tbody>
                </table>
            </div>
            <div class="alert-banner" style="margin-top:20px;background:#e8f5e9;border-color:#10b981;">
                <strong>Security Notice:</strong> All passwords are stored using bcrypt hashing (one-way encryption).
                Passwords cannot be decrypted and appear as asterisks in the database for security.
            </div>
        </div>
    </div>`;
}
