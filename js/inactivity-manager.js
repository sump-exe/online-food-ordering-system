const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'click', 'keydown', 'touchstart', 'wheel'];

let timerId = null;
let isMonitoring = false;
let listenersAttached = false;
let activeSessionKey = null;
let lastActivityAt = 0;
let timeoutHandler = null;

function clearTimer() {
    if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
    }
}

function triggerTimeout() {
    if (!isMonitoring) {
        return;
    }

    const handler = timeoutHandler;
    stopInactivityMonitor();

    if (typeof handler === 'function') {
        handler();
    }
}

function scheduleTimeoutCheck() {
    clearTimer();

    if (!isMonitoring) {
        return;
    }

    const elapsed = Date.now() - lastActivityAt;
    const remaining = INACTIVITY_TIMEOUT_MS - elapsed;

    if (remaining <= 0) {
        triggerTimeout();
        return;
    }

    timerId = window.setTimeout(() => {
        const latestElapsed = Date.now() - lastActivityAt;
        if (latestElapsed >= INACTIVITY_TIMEOUT_MS) {
            triggerTimeout();
            return;
        }

        scheduleTimeoutCheck();
    }, remaining);
}

function handleActivity() {
    if (!isMonitoring) {
        return;
    }

    if (Date.now() - lastActivityAt >= INACTIVITY_TIMEOUT_MS) {
        triggerTimeout();
        return;
    }

    lastActivityAt = Date.now();
    scheduleTimeoutCheck();
}

function attachListeners() {
    if (listenersAttached) {
        return;
    }

    ACTIVITY_EVENTS.forEach((eventName) => {
        document.addEventListener(eventName, handleActivity, true);
    });

    window.addEventListener('focus', handleActivity, true);
    listenersAttached = true;
}

export function startInactivityMonitor(sessionKey, onTimeout) {
    attachListeners();
    timeoutHandler = onTimeout;

    if (isMonitoring && activeSessionKey === sessionKey) {
        return;
    }

    isMonitoring = true;
    activeSessionKey = sessionKey;
    lastActivityAt = Date.now();
    scheduleTimeoutCheck();
}

export function stopInactivityMonitor() {
    isMonitoring = false;
    activeSessionKey = null;
    timeoutHandler = null;
    lastActivityAt = 0;
    clearTimer();
}
