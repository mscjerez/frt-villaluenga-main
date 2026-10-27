import { createBrowserRouter } from 'react-router'
import { PublicLayout } from '@/features/public/PublicLayout'
import { HomePage } from '@/features/public/HomePage'
import { TrackingPage } from '@/features/public/TrackingPage'
import { PrivacyPage } from '@/features/public/PrivacyPage'
import { NotFound } from '@/features/public/NotFound'

// The admin area is code-split so its code never ships to regular visitors.
export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/reserva/:token', element: <TrackingPage /> },
      { path: '/privacidad', element: <PrivacyPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  {
    path: '/admin',
    lazy: async () => ({ Component: (await import('@/features/admin/AdminRoot')).AdminRoot }),
    children: [
      { path: 'login', lazy: async () => ({ Component: (await import('@/features/admin/LoginPage')).LoginPage }) },
      {
        lazy: async () => ({ Component: (await import('@/features/admin/AdminLayout')).AdminLayout }),
        children: [
          { index: true, lazy: async () => ({ Component: (await import('@/features/admin/DashboardPage')).DashboardPage }) },
          { path: 'reservas', lazy: async () => ({ Component: (await import('@/features/admin/BookingsPage')).BookingsPage }) },
          { path: 'reservas/:id', lazy: async () => ({ Component: (await import('@/features/admin/BookingDetailPage')).BookingDetailPage }) },
          { path: 'calendario', lazy: async () => ({ Component: (await import('@/features/admin/CalendarPage')).CalendarPage }) },
          { path: 'finanzas', lazy: async () => ({ Component: (await import('@/features/admin/FinancePage')).FinancePage }) },
        ],
      },
    ],
  },
])
