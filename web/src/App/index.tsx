import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import { GlobalStyle } from '@/components/GlobalStyle'
import { UpdateBanner } from '@/components/UpdateBanner'
import { IdentityProvider } from '@/identity'
import { useThemeSync } from '@/lib/useThemeSync'
import Chat from '@/pages/Chat'
import Coins from '@/pages/Coins'
import ChatRoom from '@/pages/ChatRoom'
import CreateFamily from '@/pages/CreateFamily'
import Family from '@/pages/Family'
import FamilyCreated from '@/pages/FamilyCreated'
import Invite from '@/pages/Invite'
import Join from '@/pages/Join'
import LessonReport from '@/pages/LessonReport'
import Login from '@/pages/Login'
import MemberPreview from '@/pages/MemberPreview'
import MyDay from '@/pages/MyDay'
import Profile from '@/pages/Profile'
import Schedule from '@/pages/Schedule'
import Settings from '@/pages/Settings'
import Tasks from '@/pages/Tasks'
import TaskForm from '@/pages/TaskForm'
import TaskView from '@/pages/TaskView'
import Trainings from '@/pages/Trainings'
import Welcome from '@/pages/Welcome'

export default function App() {
  useThemeSync()

  return (
    <IdentityProvider>
      <GlobalStyle />
      <UpdateBanner />
      <ConfirmProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/create" element={<CreateFamily />} />
            <Route path="/created" element={<FamilyCreated />} />
            <Route path="/join" element={<Join />} />
            <Route path="/login" element={<Login />} />
            <Route element={<AppShell />}>
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/tasks/new" element={<TaskForm />} />
              <Route path="/tasks/:taskId" element={<TaskView />} />
              <Route path="/tasks/:taskId/edit" element={<TaskForm />} />
              <Route path="/coins" element={<Coins />} />
              <Route path="/lesson-report" element={<LessonReport />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/chat/:chat" element={<ChatRoom />} />
              <Route path="/my-day" element={<MyDay />} />
              <Route path="/family" element={<Family />} />
              <Route path="/family/invite" element={<Invite />} />
              <Route path="/family/:memberId" element={<MemberPreview />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/schedule" element={<Schedule />} />
              <Route path="/settings/trainings" element={<Trainings />} />
              <Route path="/family/:memberId/schedule" element={<Schedule />} />
              <Route path="/family/:memberId/trainings" element={<Trainings />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
            <Route path="*" element={<Welcome />} />
          </Routes>
        </BrowserRouter>
      </ConfirmProvider>
    </IdentityProvider>
  )
}
