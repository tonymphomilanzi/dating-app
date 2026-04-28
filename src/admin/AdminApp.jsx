// src/admin/AdminApp.jsx
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import { AuthProvider, useAuth } from "./hooks/useAuth";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import UserManagement from "./pages/UserManagement";
import StreamManagement from "./pages/StreamManagement";
import ClinicManagement from "./pages/ClinicManagement";
import SubscriptionManagement from "./pages/SubscriptionManagement";
import NotificationCenter from "./pages/NotificationCenter";

import Layout from "./components/Layout";
import { AlertProvider } from "./components/CustomAlert/AlertProvider";

function AdminLoading() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-white text-sm">Loading admin panel...</div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { admin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <AdminLoading />;
  }

  if (!admin) {
    return (
      <Navigate
        to="/admin/login"
        state={{ from: location }}
        replace
      />
    );
  }

  return <Layout>{children}</Layout>;
}

function PublicAdminRoute({ children }) {
  const { admin, loading } = useAuth();

  if (loading) {
    return <AdminLoading />;
  }

  if (admin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
}

function AdminRoutes() {
  return (
        <AlertProvider>
    <Routes>
      {/* Admin root */}
      <Route path="/admin" element={<Navigate to="/admin/login" replace />} />

      {/* Login */}
      <Route
        path="/admin/login"
        element={
          <PublicAdminRoute>
            <Login />
          </PublicAdminRoute>
        }
      />

      {/* Protected admin pages */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/users"
        element={
          <ProtectedRoute>
            <UserManagement />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/streams"
        element={
          <ProtectedRoute>
            <StreamManagement />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/clinics"
        element={
          <ProtectedRoute>
            <ClinicManagement />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/subscriptions"
        element={
          <ProtectedRoute>
            <SubscriptionManagement />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/notifications"
        element={
          <ProtectedRoute>
            <NotificationCenter />
          </ProtectedRoute>
        }
      />

      {/* Admin catch-all */}
      <Route path="/admin/*" element={<Navigate to="/admin/login" replace />} />
    </Routes>
    </AlertProvider>
  );
}

export default function AdminApp() {
  return (
    <div className="min-h-screen bg-gray-950">
      <AuthProvider>
        <AdminRoutes />
      </AuthProvider>
    </div>
  );
}