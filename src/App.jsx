import { Routes, Route, Navigate } from "react-router-dom";
import RootLayout from "./layouts/RootLayout.jsx";
import TabsLayout from "./layouts/TabsLayout.jsx";

import GuestOnly from "./components/GuestOnly.jsx";
import RequireAuth from "./components/RequireAuth.jsx";

import Onboarding from "./pages/Onboarding.jsx";
import AuthChoice from "./pages/AuthChoice.jsx";
import EmailLogin from "./pages/EmailLogin.jsx";
import EmailVerify from "./pages/EmailVerify.jsx";

import Discover from "./pages/Discover.jsx";
import Matches from "./pages/Matches.jsx";
import Messages from "./pages/Messages.jsx";
import ProfileYou from "./pages/ProfileYou.jsx";
import Filters from "./pages/Filters.jsx";
import Chat from "./pages/Chat.jsx";
import ProfileView from "./pages/ProfileView.jsx";
import MatchSuccess from "./pages/MatchSuccess.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route element={<GuestOnly />}>
          <Route path="/" element={<Onboarding />} />
          <Route path="/auth" element={<AuthChoice />} />
          <Route path="/auth/email" element={<EmailLogin />} />
          <Route path="/auth/email-verify" element={<EmailVerify />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<TabsLayout />}>
            <Route path="/discover" element={<Discover />} />
            <Route path="/matches" element={<Matches />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/profile" element={<ProfileYou />} />
          </Route>
          <Route path="/filters" element={<Filters />} />
          <Route path="/chat/:id" element={<Chat />} />
          <Route path="/profile/:id" element={<ProfileView />} />
          <Route path="/match" element={<MatchSuccess />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}