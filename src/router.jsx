// src/router.jsx
import {
  createRouter,
  createRoute,
  createRootRoute,
  redirect,
  Outlet,
} from "@tanstack/react-router";

// ── Layouts ───────────────────────────────────────────────────────
import RootLayout from "./layouts/RootLayout";
import TabsLayout from "./layouts/TabsLayout";

// ── Auth helpers ──────────────────────────────────────────────────
import { getAuthSession } from "./lib/auth";
import { getProfileCompletion } from "./lib/profile";

// ── Contexts ──────────────────────────────────────────────────────
import { AuthProvider } from "./contexts/AuthContext";
import { AuthFlowProvider } from "./contexts/AuthFlowContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { Toaster } from "@/components/ui/sonner";

// ── Public pages ──────────────────────────────────────────────────
import Onboarding from "./pages/Onboarding";
import AuthChoice from "./pages/AuthChoice";
import EmailVerify from "./pages/EmailVerify";
import AuthCallback from "./pages/AuthCallback";
import SignUp from "./pages/SignUp";
import SignInEmail from "./pages/SignInEmail";
import ForgotPassword from "./pages/ForgotPassword";

// ── Setup wizard ──────────────────────────────────────────────────
import SetupBasics from "./pages/setup/Basics";
import SetupDOB from "./pages/setup/DOB";
import SetupGender from "./pages/setup/Gender";
import SetupInterests from "./pages/setup/Interests";
import SetupPhoto from "./pages/setup/Photo";

// ── Tab pages ─────────────────────────────────────────────────────
import Discover from "./pages/Discover";
import Matches from "./pages/Matches";
import Messages from "./pages/Messages";
import Events from "./pages/Events";
import MassageClinic from "./pages/MassageClinic";

// ── Full screen pages ─────────────────────────────────────────────
import ProfileYou from "./pages/ProfileYou";
import Filters from "./pages/Filters";
import Chat from "./pages/Chat";
import ProfileView from "./pages/ProfileView";
import MatchSuccess from "./pages/MatchSuccess";
import ProfileGallery from "./pages/ProfileGallery";
import StoryComposer from "./pages/StoryComposer";
import StoryPage from "./pages/StoryPage";
import EventDetail from "./pages/EventDetail";
import CreateEvent from "./pages/CreateEvent";
import EditEvent from "./pages/EditEvent";
import Calendar from "./pages/Calendar";
import Notifications from "./pages/Notifications";
import Streams from "./pages/Streams";
import CreateMassageClinic from "./pages/CreateMassageClinic";
import MassageClinicDetail from "./pages/MassageClinicDetail";
import SubscriptionPlans from "./pages/SubscriptionPlans";
import SubscriptionPayment from "./pages/SubscriptionPayment";
import Feeds from "./pages/Feeds";
import FeedPost from "./pages/FeedPost";
import FeedDetail from "./pages/FeedDetail";

// ── Admin ─────────────────────────────────────────────────────────
import AdminApp from "./admin/AdminApp";

/* ================================================================
   ROOT ROUTE
   Single place for all providers — no more double mounting
   ================================================================ */
const rootRoute = createRootRoute({
  component: () => (
    <AuthProvider>
      <AuthFlowProvider>
        <NotificationProvider>
          <Toaster richColors closeButton position="top-center" />
          <Outlet />
        </NotificationProvider>
      </AuthFlowProvider>
    </AuthProvider>
  ),
});

/* ================================================================
   ADMIN ROUTE
   Completely isolated from main app
   ================================================================ */
const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: AdminApp,
});

/* ================================================================
   AUTH CALLBACK
   Public — no guard needed
   ================================================================ */
const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth/callback",
  component: AuthCallback,
});

/* ================================================================
   GUEST LAYOUT ROUTE
   If already logged in → go to /discover
   ================================================================ */
const guestRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "guest",
  beforeLoad: async () => {
    const session = await getAuthSession();
    if (session) {
      throw redirect({ to: "/discover" });
    }
  },
  component: Outlet,
});

const onboardingRoute = createRoute({
  getParentRoute: () => guestRoute,
  path: "/",
  component: Onboarding,
});

const authChoiceRoute = createRoute({
  getParentRoute: () => guestRoute,
  path: "/auth",
  component: AuthChoice,
});

const signInEmailRoute = createRoute({
  getParentRoute: () => guestRoute,
  path: "/auth/email",
  component: SignInEmail,
});

