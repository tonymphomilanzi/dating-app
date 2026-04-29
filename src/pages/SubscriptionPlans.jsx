// src/pages/SubscriptionPlans.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BoltIcon,
  StarIcon,
  CheckIcon,
  MinusIcon,
  ChevronLeftIcon,
  ChevronDownIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
  GlobeAltIcon,
  SparklesIcon,
  TrophyIcon,
  LockClosedIcon,
  CreditCardIcon,
  FireIcon,
} from "@heroicons/react/24/outline";
import {
  StarIcon as StarSolid,
  SparklesIcon as SparklesSolid,
  TrophyIcon as TrophySolid,
} from "@heroicons/react/24/solid";

/* ================================================================
   PLAN DATA
   ================================================================ */

const PLANS = [
  {
    id: "basic",
    name: "Basic",
    Icon: BoltIcon,
    iconBg: "bg-gray-100",
    iconColor: "text-gray-600",
    badge: null,
    priceMonthly: 9.99,
    priceAnnual: 5.99,
    color: {
      bg:        "bg-white",
      border:    "border-gray-200",
      ring:      "ring-gray-300",
      accent:    "text-gray-700",
      badgeCls:  "",
      btn:       "bg-gray-900 hover:bg-gray-800 text-white shadow-gray-200",
      radioFill: "bg-gray-700",
    },
    features: [
      { text: "5 Super Likes per day",     included: true  },
      { text: "See who liked you",         included: false },
      { text: "Unlimited likes",           included: false },
      { text: "Boost profile once a week", included: true  },
      { text: "Advanced filters",          included: false },
      { text: "Incognito mode",            included: false },
      { text: "Priority support",          included: false },
    ],
  },
  {
    id: "gold",
    name: "Gold",
    Icon: TrophyIcon,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    badge: "Most Popular",
    priceMonthly: 19.99,
    priceAnnual: 11.99,
    color: {
      bg:        "bg-gradient-to-b from-amber-50 to-orange-50",
      border:    "border-amber-300",
      ring:      "ring-amber-400",
      accent:    "text-amber-600",
      badgeCls:  "bg-amber-500 text-white",
      btn:       "bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white shadow-amber-200",
      radioFill: "bg-amber-500",
    },
    features: [
      { text: "Unlimited Super Likes",    included: true  },
      { text: "See who liked you",        included: true  },
      { text: "Unlimited likes",          included: true  },
      { text: "Boost profile once a day", included: true  },
      { text: "Advanced filters",         included: true  },
      { text: "Incognito mode",           included: false },
      { text: "Priority support",         included: false },
    ],
  },
  {
    id: "platinum",
    name: "Platinum",
    Icon: SparklesIcon,
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
    badge: "Best Value",
    priceMonthly: 29.99,
    priceAnnual: 17.99,
    color: {
      bg:        "bg-gradient-to-b from-violet-50 to-fuchsia-50",
      border:    "border-violet-400",
      ring:      "ring-violet-500",
      accent:    "text-violet-600",
      badgeCls:  "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white",
      btn:       "bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:from-violet-600 hover:to-fuchsia-700 text-white shadow-violet-200",
      radioFill: "bg-violet-600",
    },
    features: [
      { text: "Unlimited Super Likes",  included: true },
      { text: "See who liked you",      included: true },
      { text: "Unlimited likes",        included: true },
      { text: "Daily profile boosts",   included: true },
      { text: "Advanced filters",       included: true },
      { text: "Incognito mode",         included: true },
      { text: "Priority support",       included: true },
    ],
  },
];

const TRUST_BADGES = [
  { Icon: ShieldCheckIcon, label: "Secure Payment", color: "text-green-600",  bg: "bg-green-50"  },
  { Icon: ArrowPathIcon,   label: "Cancel Anytime", color: "text-blue-600",   bg: "bg-blue-50"   },
  { Icon: GlobeAltIcon,    label: "Global Access",  color: "text-violet-600", bg: "bg-violet-50" },
];

