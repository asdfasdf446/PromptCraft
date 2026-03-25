// Authentication utilities for guest and user login

const API_BASE = `${window.location.protocol}//${window.location.hostname}:8080`;

export interface AuthResponse {
  token: string;
}

export interface AuthError {
  error: string;
}

/**
 * Generate a UUID v4 (fallback for browsers without crypto.randomUUID)
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get or create a guest UUID stored in sessionStorage.
 * Guest data is discarded when the tab is closed.
 */
export function getOrCreateGuestUUID(): string {
  let guestUUID = sessionStorage.getItem('guestUUID');
  if (!guestUUID) {
    guestUUID = generateUUID();
    sessionStorage.setItem('guestUUID', guestUUID);
    console.log('[Auth] 🆕 Generated new guest UUID:', guestUUID);
  } else {
    console.log('[Auth] ♻️ Reusing existing guest UUID:', guestUUID);
  }
  return guestUUID;
}

/**
 * Get a guest JWT token from the server.
 * Returns the token on success, throws on error.
 */
export async function getGuestToken(): Promise<string> {
  const uid = getOrCreateGuestUUID();
  console.log('[Auth] 🎫 Requesting guest token for UUID:', uid);

  const response = await fetch(`${API_BASE}/guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Guest token request failed: ${response.status} ${errorText}`);
  }

  const data: AuthResponse = await response.json();
  console.log('[Auth] ✅ Guest token received');
  return data.token;
}

/**
 * Register a new user account.
 * Returns true on success, throws on error.
 */
export async function register(username: string, password: string): Promise<void> {
  console.log('[Auth] 📝 Registering user:', username);

  const response = await fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Registration failed: ${response.status} ${errorText}`);
  }

  console.log('[Auth] ✅ User registered successfully');
}

/**
 * Login with username and password.
 * Returns the JWT token on success, throws on error.
 * Token is stored in localStorage for persistence across sessions.
 */
export async function login(username: string, password: string): Promise<string> {
  console.log('[Auth] 🔑 Logging in user:', username);

  const response = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Login failed: ${response.status} ${errorText}`);
  }

  const data: AuthResponse = await response.json();
  localStorage.setItem('userToken', data.token);
  console.log('[Auth] ✅ User logged in, token stored');
  return data.token;
}

/**
 * Get the stored user token from localStorage, or null if not logged in.
 */
export function getUserToken(): string | null {
  return localStorage.getItem('userToken');
}

/**
 * Logout by clearing the stored user token.
 */
export function logout(): void {
  localStorage.removeItem('userToken');
  console.log('[Auth] 👋 User logged out');
}

/**
 * Get an auth token for WebSocket connection.
 * Prefers user token if available, falls back to guest token.
 */
export async function getAuthToken(): Promise<string> {
  const userToken = getUserToken();
  if (userToken) {
    console.log('[Auth] 🔐 Using stored user token');
    return userToken;
  }

  console.log('[Auth] 👤 No user token, using guest mode');
  return await getGuestToken();
}
