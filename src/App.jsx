import { Routes, Route, Navigate } from "react-router-dom";
import RootLayout from "./layouts/RootLayout.jsx";
import TabsLayout from "./layouts/TabsLayout.jsx";

import Onboarding from "./pages/Onboarding.jsx";
import AuthChoice from "./pages/AuthChoice.jsx";
import PhoneNumber from "./pages/PhoneNumber.jsx";
import OTPVerify from "./pages/OTPVerify.jsx";
import ProfileBasics from "./pages/ProfileBasics.jsx";
import DOB from "./pages/DOB.jsx";
import Gender from "./pages/Gender.jsx";
import Interests from "./pages/Interests.jsx";
import ContactsPermission from "./pages/ContactsPermission.jsx";
import NotificationsPermission from "./pages/NotificationsPermission.jsx";

import Discover from "./pages/Discover.jsx";
import Filters from "./pages/Filters.jsx";
import MatchSuccess from "./pages/MatchSuccess.jsx";
import Matches from "./pages/Matches.jsx";
import Messages from "./pages/Messages.jsx";
import Chat from "./pages/Chat.jsx";
import ProfileView from "./pages/ProfileView.jsx";
import ProfileYou from "./pages/ProfileYou.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        {/* Public / Auth */}
        <Route path="/" element={<Onboarding />} />
        <Route path="/auth" element={<AuthChoice />} />
        <Route path="/auth/phone" element={<PhoneNumber />} />
        <Route path="/auth/otp" element={<OTPVerify />} />
        <Route path="/profile/basics" element={<ProfileBasics />} />
        <Route path="/profile/dob" element={<DOB />} />
        <Route path="/profile/gender" element={<Gender />} />
        <Route path="/profile/interests" element={<Interests />} />
        <Route path="/permissions/contacts" element={<ContactsPermission />} />
        <Route path="/permissions/notifications" element={<NotificationsPermission />} />

        {/* Tab shell */}
        <Route element={<TabsLayout />}>
          <Route path="/discover" element={<Discover />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/profile" element={<ProfileYou />} />
        </Route>

        {/* Standalone */}
        <Route path="/filters" element={<Filters />} />
        <Route path="/match" element={<MatchSuccess />} />
        <Route path="/chat/:id" element={<Chat />} />
        <Route path="/profile/:id" element={<ProfileView />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}