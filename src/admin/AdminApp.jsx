import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
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
  const location = useLocation()
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }
  
  if (!admin) {
    // Redirect to login but preserve the intended destination
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }
  
  return <Layout>{children}</Layout>
}

const AdminRoutes = () => {
  const { admin, loading } = useAuth()

  // Show loading while checking auth status
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white">Loading admin panel...</div>
      </div>
    )
  }

  return (
    <Routes>
      <Route 
        path="/login" 
        element={
          admin ? <Navigate to="/admin/dashboard" replace /> : <Login />
        } 
      />
      
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
      
      {/* Handle /admin root path */}
      <Route 
        path="/" 
        element={
          admin ? <Navigate to="/admin/dashboard" replace /> : <Navigate to="/admin/login" replace />
        } 
      />
      
      {/* Handle any other /admin/* paths */}
      <Route 
        path="/*" 
        element={
          admin ? <Navigate to="/admin/dashboard" replace /> : <Navigate to="/admin/login" replace />
        } 
      />
    </Routes>
  )
}

const AdminApp = () => {
  return (
    <div className="min-h-screen bg-gray-950">
      <AuthProvider>
        <AdminRoutes />
      </AuthProvider>
    </div>
  )
}

export default AdminApp