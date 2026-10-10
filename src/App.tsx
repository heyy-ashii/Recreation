import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAdmin, RequireAuth } from './components/Guards'
import PublicLayout from './components/PublicLayout'
import { PageSpinner } from './components/ui'
import About from './pages/About'
import Contact from './pages/Contact'
import Discover from './pages/Discover'
import Feed from './pages/Feed'
import Home from './pages/Home'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import ProgramDetail from './pages/ProgramDetail'
import Search from './pages/Search'

const Account = lazy(() => import('./pages/Account'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminUsers = lazy(() => import('./pages/admin/Users'))
const AdminPrograms = lazy(() => import('./pages/admin/Programs'))
const AdminChats = lazy(() => import('./pages/admin/Chats'))

export default function App() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="feed" element={<Feed />} />
          <Route path="discover" element={<Discover />} />
          <Route path="search" element={<Search />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="programs/:id" element={<ProgramDetail />} />
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<Login initialMode="signup" />} />
          <Route
            path="account"
            element={
              <RequireAuth>
                <Account />
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route
          path="admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="programs" element={<AdminPrograms />} />
          <Route path="chats" element={<AdminChats />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
