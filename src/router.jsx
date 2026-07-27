// src/router.jsx
import {
  createRouter,
  createRoute,
  createRootRoute,
  redirect,
  Outlet,
} from "@tanstack/react-router";

// ── Auth helpers (reads from memory — no DB calls) ────────────────
import { getAuthSession }      from "./lib/auth.js";
import { getProfileCompletion } from "./lib/profile.js";

// ── Contexts ──────────────────────────────────────────────────────
import { AuthProvider }        from "./contexts/AuthContext.jsx";
import { AuthFlowProvider }    from "./contexts/AuthFlowContext.jsx";
import { NotificationProvider } from "./contexts/NotificationContext.jsx";
import { Toaster }             from "@/components/ui/sonner";

// ── Layouts ───────────────────────────────────────────────────────
import RootLayout  from "./layouts/RootLayout.jsx";
import TabsLayout  from "./layouts/TabsLayout.jsx";

// ── Public pages ──────────────────────────────────────────────────
import Onboarding      from "./pages/Onboarding.jsx";
import AuthChoice      from "./pages/AuthChoice.jsx";
import EmailVerify     from "./pages/EmailVerify.jsx";
import AuthCallback    from "./pages/AuthCallback.jsx";
import SignUp          from "./pages/SignUp.jsx";
import SignInEmail     from "./pages/SignInEmail.jsx";
import ForgotPassword  from "./pages/ForgotPassword.jsx";

// ── Setup wizard ──────────────────────────────────────────────────
import SetupBasics    from "./pages/setup/Basics.jsx";
import SetupDOB       from "./pages/setup/DOB.jsx";
import SetupGender    from "./pages/setup/Gender.jsx";
import SetupInterests from "./pages/setup/Interests.jsx";
import SetupPhoto     from "./pages/setup/Photo.jsx";

// ── Tab pages ─────────────────────────────────────────────────────
import Discover    from "./pages/Discover.jsx";
import Matches     from "./pages/Matches.jsx";
import Messages    from "./pages/Messages.jsx";
import Events      from "./pages/Events.jsx";
import MassageClinic from "./pages/MassageClinic.jsx";

// ── Full screen pages ─────────────────────────────────────────────
import ProfileYou          from "./pages/ProfileYou.jsx";
import Filters             from "./pages/Filters.jsx";
import Chat                from "./pages/Chat.jsx";
import ProfileView         from "./pages/ProfileView.jsx";
import MatchSuccess        from "./pages/MatchSuccess.jsx";
import ProfileGallery      from "./pages/ProfileGallery.jsx";
import StoryComposer       from "./pages/StoryComposer.jsx";
import StoryPage           from "./pages/StoryPage.jsx";
import EventDetail         from "./pages/EventDetail.jsx";
import CreateEvent         from "./pages/CreateEvent.jsx";
import EditEvent           from "./pages/EditEvent.jsx";
import Calendar            from "./pages/Calendar.jsx";
import Notifications       from "./pages/Notifications.jsx";
import Streams             from "./pages/Streams.jsx";
import CreateMassageClinic from "./pages/CreateMassageClinic.jsx";
import MassageClinicDetail from "./pages/MassageClinicDetail.jsx";
import SubscriptionPlans   from "./pages/SubscriptionPlans.jsx";
import SubscriptionPayment from "./pages/SubscriptionPayment.jsx";
import Feeds               from "./pages/Feeds.jsx";
import FeedPost            from "./pages/FeedPost.jsx";
import FeedDetail          from "./pages/FeedDetail.jsx";

// ── Admin ─────────────────────────────────────────────────────────
import AdminApp from "./admin/AdminApp.jsx";

/* ================================================================
   ROOT ROUTE — providers live here, rendered once, never unmount
   ================================================================ */
const rootRoute = createRootRoute({
  component: () => (
    <AuthProvider>
      <AuthFlowProvider>
        <NotificationProvider>
          <Toaster richColors closeButton position="top-center" />
          <RootLayout />
        </NotificationProvider>
      </AuthFlowProvider>
    </AuthProvider>
  ),
});

/* ================================================================
   ADMIN — completely isolated
   ================================================================ */
const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: AdminApp,
});

/* ================================================================
   AUTH CALLBACK — public, no guard
   ================================================================ */
const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth/callback",
  component: AuthCallback,
});

/* ================================================================
   GUEST ROUTES — redirect to /discover if already logged in
   ================================================================ */
const guestRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "guest",
  beforeLoad: async () => {
    const session = await getAuthSession();
    if (session) throw redirect({ to: "/discover" });
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
   AUTH ROUTES — redirect to / if not logged in
   ================================================================ */
const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "auth",
  beforeLoad: async () => {
    const session = await getAuthSession();
    if (!session) throw redirect({ to: "/" });
  },
  component: Outlet,
});

/* ================================================================
   SETUP WIZARD — auth required, no profile gate
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
   SETUP GATE — profile must be complete
   Reads from authStore (in-memory) — no DB call on navigation
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
   TABS LAYOUT — bottom navigation
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
   FULL SCREEN PAGES
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
  beforeLoad: () => { throw redirect({ to: "/" }); },
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
   ROUTER
   ================================================================ */
export const router = createRouter({
  routeTree,
  defaultPreload: "intent",    // preload on hover/focus = instant feel
  defaultPreloadDelay: 50,     // 50ms hover before preload fires
  defaultStaleTime: 1000 * 60, // routes stay fresh 1 minute
});