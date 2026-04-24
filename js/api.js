const API = 'api.php';

export async function apiGet(action, params = {}) {
    const qs = new URLSearchParams({ action, ...params }).toString();
    const res = await fetch(`${API}?${qs}`);
    const data = await res.json();
    if (data.error) {
        throw new Error(data.error);
    }
    return data;
}

export async function apiPost(action, body = {}) {
    const res = await fetch(`${API}?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.error) {
        throw new Error(data.error);
    }
    return data;
}
