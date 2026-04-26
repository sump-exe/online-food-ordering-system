import { apiGet, apiPost } from './api.js';
import { state } from './state.js';

export async function login(username, password) {
    const data = await apiGet('login', { username, password });
    if (data.user) {
        state.currentUser = data.user;
        return true;
    }
    return false;
}

export function logout(renderApp) {
    state.currentUser = null;
    state.customerCart = [];
    state.currentPage = 'login';
    state.adminPage = 'menu';
    state.firstLoad = true;
    state.currentResetToken = null;
    state.currentResetUsername = null;
    state.isOrderHistoryOpen = false;
    renderApp();
}

export async function registerUser(username, password) {
    try {
        const data = await apiPost('register', { username, password });
        return { success: true, message: data.message };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

export async function requestPasswordReset(username, email) {
    return apiPost('forgotPassword', { username, email });
}

export async function resetPassword(token, username, newPassword, confirmPassword) {
    return apiPost('resetPassword', { token, username, newPassword, confirmPassword });
}

export async function verifyResetToken(token, username) {
    try {
        const data = await apiGet('verifyResetToken', { token, username });
        return data.valid;
    } catch {
        return false;
    }
}

export function showRegisterPage(renderInPlace) {
    state.currentPage = 'register';
    renderInPlace();
}

export function showLoginPage(renderInPlace) {
    state.currentPage = 'login';
    state.currentResetToken = null;
    state.currentResetUsername = null;
    renderInPlace();
}

function renderLogin() {
    return `
    <div class="glass-card" style="max-width:500px;margin:60px auto;padding:40px;">
        <div style="text-align:center;margin-bottom:30px;">
            <img src="img/logo.png" alt="FoodieDash" style="max-width:220px;width:100%;height:auto;display:block;margin:0 auto 12px;">
            <p style="color:#666;">Database-Powered Food Ordering System</p>
            <p style="color:#10b981;font-size:0.85rem;margin-top:8px;">Passwords are securely encrypted</p>
        </div>
        <div id="loginMessage"></div>
        <div class="form-group"><label>Username</label><input type="text" id="loginUsername" placeholder="Enter your username"></div>
        <div class="form-group"><label>Password</label><input type="password" id="loginPassword" placeholder="Enter your password"></div>
        <button id="doLoginBtn" class="btn-primary" style="width:100%;padding:14px;">Sign In</button>
        <div style="text-align:center;margin-top:15px;">
            <a class="hyperlink" id="forgotPasswordLink" style="font-size:0.85rem;">Forgot Password?</a>
        </div>
        <div style="text-align:center;margin-top:15px;">
            <span style="color:#666;">Don't have an account? </span>
            <a class="hyperlink" id="goToRegisterLink">Create an Account</a>
        </div>
        <div style="margin-top:30px;padding-top:20px;border-top:1px solid #ffe0c4;">
            <p style="font-size:0.75rem;color:#888;text-align:center;">
                <strong>Demo Accounts:</strong><br>
                Admin: admin / Admin123!<br>
                Customer: john_doe / JohnDoe123!<br>
                <span style="color:#10b981;">All passwords are hashed in the database</span>
            </p>
        </div>
    </div>`;
}

function renderRegister() {
    return `
    <div class="glass-card" style="max-width:500px;margin:60px auto;padding:40px;">
        <div style="text-align:center;margin-bottom:30px;">
            <h1 style="color:#ff5722;margin-top:10px;">Create Account</h1>
            <p style="color:#666;">Join FoodieDash today</p>
            <p style="color:#10b981;font-size:0.85rem;margin-top:8px;">Your password will be encrypted</p>
        </div>
        <div id="registerMessage"></div>
        <div class="form-group"><label>Username</label><input type="text" id="regUsername" placeholder="Choose a username"></div>
        <div class="form-group"><label>Password</label><input type="password" id="regPassword" placeholder="Create a password"></div>
        <div class="form-group"><label>Confirm Password</label><input type="password" id="regConfirmPassword" placeholder="Confirm your password"></div>
        <div style="background:#fff5e6;padding:12px;border-radius:12px;margin-bottom:20px;">
            <small style="color:#ff5722;">Password Requirements:</small><br>
            <small style="color:#666;">- At least 8 characters long</small><br>
            <small style="color:#666;">- At least 1 uppercase letter (A-Z)</small><br>
            <small style="color:#666;">- At least 1 special character (!@#$%^&*())</small>
        </div>
        <button id="doRegisterBtn" class="btn-primary" style="width:100%;padding:14px;">Create Account</button>
        <div style="text-align:center;margin-top:25px;">
            <span style="color:#666;">Already have an account? </span>
            <a class="hyperlink" id="goToLoginLink">Back to Login</a>
        </div>
    </div>`;
}

function renderResetPassword() {
    return `
    <div class="glass-card" style="max-width:500px;margin:60px auto;padding:40px;">
        <div style="text-align:center;margin-bottom:30px;">
            <h1 style="color:#ff5722;margin-top:10px;">Reset Password</h1>
            <p style="color:#666;">Create a new password for your account</p>
        </div>
        <div id="resetPasswordMessage"></div>
        <div class="form-group">
            <label>Username</label>
            <input type="text" id="resetPwdUsername" value="${state.currentResetUsername || ''}" readonly style="background:#f5f5f5;">
        </div>
        <div class="form-group">
            <label>New Password</label>
            <input type="password" id="newPassword" placeholder="Enter new password">
        </div>
        <div class="form-group">
            <label>Confirm New Password</label>
            <input type="password" id="confirmNewPassword" placeholder="Confirm new password">
        </div>
        <div style="background:#fff5e6;padding:12px;border-radius:12px;margin-bottom:20px;">
            <small style="color:#ff5722;">Password Requirements:</small><br>
            <small style="color:#666;">- At least 8 characters long</small><br>
            <small style="color:#666;">- At least 1 uppercase letter (A-Z)</small><br>
            <small style="color:#666;">- At least 1 special character (!@#$%^&*())</small>
        </div>
        <button id="confirmResetBtn" class="btn-primary" style="width:100%;padding:14px;">Reset Password</button>
        <div style="text-align:center;margin-top:20px;">
            <a class="hyperlink" id="backToLoginLink">Back to Login</a>
        </div>
    </div>`;
}

function closeForgotPasswordModal() {
    const modal = document.getElementById('forgotPasswordModal');
    if (modal) {
        modal.remove();
    }
}

function showForgotPasswordDialog() {
    closeForgotPasswordModal();

    const modalHtml = `
        <div id="forgotPasswordModal" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;">
            <div class="glass-card" style="max-width:450px;width:90%;padding:30px;position:relative;">
                <button id="closeForgotPasswordBtn" style="position:absolute;top:15px;right:15px;background:none;border:none;font-size:24px;cursor:pointer;">&times;</button>
                <div style="text-align:center;margin-bottom:20px;">
                    <h2 style="color:#ff5722;margin-top:10px;">Forgot Password?</h2>
                    <p style="color:#666;font-size:0.9rem;">Enter your username to reset your password</p>
                </div>
                <div id="forgotPasswordMessage"></div>
                <div class="form-group">
                    <label>Username</label>
                    <input type="text" id="resetUsername" placeholder="Enter your username">
                </div>
                <div class="form-group">
                    <label>Email (Optional)</label>
                    <input type="email" id="resetEmail" placeholder="Enter your email (optional)">
                </div>
                <button id="requestResetBtn" class="btn-primary" style="width:100%;padding:12px;">Send Reset Link</button>
                <div style="text-align:center;margin-top:20px;">
                    <a class="hyperlink" id="backFromForgotLink">Back to Login</a>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('closeForgotPasswordBtn').addEventListener('click', closeForgotPasswordModal);
    document.getElementById('backFromForgotLink').addEventListener('click', closeForgotPasswordModal);
    document.getElementById('requestResetBtn').addEventListener('click', async () => {
        const username = document.getElementById('resetUsername').value;
        const email = document.getElementById('resetEmail').value;
        const msgDiv = document.getElementById('forgotPasswordMessage');

        if (!username) {
            msgDiv.innerHTML = '<div class="error-message">Please enter your username</div>';
            return;
        }

        try {
            const result = await requestPasswordReset(username, email);
            msgDiv.innerHTML = `
                <div class="success-message">
                    ${result.message}<br><br>
                    <strong>Your reset token:</strong><br>
                    <code style="background:#f0f0f0;padding:5px;display:inline-block;margin:5px 0;">${result.reset_token}</code><br><br>
                    <a href="${result.reset_link}" target="_blank" style="color:#ff5722;">Click here to reset your password</a><br><br>
                    <small>Note: In production, this would be sent to your email.</small>
                </div>
            `;
            setTimeout(closeForgotPasswordModal, 8000);
        } catch (error) {
            msgDiv.innerHTML = `<div class="error-message">${error.message}</div>`;
        }
    });
}

export function renderAuthScreen(root, callbacks) {
    const { renderApp, renderInPlace } = callbacks;

    if (state.currentPage === 'reset-password') {
        root.innerHTML = renderResetPassword();

        document.getElementById('confirmResetBtn').addEventListener('click', async () => {
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmNewPassword').value;
            const msgDiv = document.getElementById('resetPasswordMessage');

            if (!newPassword || !confirmPassword) {
                msgDiv.innerHTML = '<div class="error-message">Please fill all fields</div>';
                return;
            }

            if (newPassword !== confirmPassword) {
                msgDiv.innerHTML = '<div class="error-message">Passwords do not match</div>';
                return;
            }

            try {
                const result = await resetPassword(
                    state.currentResetToken,
                    state.currentResetUsername,
                    newPassword,
                    confirmPassword
                );
                msgDiv.innerHTML = `<div class="success-message">${result.message}</div>`;
                setTimeout(() => showLoginPage(renderInPlace), 3000);
            } catch (error) {
                msgDiv.innerHTML = `<div class="error-message">${error.message}</div>`;
            }
        });

        document.getElementById('backToLoginLink').addEventListener('click', () => showLoginPage(renderInPlace));
        return;
    }

    root.innerHTML = state.currentPage === 'login' ? renderLogin() : renderRegister();

    if (state.currentPage === 'login') {
        document.getElementById('doLoginBtn').addEventListener('click', async () => {
            const username = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;
            const msgDiv = document.getElementById('loginMessage');

            try {
                const ok = await login(username, password);
                if (ok) {
                    await renderApp();
                    return;
                }
                msgDiv.innerHTML = '<div class="error-message">Invalid username or password</div>';
            } catch (error) {
                msgDiv.innerHTML = `<div class="error-message">${error.message}</div>`;
            }

            setTimeout(() => {
                if (msgDiv) {
                    msgDiv.innerHTML = '';
                }
            }, 3000);
        });

        ['loginUsername', 'loginPassword'].forEach((id) => {
            document.getElementById(id).addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    document.getElementById('doLoginBtn').click();
                }
            });
        });

        document.getElementById('forgotPasswordLink').addEventListener('click', showForgotPasswordDialog);
        document.getElementById('goToRegisterLink').addEventListener('click', () => showRegisterPage(renderInPlace));
        return;
    }

    document.getElementById('doRegisterBtn').addEventListener('click', async () => {
        const username = document.getElementById('regUsername').value;
        const password = document.getElementById('regPassword').value;
        const confirmPassword = document.getElementById('regConfirmPassword').value;
        const msgDiv = document.getElementById('registerMessage');

        if (!username || !password) {
            msgDiv.innerHTML = '<div class="error-message">Please fill all fields</div>';
            return;
        }
        if (password !== confirmPassword) {
            msgDiv.innerHTML = '<div class="error-message">Passwords do not match</div>';
            return;
        }

        const result = await registerUser(username, password);
        if (result.success) {
            msgDiv.innerHTML = `<div class="success-message">${result.message}</div>`;
            setTimeout(() => showLoginPage(renderInPlace), 2000);
            return;
        }

        msgDiv.innerHTML = `<div class="error-message">${result.message}</div>`;
        setTimeout(() => {
            if (msgDiv) {
                msgDiv.innerHTML = '';
            }
        }, 3000);
    });

    document.getElementById('goToLoginLink').addEventListener('click', () => showLoginPage(renderInPlace));
}

export function checkForResetToken(renderInPlace) {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const username = urlParams.get('username');

    if (!token || !username) {
        return Promise.resolve();
    }

    return verifyResetToken(token, username).then((isValid) => {
        if (!isValid) {
            alert('Invalid or expired reset link. Please request a new one.');
            return;
        }

        state.currentResetToken = token;
        state.currentResetUsername = username;
        state.currentPage = 'reset-password';
        renderInPlace();
    });
}
