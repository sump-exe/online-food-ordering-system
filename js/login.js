import { apiGet, apiPost } from './api.js';
import { state } from './state.js';

const logoUrl = new URL('../img/logo.png', import.meta.url).href;

export async function login(username, password) {
    const data = await apiGet('login', { username, password });
    if (data.user) {
        state.currentUser = data.user;
        return true;
    }
    return false;
}

export function logout(renderApp) {
    if (!window.confirm('Are you sure you want to log out?')) {
        return;
    }

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

export async function registerUser(username, password, email) {
    try {
        const data = await apiPost('register', { username, password, email });
        return { success: true, message: data.message, email: data.email };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

export async function verifyRegistration(username, otp, password) {
    try {
        const data = await apiPost('verifyRegistration', { username, otp, password });
        return { 
            success: true, 
            message: data.message,
            user: data.user
        };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

export async function requestPasswordReset(username, email) {
    return apiPost('forgotPassword', { username, email });
}

export async function verifyOTP(username, otp, email = '') {
    return apiPost('verifyOTP', { username, otp, email });
}

export async function resendOTP(username) {
    return apiPost('resendOTP', { username });
}

export async function resetPassword(otp, username, newPassword, confirmPassword) {
    return apiPost('resetPassword', { otp, username, newPassword, confirmPassword });
}

export async function verifyResetToken(token, username) {
    try {
        const data = await apiGet('verifyResetToken', { token, username });
        return data.valid;
    } catch {
        return false;
    }
}

export async function deleteAccount(customerId, password) {
    return apiPost('deleteAccount', { customerId, password });
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
            <img src="${logoUrl}" alt="FoodieDash" style="max-width:220px;width:100%;height:auto;display:block;margin:0 auto 12px;">
            <p style="color:#666;">Online Food Ordering System</p>
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
        
        <!-- Step 1: Initial Registration -->
        <div id="registerStep1">
            <div class="form-group"><label>Username</label><input type="text" id="regUsername" placeholder="Choose a username"></div>
            <div class="form-group"><label>Email</label><input type="email" id="regEmail" placeholder="Enter your email"></div>
            <div class="form-group"><label>Password</label><input type="password" id="regPassword" placeholder="Create a password"></div>
            <div class="form-group"><label>Confirm Password</label><input type="password" id="regConfirmPassword" placeholder="Confirm your password"></div>
            <div style="background:#fff5e6;padding:12px;border-radius:12px;margin-bottom:20px;">
                <small style="color:#ff5722;">Password Requirements:</small><br>
                <small style="color:#666;">- At least 8 characters long</small><br>
                <small style="color:#666;">- At least 1 uppercase letter (A-Z)</small><br>
                <small style="color:#666;">- At least 1 special character (!@#$%^&*())</small>
            </div>
            <button id="doRegisterBtn" class="btn-primary" style="width:100%;padding:14px;">Send Verification OTP</button>
        </div>
        
        <!-- Step 2: OTP Verification -->
        <div id="registerStep2" style="display:none;">
            <div class="form-group">
                <label>Enter Verification OTP</label>
                <input type="text" id="regOtpInput" placeholder="Enter 6-digit OTP" maxlength="6" style="text-align:center;letter-spacing:8px;font-size:18px;">
            </div>
            <div class="form-group">
                <label>Password</label>
                <input type="password" id="regOtpPassword" placeholder="Enter your password">
            </div>
            <div class="form-group">
                <label>Confirm Password</label>
                <input type="password" id="regOtpConfirmPassword" placeholder="Confirm your password">
            </div>
            <button id="verifyRegBtn" class="btn-primary" style="width:100%;padding:14px;">Verify & Create Account</button>
        </div>
        
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
                    <p style="color:#666;font-size:0.9rem;">Enter your username to receive an OTP via email</p>
                </div>
                <div id="forgotPasswordMessage"></div>
                <div id="forgotPasswordStep1">
                    <div class="form-group">
                        <label>Username</label>
                        <input type="text" id="resetUsername" placeholder="Enter your username">
                    </div>
                    <button id="requestResetBtn" class="btn-primary" style="width:100%;padding:12px;">Send OTP</button>
                </div>
                <div id="forgotPasswordStep2" style="display:none;">
                    <div class="form-group">
                        <label>Enter OTP</label>
                        <input type="text" id="otpInput" placeholder="Enter 6-digit OTP" maxlength="6" style="text-align:center;letter-spacing:8px;font-size:18px;">
                    </div>
                    <button id="verifyOtpBtn" class="btn-primary" style="width:100%;padding:12px;">Verify OTP</button>
                    <div style="text-align:center;margin-top:15px;">
                        <small style="color:#666;">Didn't receive it? </small>
                        <a class="hyperlink" id="resendOtpLink">Resend OTP</a>
                    </div>
                </div>
                <div id="forgotPasswordStep3" style="display:none;">
                    <div class="form-group">
                        <label>New Password</label>
                        <input type="password" id="newResetPassword" placeholder="Enter new password">
                    </div>
                    <div class="form-group">
                        <label>Confirm New Password</label>
                        <input type="password" id="confirmResetPassword" placeholder="Confirm new password">
                    </div>
                    <button id="confirmResetBtn" class="btn-primary" style="width:100%;padding:12px;">Reset Password</button>
                </div>
                <div style="text-align:center;margin-top:20px;">
                    <a class="hyperlink" id="backFromForgotLink">Back to Login</a>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

let currentUsername = '';
    let currentEmail = '';
    let currentOTP = '';

    document.getElementById('closeForgotPasswordBtn').addEventListener('click', closeForgotPasswordModal);
    document.getElementById('backFromForgotLink').addEventListener('click', closeForgotPasswordModal);
    
    // Step 1: Request OTP
    document.getElementById('requestResetBtn').addEventListener('click', async () => {
        const username = document.getElementById('resetUsername').value;
        const msgDiv = document.getElementById('forgotPasswordMessage');

        if (!username) {
            msgDiv.innerHTML = '<div class="error-message">Please enter your username</div>';
            return;
        }

try {
            const result = await requestPasswordReset(username, '');
            currentUsername = username;
            currentEmail = result.email || ''; // Capture the email from response
            msgDiv.innerHTML = `
                <div class="success-message">
                    ${result.message}<br><br>
                    OTP sent to: <strong>${result.email}</strong>
                </div>
            `;
            // Show Step 2
            document.getElementById('forgotPasswordStep1').style.display = 'none';
            document.getElementById('forgotPasswordStep2').style.display = 'block';
            document.getElementById('otpInput').focus();
        } catch (error) {
            msgDiv.innerHTML = `<div class="error-message">${error.message}</div>`;
        }
    });

    // Step 2: Verify OTP
    document.getElementById('verifyOtpBtn').addEventListener('click', async () => {
        const otp = document.getElementById('otpInput').value;
        const msgDiv = document.getElementById('forgotPasswordMessage');

        if (!otp || otp.length !== 6) {
            msgDiv.innerHTML = '<div class="error-message">Please enter a valid 6-digit OTP</div>';
            return;
        }

try {
            const result = await verifyOTP(currentUsername, otp, currentEmail); // Pass email for verification
            currentOTP = otp;
            msgDiv.innerHTML = '<div class="success-message">OTP verified! Now set your new password.</div>';
            // Show Step 3
            document.getElementById('forgotPasswordStep2').style.display = 'none';
            document.getElementById('forgotPasswordStep3').style.display = 'block';
            document.getElementById('newResetPassword').focus();
        } catch (error) {
            msgDiv.innerHTML = `<div class="error-message">${error.message}</div>`;
        }
    });

    // Resend OTP
    document.getElementById('resendOtpLink').addEventListener('click', async () => {
        const msgDiv = document.getElementById('forgotPasswordMessage');
        
        try {
            const result = await resendOTP(currentUsername);
            msgDiv.innerHTML = `
                <div class="success-message">
                    ${result.message}<br><br>
                    OTP sent to: <strong>${result.email}</strong>
                </div>
            `;
        } catch (error) {
            msgDiv.innerHTML = `<div class="error-message">${error.message}</div>`;
        }
    });

    // Step 3: Reset Password
    document.getElementById('confirmResetBtn').addEventListener('click', async () => {
        const newPassword = document.getElementById('newResetPassword').value;
        const confirmPassword = document.getElementById('confirmResetPassword').value;
        const msgDiv = document.getElementById('forgotPasswordMessage');

        if (!newPassword || !confirmPassword) {
            msgDiv.innerHTML = '<div class="error-message">Please fill all password fields</div>';
            return;
        }

        if (newPassword !== confirmPassword) {
            msgDiv.innerHTML = '<div class="error-message">Passwords do not match</div>';
            return;
        }

try {
            const result = await resetPassword(currentOTP, currentUsername, newPassword, confirmPassword, currentEmail);
            msgDiv.innerHTML = `<div class="success-message">${result.message}</div>`;
            setTimeout(() => {
                closeForgotPasswordModal();
                showLoginPage(window.renderApp);
            }, 3000);
        } catch (error) {
            msgDiv.innerHTML = `<div class="error-message">${error.message}</div>`;
        }
    });

    // Allow Enter key navigation through steps
    document.getElementById('resetUsername')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('requestResetBtn').click();
    });
    document.getElementById('otpInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('verifyOtpBtn').click();
    });
    document.getElementById('confirmResetPassword')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('confirmResetBtn').click();
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
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const confirmPassword = document.getElementById('regConfirmPassword').value;
        const msgDiv = document.getElementById('registerMessage');

        if (!username || !email || !password) {
            msgDiv.innerHTML = '<div class="error-message">Please fill all fields</div>';
            return;
        }
        if (password !== confirmPassword) {
            msgDiv.innerHTML = '<div class="error-message">Passwords do not match</div>';
            return;
        }

        const result = await registerUser(username, password, email);
        if (result.success) {
            msgDiv.innerHTML = `
                <div class="success-message">
                    ${result.message}<br><br>
                    OTP sent to: <strong>${result.email}</strong>
                </div>
            `;
            // Show Step 2
            document.getElementById('registerStep1').style.display = 'none';
            document.getElementById('registerStep2').style.display = 'block';
            document.getElementById('regOtpInput').focus();
            return;
        }

        msgDiv.innerHTML = `<div class="error-message">${result.message}</div>`;
        setTimeout(() => {
            if (msgDiv) {
                msgDiv.innerHTML = '';
            }
        }, 3000);
    });

    // Verify Registration OTP and create account
    document.getElementById('verifyRegBtn')?.addEventListener('click', async () => {
        const username = document.getElementById('regUsername').value;
        const otp = document.getElementById('regOtpInput').value;
        const password = document.getElementById('regOtpPassword').value;
        const confirmPassword = document.getElementById('regOtpConfirmPassword').value;
        const msgDiv = document.getElementById('registerMessage');

        if (!otp || otp.length !== 6) {
            msgDiv.innerHTML = '<div class="error-message">Please enter a valid 6-digit OTP</div>';
            return;
        }
if (!password || !confirmPassword.value) {
            msgDiv.innerHTML = '<div class="error-message">Please fill all password fields</div>';
            return;
        }
        if (password !== confirmPassword) {
            msgDiv.innerHTML = '<div class="error-message">Passwords do not match</div>';
            return;
        }

        const result = await verifyRegistration(username, otp, password);
        if (result.success) {
            msgDiv.innerHTML = `<div class="success-message">${result.message}</div>`;
            // Auto login after verification
            setTimeout(async () => {
                state.currentUser = result.user;
                await renderApp();
            }, 2000);
            return;
        }

        msgDiv.innerHTML = `<div class="error-message">${result.message}</div>`;
        setTimeout(() => {
            if (msgDiv) {
                msgDiv.innerHTML = '';
            }
        }, 3000);
    });

    // Allow Enter key for OTP input
    document.getElementById('regOtpInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('verifyRegBtn')?.click();
    });
    document.getElementById('regOtpPassword')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('verifyRegBtn')?.click();
    });
    document.getElementById('regOtpConfirmPassword')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('verifyRegBtn')?.click();
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
