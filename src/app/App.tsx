import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  Bike,
  Flag,
  Home,
  LayoutDashboard,
  Package,
  ScrollText,
  ShieldCheck,
  Tag,
  User,
  Users,
  Wallet,
} from 'lucide-react'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell, type NavItem } from '@/components/layout/AppShell'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { RequireRole } from '@/features/auth/RequireRole'
import { CustomerHome } from '@/features/customer/CustomerHome'
import { CustomerTopBar } from '@/features/customer/CustomerTopBar'
import { LandingPage } from '@/features/public/LandingPage'

// Heavier screens load on demand so the first paint stays small on slow connections.
const HistoryPage = lazy(() => import('@/features/customer/HistoryPage').then((m) => ({ default: m.HistoryPage })))
const EarningsPage = lazy(() => import('@/features/runner/EarningsPage').then((m) => ({ default: m.EarningsPage })))
const AccountPage = lazy(() => import('@/features/customer/AccountPage').then((m) => ({ default: m.AccountPage })))
const RequestPage = lazy(() => import('@/features/errands/RequestPage').then((m) => ({ default: m.RequestPage })))
const TrackErrandPage = lazy(() => import('@/features/errands/TrackErrandPage').then((m) => ({ default: m.TrackErrandPage })))
const RunnerApplyPage = lazy(() => import('@/features/runner/RunnerApplyPage').then((m) => ({ default: m.RunnerApplyPage })))
const RunnerDashboard = lazy(() => import('@/features/runner/RunnerDashboard').then((m) => ({ default: m.RunnerDashboard })))
const AdminHome = lazy(() => import('@/features/admin/AdminHome').then((m) => ({ default: m.AdminHome })))
const AdminErrandsPage = lazy(() => import('@/features/admin/AdminErrandsPage').then((m) => ({ default: m.AdminErrandsPage })))
const AdminBalancesPage = lazy(() => import('@/features/admin/AdminBalancesPage').then((m) => ({ default: m.AdminBalancesPage })))
const WalletPage = lazy(() => import('@/features/wallet/WalletPage').then((m) => ({ default: m.WalletPage })))
const RunnerProfilePage = lazy(() => import('@/features/runner/RunnerProfilePage').then((m) => ({ default: m.RunnerProfilePage })))
const AdminPricingPage = lazy(() => import('@/features/admin/AdminPricingPage').then((m) => ({ default: m.AdminPricingPage })))
const AdminActivityPage = lazy(() => import('@/features/admin/AdminActivityPage').then((m) => ({ default: m.AdminActivityPage })))
const AdminReportsPage = lazy(() => import('@/features/admin/AdminReportsPage').then((m) => ({ default: m.AdminReportsPage })))
const AdminRunnersPage = lazy(() => import('@/features/admin/AdminRunnersPage').then((m) => ({ default: m.AdminRunnersPage })))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

const customerItem: NavItem = { to: '/app', label: 'Customer', icon: User, end: true }

const customerItems: NavItem[] = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/history', label: 'Errands', icon: Bike },
  { to: '/app/wallet', label: 'Wallet', icon: Wallet },
  { to: '/app/account', label: 'Profile', icon: User },
]

/** Customer screens follow the dark-bar design. Runner and admin switching live in the menu. */
function CustomerShell() {
  return <AppShell items={customerItems} area="Customer" topBar={<CustomerTopBar />} />
}

const runnerItems: NavItem[] = [
  { to: '/runner', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/runner/earnings', label: 'Earnings', icon: Wallet },
  { to: '/runner/profile', label: 'Profile', icon: User },
  customerItem,
]

const adminItems: NavItem[] = [
  { to: '/admin', label: 'Overview', icon: ShieldCheck, end: true },
  { to: '/admin/runners', label: 'Runners', icon: Users },
  { to: '/admin/errands', label: 'Errands', icon: Package },
  { to: '/admin/reports', label: 'Reports', icon: Flag },
  { to: '/admin/balances', label: 'Balances', icon: Wallet },
  { to: '/admin/pricing', label: 'Pricing', icon: Tag },
  { to: '/admin/activity', label: 'Activity', icon: ScrollText },
  customerItem,
]

function NotFound() {
  return (
    <div className="mx-auto max-w-md p-6 text-center">
      <h1 className="text-2xl font-extrabold">Page not found</h1>
      <p className="mt-2 text-ink-soft">That page does not exist.</p>
      <Link to="/" className="mt-4 inline-block font-semibold text-brand-red underline">
        Back to the home page
      </Link>
    </div>
  )
}

function Loading() {
  return (
    <div className="p-6 text-center text-ink-soft" role="status">
      Loading…
    </div>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/become-a-runner" element={<Navigate to="/app/runner-application" replace />} />

              <Route element={<RequireAuth />}>
                <Route path="/app" element={<CustomerShell />}>
                  <Route index element={<CustomerHome />} />
                  <Route path="errands/new" element={<RequestPage />} />
                  <Route path="errands/:id" element={<TrackErrandPage />} />
                  <Route path="runner-application" element={<RunnerApplyPage />} />
                  <Route path="history" element={<HistoryPage />} />
                  <Route path="wallet" element={<WalletPage />} />
                  <Route path="account" element={<AccountPage />} />
                </Route>

                <Route element={<RequireRole roles={['runner']} fallback={<Navigate to="/app/runner-application" replace />} />}>
                  <Route path="/runner" element={<AppShell items={runnerItems} area="Runner" />}>
                    <Route index element={<RunnerDashboard />} />
                    <Route path="earnings" element={<EarningsPage />} />
                    <Route path="profile" element={<RunnerProfilePage />} />
                  </Route>
                </Route>

                <Route element={<RequireRole roles={['admin', 'super_admin']} />}>
                  <Route path="/admin" element={<AppShell items={adminItems} area="Admin" />}>
                    <Route index element={<AdminHome />} />
                    <Route path="runners" element={<AdminRunnersPage />} />
                    <Route path="errands" element={<AdminErrandsPage />} />
                    <Route path="reports" element={<AdminReportsPage />} />
                    <Route path="balances" element={<AdminBalancesPage />} />
                    <Route path="pricing" element={<AdminPricingPage />} />
                    <Route path="activity" element={<AdminActivityPage />} />
                  </Route>
                </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