const signInEmailAltRoute = createRoute({
  getParentRoute: () => guestRoute,
  path: "/auth/signin/email",
  component: SignInEmail,
});

const emailVerifyRoute = createRoute({
  getParentRoute: () => guestRoute,
  path: "/auth/email-verify",
  component: EmailVerify,
});

const emailVerifyAltRoute = createRoute({
  getParentRoute: () => guestRoute,
  path: "/auth/verify",
  component: EmailVerify,
});

const signUpRoute = createRoute({
  getParentRoute: () => guestRoute,
  path: "/auth/signup",
  component: SignUp,
});

const forgotPasswordRoute = createRoute({
  getParentRoute: () => guestRoute,
  path: "/auth/forgot-password",
  component: ForgotPassword,
});

/* ================================================================
   AUTH LAYOUT ROUTE
   If not logged in → go to /
   ================================================================ */
const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "auth",
  beforeLoad: async () => {
    const session = await getAuthSession();
    if (!session) {
      throw redirect({ to: "/" });
    }
  },
  component: Outlet,
});

/* ================================================================
   SETUP WIZARD ROUTES
   Auth required but NO profile completion check
   ================================================================ */
const setupBasicsRoute = createRoute({
  getParentRoute: () => authRoute,
  path: "/setup/basics",
  component: SetupBasics,
});

const setupDOBRoute = createRoute({
  getParentRoute: () => authRoute,
  path: "/setup/dob",
  component: SetupDOB,
});

const setupGenderRoute = createRoute({
  getParentRoute: () => authRoute,
  path: "/setup/gender",
  component: SetupGender,
});

const setupInterestsRoute = createRoute({
  getParentRoute: () => authRoute,
  path: "/setup/interests",
  component: SetupInterests,
});

const setupPhotoRoute = createRoute({
  getParentRoute: () => authRoute,
  path: "/setup/photo",
  component: SetupPhoto,
});

/* ================================================================
   SETUP GATE ROUTE
   Auth + profile must be complete
   Redirects to correct setup step if incomplete
   ================================================================ */
const setupGateRoute = createRoute({
  getParentRoute: () => authRoute,
  id: "setupGate",
  beforeLoad: async () => {
    const completion = await getProfileCompletion();
    if (!completion.isComplete) {
      throw redirect({ to: completion.redirectTo });
    }
  },
  component: Outlet,
});

/* ================================================================
   TABS LAYOUT ROUTE
   Bottom navigation pages
   ================================================================ */
const tabsRoute = createRoute({
  getParentRoute: () => setupGateRoute,
  id: "tabs",
  component: TabsLayout,
});

const discoverRoute = createRoute({
  getParentRoute: () => tabsRoute,
  path: "/discover",
  component: Discover,
});

const matchesRoute = createRoute({
  getParentRoute: () => tabsRoute,
  path: "/matches",
  component: Matches,
});

const messagesRoute = createRoute({
  getParentRoute: () => tabsRoute,
  path: "/messages",
  component: Messages,
});

const eventsTabRoute = createRoute({
  getParentRoute: () => tabsRoute,
  path: "/events",
  component: Events,
});

const massageClinicsTabRoute = createRoute({
  getParentRoute: () => tabsRoute,
  path: "/massage-clinics",
  component: MassageClinic,
});

/* ================================================================
   FULL SCREEN ROUTES
   Auth + profile complete, outside tabs layout
   ================================================================ */
const streamsRoute = createRoute({
  getParentRoute: () => setupGateRoute,
  path: "/streams",
  component: Streams,
});

const notificationsRoute = createRoute({
  getParentRoute: () => setupGateRoute,
  path: "/notifications",
  component: Notifications,
});

const profileYouRoute = createRoute({
  getParentRoute: () => setupGateRoute,
  path: "/profile",
  component: ProfileYou,
});

const profileViewRoute = createRoute({
  getParentRoute: () => setupGateRoute,
  path: "/profile/$id",
  component: ProfileView,
});

const profileGalleryRoute = createRoute({
  getParentRoute: () => setupGateRoute,
  path: "/profile/$id/gallery",
  component: ProfileGallery,
});

const filtersRoute = createRoute({
  getParentRoute: () => setupGateRoute,
  path: "/filters",
  component: Filters,
});

const chatRoute = createRoute({
  getParentRoute: () => setupGateRoute,
  path: "/chat/$id",
  component: Chat,
});

