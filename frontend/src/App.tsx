import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ThemeProvider } from '@/hooks/useTheme';

// Pages
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { ChangePasswordPage } from '@/pages/ChangePasswordPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { ProjectDetailPage } from '@/pages/ProjectDetailPage';
import { ProjectFormPage } from '@/pages/ProjectFormPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { DashboardsPage } from '@/pages/DashboardsPage';
import { PartDetailPage } from '@/pages/PartDetailPage';
import { PartFormPage } from '@/pages/PartFormPage';
import { UsersPage } from '@/pages/UsersPage';
import { UserFormPage } from '@/pages/UserFormPage';
import { OrdersProjectListPage } from '@/pages/OrdersProjectListPage';
import { OrdersPage } from '@/pages/OrdersPage';
import { OrderDetailPage } from '@/pages/OrderDetailPage';
import { OrderStatsPage } from '@/pages/OrderStatsPage';
import { AllOrdersPage } from '@/pages/AllOrdersPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
});

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected routes */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/projects" replace />} />

            {/* Projects */}
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/new" element={<ProjectFormPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/projects/:id/edit" element={<ProjectFormPage />} />
            <Route path="/projects/:id/dashboard" element={<DashboardPage />} />

            {/* Parts */}
            <Route path="/projects/:projectId/parts/new" element={<PartFormPage />} />
            <Route path="/parts/:id" element={<PartDetailPage />} />
            <Route path="/parts/:id/edit" element={<PartFormPage />} />

            {/* Dashboards */}
            <Route path="/dashboards" element={<DashboardsPage />} />

            {/* Orders */}
            <Route path="/orders" element={<OrdersProjectListPage />} />
            <Route path="/projects/:id/orders/stats" element={<OrderStatsPage />} />
            <Route path="/projects/:id/orders/all" element={<AllOrdersPage />} />
            <Route path="/projects/:id/orders/:status" element={<OrdersPage />} />
            <Route path="/orders/:orderId" element={<OrderDetailPage />} />

            {/* Users (admin only) */}
            <Route
              path="/users"
              element={
                <ProtectedRoute requiredPermission="admin">
                  <UsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users/new"
              element={
                <ProtectedRoute requiredPermission="admin">
                  <UserFormPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users/:id/edit"
              element={
                <ProtectedRoute requiredPermission="admin">
                  <UserFormPage />
                </ProtectedRoute>
              }
            />

            {/* Account */}
            <Route path="/change-password" element={<ChangePasswordPage />} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