const FAQ_ITEMS = [
  {
    q: "Can I cancel my subscription anytime?",
    a: "Yes! You can cancel at any time from your account settings. You'll retain access until the end of your billing period.",
  },
  {
    q: "Will I be charged automatically?",
    a: "Yes, your plan auto-renews unless cancelled. You'll receive a reminder email 3 days before each renewal.",
  },
  {
    q: "Is my payment information secure?",
    a: "Absolutely. We use industry-standard encryption and never store your card details on our servers.",
  },
  {
    q: "Can I switch plans later?",
    a: "Yes, you can upgrade or downgrade at any time. Prorated credits apply when upgrading.",
  },
];

/* ================================================================
   MAIN PAGE
   ================================================================ */

export default function SubscriptionPlans() {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState("gold");
  const [billing, setBilling] = useState("annual");

  const chosen = PLANS.find((p) => p.id === selectedPlan);
  const chosenPrice = billing === "annual"
    ? chosen?.priceAnnual
    : chosen?.priceMonthly;

  const annualSaving = (plan) =>
    Math.round((plan.priceMonthly - plan.priceAnnual) * 12);

 const handleContinue = () => {
  // Only pass plain serializable data — NO Icon components or functions
  navigate("/subscription/payment", {
    state: {
      planId:   chosen?.id,
      billing,
    },
  });
};

  return (
    <div className="min-h-dvh bg-gray-50 pb-48 antialiased">

      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-xl border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-lg px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 active:scale-95 transition-all"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-extrabold text-gray-900 leading-tight">
              Choose Your Plan
            </h1>
            <p className="text-xs text-gray-400">Cancel anytime · No hidden fees</p>
          </div>

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-md">
            <TrophyIcon className="h-4 w-4 text-white" />
          </div>
        </div>
      </div>

      {/* ── Scrollable Content ── */}
      <div className="mx-auto max-w-lg px-4 pt-6 space-y-6">

        <HeroBanner />
        <BillingToggle billing={billing} onChange={setBilling} />

        {/* Plan Cards */}
        <div className="space-y-3">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              billing={billing}
              isSelected={selectedPlan === plan.id}
              onSelect={() => setSelectedPlan(plan.id)}
              saving={annualSaving(plan)}
            />
          ))}
        </div>

        {/* Trust Badges */}
        <div className="grid grid-cols-3 gap-3">
          {TRUST_BADGES.map(({ Icon, label, color, bg }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-2 rounded-2xl bg-white border border-gray-100 py-4 px-2 shadow-sm text-center"
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-full ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <p className="text-[11px] font-semibold text-gray-600 leading-tight">
                {label}
              </p>
            </div>
          ))}
        </div>

        <StatsRow />
        <FaqSection />
        <div className="h-2" />
      </div>

      <StickyCtaBar
        chosen={chosen}
        billing={billing}
        chosenPrice={chosenPrice}
        onContinue={handleContinue}
      />
    </div>
  );
}

/* ================================================================
   HERO BANNER
   ================================================================ */

function HeroBanner() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500 p-6 text-white shadow-xl shadow-violet-200">
      <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/10" />

      {/* Icon row */}
      <div className="relative flex items-center gap-2 mb-4">
        {[
          { Icon: SparklesIcon,  bg: "bg-white/20",       color: "text-white"        },
          { Icon: TrophyIcon,    bg: "bg-amber-400/40",   color: "text-amber-200"    },
          { Icon: FireIcon,      bg: "bg-pink-400/30",    color: "text-pink-200"     },
        ].map(({ Icon, bg, color }, i) => (
          <div
            key={i}
            className={`flex h-10 w-10 items-center justify-center rounded-2xl ${bg} backdrop-blur-sm`}
          >
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        ))}
      </div>

      <div className="relative">
        <p className="text-2xl font-extrabold leading-tight">
          Find your perfect<br />match, faster.
        </p>
        <p className="mt-2 text-sm text-white/80 max-w-xs leading-relaxed">
          Premium members get{" "}
          <span className="font-bold text-white">3× more matches</span> and{" "}
          <span className="font-bold text-white">5× more profile views</span>.
        </p>
      </div>
    </div>
  );
}

/* ================================================================
   BILLING TOGGLE
   ================================================================ */

