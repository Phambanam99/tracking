'use client';
import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Header from './Header';
import ProtectedRoute from './ProtectedRoute';

const adminNav = [
  { name: 'Dashboard', href: '/admin', icon: '📊' },
  { name: 'Users', href: '/admin/users', icon: '👥' },
  { name: 'Aircraft', href: '/admin/aircraft', icon: '✈️' },
  { name: 'Vessels', href: '/admin/vessels', icon: '🚢' },
  { name: 'Settings', href: '/admin/settings', icon: '⚙️' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex">
          {/* Sidebar */}
          <aside className="w-64 bg-white shadow-md min-h-[calc(100vh-64px)] sticky top-0">
            <nav className="p-4 space-y-2">
              <div className="px-4 py-2 mb-4">
                <h2 className="text-sm font-semibold text-gray-500 uppercase">Admin Panel</h2>
              </div>
              {adminNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                    pathname === item.href
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-medium">{item.name}</span>
                </Link>
              ))}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  );
}

