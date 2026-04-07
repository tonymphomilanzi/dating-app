// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import RootLayout from "./layouts/RootLayout.jsx";
import TabsLayout from "./layouts/TabsLayout.jsx";

import GuestOnly from "./components/GuestOnly.jsx";
import RequireAuth from "./components/RequireAuth.jsx";
import SetupGate from "./components/SetupGate.jsx";

import Onboarding from "./pages/Onboarding.jsx";
import AuthChoice from "./pages/AuthChoice.jsx";
import EmailLogin from "./pages/EmailLogin.jsx";
import EmailVerify from "./pages/EmailVerify.jsx";
import AuthCallback from "./pages/AuthCallback.jsx";
import SignUp from "./pages/SignUp.jsx";
import SignInEmail from "./pages/SignInEmail.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";

import Discover from "./pages/Discover.jsx";
import Matches from "./pages/Matches.jsx";
import Messages from "./pages/Messages.jsx";
import ProfileYou from "./pages/ProfileYou.jsx";
import Filters from "./pages/Filters.jsx";
import Chat from "./pages/Chat.jsx";
import ProfileView from "./pages/ProfileView.jsx";
import MatchSuccess from "./pages/MatchSuccess.jsx";
import UserProfile from "./pages/UserProfile.jsx";
import ProfileGallery from "./pages/ProfileGallery.jsx";

import SetupBasics from "./pages/setup/Basics.jsx";
import SetupDOB from "./pages/setup/DOB.jsx";
import SetupGender from "./pages/setup/Gender.jsx";
import SetupInterests from "./pages/setup/Interests.jsx";
import SetupPhoto from "./pages/setup/Photo.jsx";

import StoryComposer from "./pages/StoryComposer.jsx";
import StoryPage from "./pages/StoryPage.jsx";
import Events from "./pages/Events.jsx";
import EventDetail from "./pages/EventDetail.jsx";
import CreateEvent from "./pages/CreateEvent.jsx";
import Calendar from "./pages/Calendar.jsx";

import Notifications from "./pages/Notifications.jsx";
import Streams from "./pages/Streams.jsx";

import { AuthFlowProvider } from "./contexts/AuthFlowContext.jsx";
import { Toaster } from "@/components/ui/sonner";

export default function App() {
  return (
    <AuthFlowProvider>
      <Toaster richColors closeButton position="top-center" />

      <Routes>
        <Route element={<RootLayout />}>

          {/* ── Public — no auth needed ──────────────────────────────────── */}
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* ── Guest only (redirect to /discover if already signed in) ──── */}
          <Route element={<GuestOnly />}>
            <Route path="/"                   element={<Onboarding />} />
            <Route path="/auth"               element={<AuthChoice />} />
            <Route path="/auth/email"         element={<EmailLogin />} />
            <Route path="/auth/email-verify"  element={<EmailVerify />} />
            <Route path="/auth/verify"        element={<EmailVerify />} />
            <Route path="/auth/signup"        element={<SignUp />} />
            <Route path="/auth/signin/email"  element={<SignInEmail />} />

            {/* ✅ Forgot password — guest only so logged-in users        */}
            {/*    can't accidentally hit it and lose their session       */}
            <Route path="/auth/forgot-password" element={<ForgotPassword />} />
          </Route>

          {/* ── Requires a valid session ─────────────────────────────────── */}
          <Route element={<RequireAuth />}>

            {/* Setup wizard — shown before profile is complete */}
            <Route path="/setup/basics"    element={<SetupBasics />} />
            <Route path="/setup/dob"       element={<SetupDOB />} />
            <Route path="/setup/gender"    element={<SetupGender />} />
            <Route path="/setup/interests" element={<SetupInterests />} />
            <Route path="/setup/photo"     element={<SetupPhoto />} />

            {/* ── Requires completed profile (SetupGate) ──────────────── */}
            <Route element={<SetupGate />}>

              {/* Bottom-tab pages */}
              <Route element={<TabsLayout />}>
                <Route path="/discover"  element={<Discover />} />
                <Route path="/matches"   element={<Matches />} />
                <Route path="/messages"  element={<Messages />} />
                <Route path="/events"    element={<Events />} />
              </Route>

              {/* Full-screen protected pages (no tab bar) */}
              <Route path="/streams"              element={<Streams />} />
              <Route path="/notifications"        element={<Notifications />} />
              <Route path="/profile"              element={<ProfileYou />} />
              <Route path="/profile/:id"          element={<ProfileView />} />
              <Route path="/profile/:id/gallery"  element={<ProfileGallery />} />
              <Route path="/filters"              element={<Filters />} />
              <Route path="/chat/:id"             element={<Chat />} />
              <Route path="/match"                element={<MatchSuccess />} />
              <Route path="/stories/new"          element={<StoryComposer />} />
              <Route path="/stories/:userId"      element={<StoryPage />} />
              <Route path="/events/new"           element={<CreateEvent />} />
              <Route path="/events/:id"           element={<EventDetail />} />
              <Route path="/calendar"             element={<Calendar />} />
            </Route>
          </Route>

          {/* ── Catch-all ────────────────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Route>
      </Routes>
    </AuthFlowProvider>
  );
}