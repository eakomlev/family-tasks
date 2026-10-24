import { useEffect } from 'react'
import { Provider } from 'react-redux'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import { GlobalStyle } from '@/components/GlobalStyle'
import { ConnectionBanner } from '@/components/ConnectionBanner'
import { UpdateBanner } from '@/components/UpdateBanner'
import { IdentityProvider } from '@/identity'
import { store } from '@/store'
import { SessionSync } from '@/store/SessionSync'
import { applyFontScale, getFontScale } from '@/lib/fontScale'
import { useThemeSync } from '@/lib/useThemeSync'
import Chat from '@/pages/Chat'
import ChatArchive from '@/pages/ChatArchive'
import Coins from '@/pages/Coins'
import Calendar from '@/pages/Calendar'
import CalendarSettings from '@/pages/CalendarSettings'
import ChatInfo from '@/pages/ChatInfo'
import Game from '@/pages/Game'
import GamesList from '@/pages/GamesList'
import ChatRoom from '@/pages/ChatRoom'
import EventForm from '@/pages/EventForm'
import FamilyDelete from '@/pages/FamilyDelete'
import EventView from '@/pages/EventView'
import CreateFamily from '@/pages/CreateFamily'
import Family from '@/pages/Family'
import FamilyCreated from '@/pages/FamilyCreated'
import GoalForm from '@/pages/GoalForm'
import Goals from '@/pages/Goals'
import GoalView from '@/pages/GoalView'
import Invite from '@/pages/Invite'
import Join from '@/pages/Join'
import LessonReport from '@/pages/LessonReport'
import Login from '@/pages/Login'
import MemberPreview from '@/pages/MemberPreview'
import MyDay from '@/pages/MyDay'
import Profile from '@/pages/Profile'
import ProfileEdit from '@/pages/ProfileEdit'
import ProfileNotifications from '@/pages/ProfileNotifications'
import Share from '@/pages/Share'
import ProfileSettings from '@/pages/ProfileSettings'
import ProfileTheme from '@/pages/ProfileTheme'
import Schedule from '@/pages/Schedule'
import Service from '@/pages/Service'
import Tasks from '@/pages/Tasks'
import TaskForm from '@/pages/TaskForm'
import TaskView from '@/pages/TaskView'
import Trainings from '@/pages/Trainings'
import Welcome from '@/pages/Welcome'

export default function App() {
  useThemeSync()
  // размер шрифта, выбранный в настройках
  useEffect(() => applyFontScale(getFontScale()), [])

  return (
    <Provider store={store}>
    <IdentityProvider>
      <SessionSync />
      <GlobalStyle />
      <ConnectionBanner />
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
              <Route path="/coins/:memberId" element={<Coins />} />
              <Route path="/family/:memberId/goals" element={<Goals />} />
              <Route path="/family/:memberId/goals/new" element={<GoalForm />} />
              <Route path="/goals/:goalId" element={<GoalView />} />
              <Route path="/goals/:goalId/edit" element={<GoalForm />} />
              <Route path="/lesson-report" element={<LessonReport />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/share" element={<Share />} />
              <Route path="/chat/archive" element={<ChatArchive />} />
              <Route path="/chat/:chat" element={<ChatRoom />} />
              <Route path="/chat/:chat/info" element={<ChatInfo />} />
              <Route path="/family/:memberId/games" element={<GamesList />} />
              <Route path="/games/:id" element={<Game />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/calendar/settings" element={<CalendarSettings />} />
              <Route path="/calendar/events/new" element={<EventForm />} />
              <Route path="/calendar/events/:id" element={<EventView />} />
              <Route path="/calendar/events/:id/edit" element={<EventForm />} />
              <Route path="/my-day" element={<MyDay />} />
              <Route path="/family" element={<Family />} />
              <Route path="/family/invite" element={<Invite />} />
              <Route path="/family/delete" element={<FamilyDelete />} />
              <Route path="/family/:memberId" element={<MemberPreview />} />
              <Route path="/profile/schedule" element={<Schedule />} />
              <Route path="/profile/trainings" element={<Trainings />} />
              <Route path="/profile/edit" element={<ProfileEdit />} />
              <Route path="/profile/notifications" element={<ProfileNotifications />} />
              <Route path="/profile/theme" element={<ProfileTheme />} />
              <Route path="/profile/settings" element={<ProfileSettings />} />
              <Route path="/profile/service" element={<Service />} />
              {/* прежние адреса настроек (закладки, уже отправленные уведомления) */}
              <Route path="/settings" element={<Navigate to="/profile" replace />} />
              <Route path="/settings/schedule" element={<Navigate to="/profile/schedule" replace />} />
              <Route path="/settings/trainings" element={<Navigate to="/profile/trainings" replace />} />
              <Route path="/family/:memberId/schedule" element={<Schedule />} />
              <Route path="/family/:memberId/trainings" element={<Trainings />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
            <Route path="*" element={<Welcome />} />
          </Routes>
        </BrowserRouter>
      </ConfirmProvider>
    </IdentityProvider>
    </Provider>
  )
}
