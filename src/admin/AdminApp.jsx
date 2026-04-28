import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import UserManagement from './pages/UserManagement'
import StreamManagement from './pages/StreamManagement'
import ClinicManagement from './pages/ClinicManagement'
import SubscriptionManagement from './pages/SubscriptionManagement'
import NotificationCenter from './pages/NotificationCenter'
import Layout from './components/Layout'

const ProtectedRoute = ({ children }) => {
  const { admin, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }
  
  if (!admin) {
    return <Navigate to="/admin/login" replace />
  }
  
  return <Layout>{children}</Layout>
}

const AdminRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/users" element={
        <ProtectedRoute>
          <UserManagement />
        </ProtectedRoute>
      } />
      <Route path="/streams" element={
        <ProtectedRoute>
          <StreamManagement />
        </ProtectedRoute>
      } />
      <Route path="/clinics" element={
        <ProtectedRoute>
          <ClinicManagement />
        </ProtectedRoute>
      } />
      <Route path="/subscriptions" element={
        <ProtectedRoute>
          <SubscriptionManagement />
        </ProtectedRoute>
      } />
      <Route path="/notifications" element={
        <ProtectedRoute>
          <NotificationCenter />
        </ProtectedRoute>
      } />
      <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
    </Routes>
  )
}

const AdminApp = () => {
  return (
    <AuthProvider>
      <AdminRoutes />
    </AuthProvider>
  )
}

export default AdminApp