const matchSuccessRoute = createRoute({
  getParentRoute: () => setupGateRoute,
  path: "/match",
  component: MatchSuccess,
});

const storyComposerRoute = createRoute({
  getParentRoute: () => setupGateRoute,
  path: "/stories/new",
  component: StoryComposer,
});

const storyPageRoute = createRoute({
  getParentRoute: () => setupGateRoute,
  path: "/stories/$userId",
  component: StoryPage,
});

// ── Events ────────────────────────────────────────────────────────
const createEventRoute = createRoute({
  getParentRoute: () => setupGateRoute,
  path: "/events/new",
  component: CreateEvent,
});

const editEventRoute = createRoute({
  getParentRoute: () => setupGateRoute,
  path: "/events/$id/edit",
  component: EditEvent,
});

const eventDetailRoute = createRoute({
  getParentRoute: () => setupGateRoute,
  path: "/events/$id",
  component: EventDetail,
});

const calendarRoute = createRoute({
  getParentRoute: () => setupGateRoute,
  path: "/calendar",
  component: Calendar,
});

// ── Massage Clinics ───────────────────────────────────────────────
const createMassageClinicRoute = createRoute({
  getParentRoute: () => setupGateRoute,
  path: "/massage-clinics/new",
  component: CreateMassageClinic,
});

const editMassageClinicRoute = createRoute({
  getParentRoute: () => setupGateRoute,
  path: "/massage-clinics/$id/edit",
  component: CreateMassageClinic,
});

const massageClinicDetailRoute = createRoute({
  getParentRoute: () => setupGateRoute,
  path: "/massage-clinics/$id",
  component: MassageClinicDetail,
});

// ── Feeds ─────────────────────────────────────────────────────────
const feedsRoute = createRoute({
  getParentRoute: () => setupGateRoute,
  path: "/feeds",
  component: Feeds,
});

const feedPostRoute = createRoute({
  getParentRoute: () => setupGateRoute,
  path: "/feeds/new",
  component: FeedPost,
});

const feedDetailRoute = createRoute({
  getParentRoute: () => setupGateRoute,
  path: "/feed/$id",
  component: FeedDetail,
});

// ── Subscriptions ─────────────────────────────────────────────────
const subscriptionPlansRoute = createRoute({
  getParentRoute: () => setupGateRoute,
  path: "/subscription",
  component: SubscriptionPlans,
});

const subscriptionPaymentRoute = createRoute({
  getParentRoute: () => setupGateRoute,
  path: "/subscription/payment",
  component: SubscriptionPayment,
});

/* ================================================================
   CATCH-ALL
   ================================================================ */
const catchAllRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "*",
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  component: () => null,
});

/* ================================================================
   ROUTE TREE
   ================================================================ */
const routeTree = rootRoute.addChildren([
  adminRoute,
  authCallbackRoute,

  guestRoute.addChildren([
    onboardingRoute,
    authChoiceRoute,
    signInEmailRoute,
    signInEmailAltRoute,
    emailVerifyRoute,
    emailVerifyAltRoute,
    signUpRoute,
    forgotPasswordRoute,
  ]),

  authRoute.addChildren([
    setupBasicsRoute,
    setupDOBRoute,
    setupGenderRoute,
    setupInterestsRoute,
    setupPhotoRoute,

    setupGateRoute.addChildren([
      tabsRoute.addChildren([
        discoverRoute,
        matchesRoute,
        messagesRoute,
        eventsTabRoute,
        massageClinicsTabRoute,
      ]),

      streamsRoute,
      notificationsRoute,
      profileYouRoute,
      profileViewRoute,
      profileGalleryRoute,
      filtersRoute,
      chatRoute,
      matchSuccessRoute,
      storyComposerRoute,
      storyPageRoute,
      createEventRoute,
      editEventRoute,
      eventDetailRoute,
      calendarRoute,
      createMassageClinicRoute,
      editMassageClinicRoute,
      massageClinicDetailRoute,
      feedsRoute,
      feedPostRoute,
      feedDetailRoute,
      subscriptionPlansRoute,
      subscriptionPaymentRoute,
    ]),
  ]),

  catchAllRoute,
]);

/* ================================================================
   ROUTER INSTANCE
   ================================================================ */
export const router = createRouter({
  routeTree,
  defaultPreload: "intent",     // Preload data on hover/focus
  defaultPreloadDelay: 50,      // 50ms before preload fires
  defaultStaleTime: 1000 * 60,  // Routes stay fresh for 1 minute
});