function BillingToggle({ billing, onChange }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="inline-flex items-center rounded-2xl bg-gray-100 p-1 gap-1">
        {[
          { id: "monthly", label: "Monthly" },
          { id: "annual",  label: "Annual"  },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={[
              "relative rounded-xl px-6 py-2.5 text-sm font-bold transition-all duration-200",
              billing === id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700",
            ].join(" ")}
          >
            {label}
            {id === "annual" && billing !== "annual" && (
              <span className="absolute -right-1.5 -top-2 rounded-full bg-green-500 px-1.5 py-0.5 text-[9px] font-extrabold text-white shadow leading-none">
                SAVE
              </span>
            )}
          </button>
        ))}
      </div>

      {billing === "annual" && (
        <p className="text-xs font-semibold text-green-600 flex items-center gap-1">
          <CheckIcon className="h-3.5 w-3.5" />
          Save up to 40% with annual billing
        </p>
      )}
    </div>
  );
}

/* ================================================================
   PLAN CARD
   ================================================================ */

function PlanCard({ plan, billing, isSelected, onSelect, saving }) {
  const price = billing === "annual" ? plan.priceAnnual : plan.priceMonthly;
  const { Icon } = plan;

  return (
    <button
      onClick={onSelect}
      className={[
        "relative w-full text-left rounded-3xl border-2 p-5 transition-all duration-200",
        plan.color.bg,
        isSelected
          ? `${plan.color.border} ring-2 ${plan.color.ring} shadow-xl scale-[1.01]`
          : "border-gray-200 hover:border-gray-300 hover:shadow-md active:scale-[0.99]",
      ].join(" ")}
    >
      {/* Badge */}
      {plan.badge && (
        <span
          className={`absolute right-4 top-4 rounded-full px-3 py-1 text-[11px] font-extrabold shadow-sm ${plan.color.badgeCls}`}
        >
          {plan.badge}
        </span>
      )}

      {/* Header row */}
      <div className="flex items-center gap-3 mb-4 pr-20">
        {/* Radio */}
        <div
          className={[
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all",
            isSelected ? plan.color.border : "border-gray-300 bg-white",
          ].join(" ")}
        >
          {isSelected && (
            <div className={`h-2 w-2 rounded-full ${plan.color.radioFill}`} />
          )}
        </div>

        {/* Plan icon */}
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${plan.iconBg}`}>
          <Icon className={`h-5 w-5 ${plan.iconColor}`} />
        </div>

        {/* Name + saving */}
        <div className="min-w-0">
          <p className="font-extrabold text-gray-900 text-base leading-none">
            {plan.name}
          </p>
          {billing === "annual" && (
            <p className="text-[11px] text-green-600 font-bold mt-0.5">
              Save ${saving}/yr vs monthly
            </p>
          )}
        </div>

        {/* Price */}
        <div className="ml-auto text-right shrink-0">
          <p className={`text-2xl font-extrabold leading-none ${plan.color.accent}`}>
            ${price.toFixed(2)}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            /mo{billing === "annual" ? " · annual" : ""}
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px mb-4 bg-gray-100" />

      {/* Features */}
      <div className="space-y-2.5">
        {plan.features.map((feat, i) => (
          <div key={i} className="flex items-center gap-2.5">
            {feat.included ? (
              <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${plan.iconBg}`}>
                <CheckIcon className={`h-3 w-3 ${plan.iconColor}`} strokeWidth={3} />
              </div>
            ) : (
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100">
                <MinusIcon className="h-3 w-3 text-gray-400" strokeWidth={2.5} />
              </div>
            )}
            <span className={`text-sm leading-none ${feat.included ? "text-gray-800 font-medium" : "text-gray-400"}`}>
              {feat.text}
            </span>
          </div>
        ))}
      </div>
    </button>
  );
}

/* ================================================================
   STATS ROW
   ================================================================ */

