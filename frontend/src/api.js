const API_BASE = (process.env.REACT_APP_API_BASE || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');

export { API_BASE };

export function toImageUrl(u) {
  if (!u) return '';
  const base = API_BASE || '';
  // If absolute URL but path begins with /storage/, rewrite to API proxy under /api/storage
  if (/^https?:\/\//i.test(u)) {
    try {
      const url = new URL(u);
      if (url.pathname.startsWith('/storage/')) {
        return `${base}/api${url.pathname}${url.search || ''}`;
      }
    } catch (_) {}
    return u;
  }
  // Remove transient cache-buster from relative URLs
  // Keep any existing query parameters (including cache-busters)
  // Normalize common relative variants
  if (u.startsWith('storage/')) u = '/' + u; // -> /storage/...
  if (u.startsWith('/profile_images/')) u = '/storage' + u; // -> /storage/profile_images/...
  if (u.startsWith('profile_images/')) u = '/storage/' + u; // -> /storage/profile_images/...
  if (u.startsWith('/storage/')) {
    return `${base}/api${u}`; // serve via API proxy route /api/storage/*
  }
  return `${base}${u}`;
}

export async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const base = API_BASE || '';
  let res;
  try {
    res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'omit',
      cache: 'no-store',
    });
  } catch (e) {
    throw new Error('Network error. Please check your connection and try again.');
  }

  // Parse response based on content-type to avoid JSON parse errors on HTML error pages
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  let data = null;
  let text = '';
  if (ct.includes('application/json')) {
    try { data = await res.json(); } catch (_) { data = null; }
  } else {
    try { text = await res.text(); } catch (_) { text = ''; }
  }

  if (!res.ok) {
    // Gather Laravel validation errors if present
    let validationMsg = '';
    if (data && data.errors && typeof data.errors === 'object') {
      const msgs = Object.values(data.errors).flat().slice(0, 3);
      if (msgs.length) validationMsg = msgs.join('\n');
    }

    // Prefer backend-provided message or plain text
    let message = (data && (data.message || data.error)) || text || '';

    // Friendly fallbacks by status code
    if (!message) {
      switch (res.status) {
        case 400:
          message = 'Bad request. Please check your input and try again.'; break;
        case 401:
          message = 'Unauthorized. Please log in and try again.'; break;
        case 403:
          message = 'Access denied. You do not have permission to perform this action.'; break;
        case 404:
          message = 'Service temporarily unavailable. Please try again later.'; break;
        case 422:
          message = 'Some fields are invalid. Please review and try again.'; break;
        default:
          if (!message) {
            if (res.status >= 500) message = 'Server error. Please try again later.';
            else message = 'Request failed. Please try again.';
          }
      }
    }

    if (validationMsg) message = `${message}\n${validationMsg}`.trim();
    const err = new Error(message);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}
