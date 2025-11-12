'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tokenExpiredMsg, setTokenExpiredMsg] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isLoading, error, clearError } = useAuthStore();

  // Check if redirected due to token expiration
  useEffect(() => {
    if (searchParams.get('expired') === 'true') {
      setTokenExpiredMsg(true);
      console.log('[LoginPage] User redirected due to token expiration');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setTokenExpiredMsg(false); // Clear expired message on new login attempt

    try {
      await login(username, password);
      router.push('/'); // Redirect to map page
    } catch (err) {
      // Error is handled by the store
      console.error('Login error:', err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 card p-8">
        <div>
          <h2 className="mt-2 text-center text-3xl font-bold">
            Đăng nhập vào hệ thống
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-300">
            Tracking System - Aircraft & Vessel Management
          </p>
        </div>

        {tokenExpiredMsg && (
          <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/40 p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-yellow-600 dark:text-yellow-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                  Phiên đăng nhập đã hết hạn
                </h3>
                <div className="mt-1 text-sm text-yellow-700 dark:text-yellow-400">
                  Vui lòng đăng nhập lại để tiếp tục sử dụng hệ thống.
                </div>
              </div>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-3">
            <div>
              <label htmlFor="username" className="sr-only">
                Tên đăng nhập
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                autoComplete="username"
                className="input"
                placeholder="Tên đăng nhập"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Mật khẩu
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="input"
                placeholder="Mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 p-3">
              <div className="text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Đang đăng nhập...
                </div>
              ) : (
                'Đăng nhập'
              )}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Demo credentials: <br />
              Username: <span className="font-mono">admin</span> <br />
              Password: <span className="font-mono">password</span>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
