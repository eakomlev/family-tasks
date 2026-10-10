import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { GlobalStyle } from '@/components/GlobalStyle'
import { IdentityProvider } from '@/identity'
import CreateFamily from '@/pages/CreateFamily'
import Family from '@/pages/Family'
import FamilyCreated from '@/pages/FamilyCreated'
import Join from '@/pages/Join'
import Login from '@/pages/Login'
import Welcome from '@/pages/Welcome'

export default function App() {
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
          <Route path="/family" element={<Family />} />
          <Route path="*" element={<Welcome />} />
        </Routes>
      </BrowserRouter>
    </IdentityProvider>
  )
}
