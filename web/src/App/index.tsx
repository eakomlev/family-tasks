import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { GlobalStyle } from '@/components/GlobalStyle'
import { IdentityProvider } from '@/identity'
import { useThemeSync } from '@/lib/useThemeSync'
import Chat from '@/pages/Chat'
import CreateFamily from '@/pages/CreateFamily'
import Family from '@/pages/Family'
import FamilyCreated from '@/pages/FamilyCreated'
import Join from '@/pages/Join'
import Login from '@/pages/Login'
import MemberPreview from '@/pages/MemberPreview'
import MyDay from '@/pages/MyDay'
import Profile from '@/pages/Profile'
import Settings from '@/pages/Settings'
import Tasks from '@/pages/Tasks'
import Welcome from '@/pages/Welcome'

export default function App() {
  useThemeSync()

  return (
    <IdentityProvider>
      <GlobalStyle />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/create" element={<CreateFamily />} />
          <Route path="/created" element={<FamilyCreated />} />
          <Route path="/join" element={<Join />} />
          <Route path="/login" element={<Login />} />
          <Route element={<AppShell />}>
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/my-day" element={<MyDay />} />
            <Route path="/family" element={<Family />} />
            <Route path="/family/:memberId" element={<MemberPreview />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route path="*" element={<Welcome />} />
        </Routes>
      </BrowserRouter>
    </IdentityProvider>
  )
}
