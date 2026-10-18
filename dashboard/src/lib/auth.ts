'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  banner: string | null;
  accentColor: string | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (data: { user: User; accessToken: string; refreshToken: string }) => void;
  logout: () => void;
  refreshAccessToken: () => Promise<void>;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (data) => {
        set({
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          isAuthenticated: true,
        });
      },

      logout: () => {
        // Clear tokens
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
        // Redirect to login
        if (typeof window !== 'undefined') {
          window.location.href = '/api/auth/discord';
        }
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return;

        try {
          const res = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (res.ok) {
            const data = await res.json();
            set({
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
            });
          } else {
            get().logout();
          }
        } catch (error) {
          console.error('Token refresh failed:', error);
          get().logout();
        }
      },
    }),
    {
      name: 'liberty-city-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Helper to get auth header
export function getAuthHeader(): string | null {
  const { accessToken } = useAuth.getState();
  return accessToken ? `Bearer ${accessToken}` : null;
}

// API fetch with auth
export async function apiFetch(url: string, options: RequestInit = {}) {
  const token = getAuthHeader();
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', token);
  headers.set('Content-Type', 'application/json');

  const res = await fetch(url, { ...options, headers });
  
  if (res.status === 401) {
    const { refreshAccessToken, logout } = useAuth.getState();
    await refreshAccessToken();
    // Retry once
    const newToken = getAuthHeader();
    if (newToken) {
      const retryHeaders = new Headers(options.headers);
      retryHeaders.set('Authorization', newToken);
      retryHeaders.set('Content-Type', 'application/json');
      return fetch(url, { ...options, headers: retryHeaders });
    }
    useAuth.getState().logout();
  }
  
  return res;
}