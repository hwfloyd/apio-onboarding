import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import OnboardingForm from './components/OnboardingForm'
import Login from './pages/Login'
import Backoffice from './pages/Backoffice'
import OnboardingDetail from './pages/OnboardingDetail'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<OnboardingForm />} />
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={<ProtectedRoute><Backoffice /></ProtectedRoute>} />
        <Route path="/admin/onboarding/:id" element={<ProtectedRoute><OnboardingDetail /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}
