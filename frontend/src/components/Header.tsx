'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useRegionStore } from '@/stores/regionStore';
import { useState, useEffect, useRef } from 'react';
import NotificationDropdown from './NotificationDropdown';
import { Bell, BellRing, Radar } from 'lucide-react';
import { LayoutDashboard, Map, Plane, Ship, Star, Newspaper } from "lucide-react";
function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { unreadAlertCount, fetchAlerts } = useRegionStore();

  // TÁCH state để không xung đột
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);

  // Fetch alerts khi có user
  useEffect(() => {
    if (user) fetchAlerts(true);
  }, [user, fetchAlerts]);

  // Đóng menu khi đổi route
  useEffect(() => {
    setIsUserMenuOpen(false);
    setIsNotificationOpen(false);
    setIsMobileOpen(false);
  }, [pathname]);

  // Click outside để đóng dropdowns
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        isUserMenuOpen &&
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
      if (
        isNotificationOpen &&
        notifRef.current &&
        !notifRef.current.contains(e.target as Node)
      ) {
        setIsNotificationOpen(false);
      }
      if (
        isMobileOpen &&
        mobileRef.current &&
        !mobileRef.current.contains(e.target as Node)
      ) {
        setIsMobileOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isUserMenuOpen, isNotificationOpen, isMobileOpen]);

  // ESC để đóng
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsUserMenuOpen(false);
        setIsNotificationOpen(false);
        setIsMobileOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const navigation = [
    { name: 'Tổng quan', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Bản đồ', href: '/', icon: Map },
  { name: 'Máy bay', href: '/aircraft', icon: Plane },
  { name: 'Tàu thuyền', href: '/vessels', icon: Ship },
  { name: 'Theo dõi', href: '/tracking', icon: Star },
  { name: 'Báo chí', href: '/news', icon: Newspaper },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <nav
      className="sticky top-0 z-50 border-b border-gray-200/20"
      style={{ backgroundColor: '#204390' }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between">
          {/* Left: Brand */}
          <div className="flex items-center">
            <Link
              href="/"
              className="flex items-center gap-2 text-lg font-semibold text-white"
              aria-label="Trang chủ"
            >
              {/* <span className="inline-block h-2.5 w-2.5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 shadow" /> */}
              <span className="tracking-tight"> <Radar className="w-6 h-6 text-primary" /></span>
            </Link>
          </div>

          {/* Center: Desktop nav */}
          <div className="hidden sm:flex sm:items-center sm:gap-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/50',
                    isActive(item.href)
                      ? 'bg-white/20 text-white ring-1 ring-white/30'
                      : 'text-white/80 hover:text-white hover:bg-white/10',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* Right: actions */}
          <div className="hidden sm:flex items-center gap-3">
            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setIsNotificationOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={isNotificationOpen}
                className={cn(
                  'relative h-9 w-9 inline-flex items-center justify-center rounded-full transition',
                  'text-white/80 hover:text-white',
                  'ring-1 ring-white/20 hover:ring-white/40',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/50',
                )}
              >
                <span className="sr-only">Xem thông báo</span>
                {(unreadAlertCount ?? 0) > 0 ? (
                  <BellRing className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Bell className="h-5 w-5" aria-hidden="true" />
                )}
                {unreadAlertCount > 0 && (
                  <span
                    className={cn(
                      'absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1.5',
                      'rounded-full text-[10px] font-semibold text-white',
                      'bg-red-500 flex items-center justify-center shadow',
                    )}
                  >
                    {unreadAlertCount > 99 ? '99+' : unreadAlertCount}
                  </span>
                )}
              </button>

              <NotificationDropdown
                isOpen={isNotificationOpen}
                onClose={() => setIsNotificationOpen(false)}
              />
            </div>

            {/* Settings (Admin) */}
            {user?.role === 'ADMIN' && (
              <Link
                href="/admin/settings"
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition',
                  'text-white/80 hover:text-white',
                  'ring-1 ring-white/20 hover:ring-white/40',
                  'hover:bg-white/10',
                )}
              >
                Cài đặt
              </Link>
            )}

            {/* User menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={isUserMenuOpen}
                className={cn(
                  'flex items-center justify-center h-9 w-9 rounded-full transition',
                  'bg-white/20 text-white hover:bg-white/30',
                  'shadow ring-1 ring-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/50',
                )}
                title={user?.username ?? 'Tài khoản'}
              >
                <span className="sr-only">Mở menu người dùng</span>
                <span className="font-semibold">
                  {user?.username?.charAt(0).toUpperCase()}
                </span>
              </button>

              {isUserMenuOpen && (
                <div
                  className={cn(
                    'absolute right-0 mt-2 w-64 rounded-xl shadow-xl z-50',
                    'bg-white dark:bg-slate-900 ring-1 ring-black/5 dark:ring-white/10 overflow-hidden',
                  )}
                >
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-white/10">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {user?.username}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {user?.email}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      Vai trò: {user?.role}
                    </div>
                  </div>

                  <div className="py-1">
                    {user?.role === 'ADMIN' && (
                      <Link
                        href="/admin/settings"
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        Cài đặt hệ thống
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5"
                    >
                      Đăng xuất
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile burger (hidden on desktop) */}
            <button
              onClick={() => setIsMobileOpen(true)}
              className="sm:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/50"
              aria-label="Mở menu"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 7h16M4 12h16M4 17h16"
                />
              </svg>
            </button>
          </div>

          {/* Mobile only: burger on left when hidden desktop actions */}
          <div className="sm:hidden flex items-center gap-2">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/50"
              aria-label="Mở menu"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 7h16M4 12h16M4 17h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu panel */}
      {isMobileOpen && (
        <div
          ref={mobileRef}
          className={cn(
            'sm:hidden border-t border-gray-200/80 dark:border-white/10',
            'bg-white/90 dark:bg-slate-950/80 backdrop-blur',
          )}
        >
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-base font-medium transition border',
                    isActive(item.href)
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'border-transparent text-gray-700 hover:bg-gray-50 hover:border-gray-200 dark:text-gray-200 dark:hover:bg-white/5 dark:hover:border-white/10',
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}

            {user?.role === 'ADMIN' && (
              <Link
                href="/admin/settings"
                onClick={() => setIsMobileOpen(false)}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-base font-medium transition border',
                  pathname === '/admin/settings'
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'border-transparent text-gray-700 hover:bg-gray-50 hover:border-gray-200 dark:text-gray-200 dark:hover:bg-white/5 dark:hover:border-white/10',
                )}
              >
                Cài đặt hệ thống
              </Link>
            )}

            <div className="pt-2 border-t border-gray-200/80 dark:border-white/10">
              <div className="px-1 text-sm text-gray-600 dark:text-gray-300">
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {user?.username}
                </div>
                <div className="text-gray-500 dark:text-gray-400">
                  {user?.email}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="mt-2 w-full text-left rounded-lg px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-200 dark:hover:text-white/90 dark:hover:bg-white/5 transition"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
