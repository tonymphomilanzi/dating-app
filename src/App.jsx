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

import Discover from "./pages/Discover.jsx";
import Matches from "./pages/Matches.jsx";
import Messages from "./pages/Messages.jsx";
import ProfileYou from "./pages/ProfileYou.jsx";
import Filters from "./pages/Filters.jsx";
import Chat from "./pages/Chat.jsx";
import ProfileView from "./pages/ProfileView.jsx";
import MatchSuccess from "./pages/MatchSuccess.jsx";

import SetupBasics from "./pages/setup/Basics.jsx";
import SetupDOB from "./pages/setup/DOB.jsx";
import SetupGender from "./pages/setup/Gender.jsx";
import SetupInterests from "./pages/setup/Interests.jsx";
import SetupPhoto from "./pages/setup/Photo.jsx";
import UserProfile from "./pages/UserProfile.jsx";
import ProfileGallery from "./pages/ProfileGallery.jsx";

import StoryComposer from "./pages/StoryComposer.jsx";
import StoryPage from "./pages/StoryPage.jsx";
import Events from "./pages/Events.jsx";
import EventDetail from "./pages/EventDetail.jsx";

import CreateEvent from "./pages/CreateEvent.jsx";
import Calendar from "./pages/Calendar.jsx";

import SignUp from "./pages/SignUp.jsx";
import SignInEmail from "./pages/SignInEmail.jsx";
import { AuthFlowProvider } from "./contexts/AuthFlowContext.jsx";


export default function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        {/* Magic-link callback must be reachable unauthenticated */}
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Public (only while logged out) */}
        
        <Route element={<GuestOnly />}>
          <Route path="/" element={<Onboarding />} />
          <Route path="/auth" element={<AuthChoice />} />
          <Route path="/auth/email" element={<EmailLogin />} />
          <Route path="/auth/email-verify" element={<EmailVerify />} />
          <Route path="/auth/signup" element={<SignUp />} />
          <Route path="/auth/signin/email" element={<SignInEmail />} />
        </Route>

        {/* Protected */}
        <Route element={<RequireAuth />}>
          {/* Setup flow (always reachable) */}
          <Route path="/setup/basics" element={<SetupBasics />} />
          <Route path="/setup/dob" element={<SetupDOB />} />
          <Route path="/setup/gender" element={<SetupGender />} />
          <Route path="/setup/interests" element={<SetupInterests />} />
          <Route path="/setup/photo" element={<SetupPhoto />} />

          {/* App gated by setup completion */}
          <Route element={<SetupGate />}>
            <Route element={<TabsLayout />}>

              <Route path="/discover" element={<Discover />} />
              <Route path="/matches" element={<Matches />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/events" element={<Events />} />
         
            </Route>
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/profile" element={<ProfileYou />} />
            <Route path="/filters" element={<Filters />} />
            <Route path="/chat/:id" element={<Chat />} />
            <Route path="/profile/:id" element={<ProfileView />} />
            <Route path="/match" element={<MatchSuccess />} />
            <Route path="/stories/new" element={<StoryComposer />} />
            <Route path="/stories/:userId" element={<StoryPage />} />
            <Route path="/events/new" element={<CreateEvent />} />
            <Route path="/calendar" element={<Calendar />} />
         
          </Route>
          
      <Route path="/profile/:id/gallery" element={<ProfileGallery />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}