function StatsRow() {
  const stats = [
    { value: "3×",   label: "More Matches",     Icon: StarSolid,      color: "text-amber-500",  bg: "bg-amber-50"  },
    { value: "5×",   label: "Profile Views",     Icon: SparklesSolid,  color: "text-violet-600", bg: "bg-violet-50" },
    { value: "94%",  label: "Satisfaction Rate", Icon: TrophySolid,    color: "text-green-600",  bg: "bg-green-50"  },
  ];

  return (
    <div className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 text-center">
        Why go Premium?
      </p>
      <div className="grid grid-cols-3 divide-x divide-gray-100">
        {stats.map(({ value, label, Icon, color, bg }) => (
          <div key={label} className="flex flex-col items-center gap-2 px-2 text-center">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full ${bg}`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <p className={`text-xl font-extrabold ${color}`}>{value}</p>
            <p className="text-[10px] font-semibold text-gray-500 leading-tight">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================
   FAQ SECTION
   ================================================================ */

function FaqSection() {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <div className="rounded-3xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-gray-50 flex items-center gap-2">
        <LockClosedIcon className="h-4 w-4 text-violet-500 shrink-0" />
        <h3 className="text-base font-bold text-gray-900">
          Frequently Asked Questions
        </h3>
      </div>

      <div className="divide-y divide-gray-50">
        {FAQ_ITEMS.map((item, i) => (
          <div key={i}>
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-gray-50/60 transition-colors"
            >
              <span className="text-sm font-semibold text-gray-800 leading-snug">
                {item.q}
              </span>
              <ChevronDownIcon
                className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${
                  openIndex === i ? "rotate-180" : ""
                }`}
              />
            </button>

            {openIndex === i && (
              <div className="px-5 pb-4 animate-in fade-in slide-in-from-top-1 duration-200">
                <p className="text-sm text-gray-500 leading-relaxed">{item.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================
   STICKY CTA BAR
   ================================================================ */

function StickyCtaBar({ chosen, billing, chosenPrice, onContinue }) {
  if (!chosen) return null;

  const annualTotal = chosen.priceAnnual * 12;

  return (
    <div className="fixed bottom-0 inset-x-0 z-30 pointer-events-none">
      <div className="h-8 bg-gradient-to-t from-gray-50 to-transparent" />

      <div
        className="bg-white/95 backdrop-blur-xl border-t border-gray-100 shadow-2xl px-4 pt-4 pointer-events-auto"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
      >
        {/* Summary row */}
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${chosen.iconBg}`}>
              <chosen.Icon className={`h-5 w-5 ${chosen.iconColor}`} />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 font-medium">Selected plan</p>
              <p className="text-sm font-extrabold text-gray-900 leading-tight">
                {chosen.name}
                <span className="ml-1.5 text-xs font-semibold text-gray-400">
                  · {billing === "annual" ? "Annual" : "Monthly"}
                </span>
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className={`text-2xl font-extrabold leading-none ${chosen.color.accent}`}>
              ${chosenPrice?.toFixed(2)}
              <span className="text-sm font-semibold text-gray-400">/mo</span>
            </p>
            {billing === "annual" && (
              <p className="text-[11px] text-green-600 font-bold mt-0.5">
                ${annualTotal.toFixed(2)} billed annually
              </p>
            )}
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={onContinue}
          className={[
            "relative w-full overflow-hidden rounded-2xl py-4 text-base font-extrabold",
            "text-white shadow-lg active:scale-[0.98] transition-all duration-200",
            chosen.color.btn,
          ].join(" ")}
        >
          <span className="pointer-events-none absolute inset-0 -skew-x-12 translate-x-[-200%] animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <span className="relative flex items-center justify-center gap-2.5">
            <CreditCardIcon className="h-5 w-5" />
            Continue with {chosen.name}
            <ChevronRightIcon className="h-4 w-4" />
          </span>
        </button>

        <p className="mt-2.5 text-center text-[11px] text-gray-400 leading-relaxed">
          By continuing you agree to our{" "}
          <button className="underline underline-offset-2 hover:text-gray-600 transition-colors font-medium">
            Terms of Service
          </button>{" "}
          and{" "}
          <button className="underline underline-offset-2 hover:text-gray-600 transition-colors font-medium">
            Privacy Policy
          </button>
        </p>
      </div>
    </div>
  );
}

/* ================================================================
   LOCAL ICON  — ChevronRight (not in @heroicons/24/outline named set)
   ================================================================ */

function ChevronRightIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}