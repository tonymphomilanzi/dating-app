// src/pages/SubscriptionPayment.jsx
import React, { useState, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { supabase } from "../lib/supabase.client.js";

/* ================================================================
   PLAN DEFINITIONS  (plain data only — no React components here)
   ================================================================ */

const PLANS_DATA = [
  {
    id:           "basic",
    name:         "Basic",
    iconId:       "bolt",
    iconBg:       "bg-gray-100",
    iconColor:    "text-gray-600",
    priceMonthly: 9.99,
    priceAnnual:  5.99,
    color: {
      bg:        "bg-white",
      border:    "border-gray-200",
      ring:      "ring-gray-300",
      accent:    "text-gray-700",
      badgeCls:  "",
      btn:       "bg-gray-900 hover:bg-gray-800 text-white shadow-gray-200",
      radioFill: "bg-gray-700",
    },
  },
  {
    id:           "gold",
    name:         "Gold",
    iconId:       "trophy",
    iconBg:       "bg-amber-100",
    iconColor:    "text-amber-600",
    priceMonthly: 19.99,
    priceAnnual:  11.99,
    color: {
      bg:        "bg-gradient-to-b from-amber-50 to-orange-50",
      border:    "border-amber-300",
      ring:      "ring-amber-400",
      accent:    "text-amber-600",
      badgeCls:  "bg-amber-500 text-white",
      btn:       "bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white shadow-amber-200",
      radioFill: "bg-amber-500",
    },
  },
  {
    id:           "platinum",
    name:         "Platinum",
    iconId:       "sparkles",
    iconBg:       "bg-violet-100",
    iconColor:    "text-violet-600",
    priceMonthly: 29.99,
    priceAnnual:  17.99,
    color: {
      bg:        "bg-gradient-to-b from-violet-50 to-fuchsia-50",
      border:    "border-violet-400",
      ring:      "ring-violet-500",
      accent:    "text-violet-600",
      badgeCls:  "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white",
      btn:       "bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:from-violet-600 hover:to-fuchsia-700 text-white shadow-violet-200",
      radioFill: "bg-violet-600",
    },
  },
];

/* ================================================================
   PAYMENT METHOD CONFIG
   ================================================================ */

const CRYPTO_OPTIONS = [
  {
    id:            "btc",
    symbol:        "BTC",
    name:          "Bitcoin",
    network:       "Bitcoin Network",
    address:       "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    confirmations: "1 confirmation (~10 min)",
    iconId:        "bitcoin",
    color:         "text-orange-500",
    bg:            "bg-orange-50",
    border:        "border-orange-200",
    ring:          "ring-orange-400",
  },
  {
    id:            "usdt_trc20",
    symbol:        "USDT",
    name:          "Tether (TRC-20)",
    network:       "TRON Network",
    address:       "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
    confirmations: "20 confirmations (~1 min)",
    iconId:        "tether",
    color:         "text-emerald-600",
    bg:            "bg-emerald-50",
    border:        "border-emerald-200",
    ring:          "ring-emerald-400",
  },
];

const PAYMENT_METHODS = [
  {
    id:        "crypto",
    label:     "Crypto",
    sublabel:  "BTC · USDT",
    iconId:    "crypto",
    color:     "text-orange-500",
    bg:        "bg-orange-50",
    border:    "border-orange-200",
    accentBtn: "bg-orange-500 hover:bg-orange-600 text-white shadow-orange-200",
  },
  {
    id:        "momo",
    label:     "Mobile Money",
    sublabel:  "Instant transfer",
    iconId:    "phone",
    color:     "text-violet-600",
    bg:        "bg-violet-50",
    border:    "border-violet-200",
    accentBtn: "bg-violet-600 hover:bg-violet-700 text-white shadow-violet-200",
    fields: [
      { label: "Provider",     value: "MTN Mobile Money / Orange Money" },
      { label: "Phone Number", value: "+1 (555) 000-0000", copyable: true },
      { label: "Account Name", value: "MatchApp Inc."                    },
    ],
    instructions: [
      "Open your Mobile Money app.",
      'Select "Send Money" or "Transfer".',
      "Enter the phone number above.",
      "Enter the exact amount shown.",
      "Use your Order ID as the payment reason.",
      'Tap "Confirm" and save your receipt.',
    ],
  },
  {
    id:        "western_union",
    label:     "Western Union",
    sublabel:  "Global transfer",
    iconId:    "western_union",
    color:     "text-yellow-600",
    bg:        "bg-yellow-50",
    border:    "border-yellow-200",
    accentBtn: "bg-yellow-500 hover:bg-yellow-600 text-white shadow-yellow-200",
    fields: [
      { label: "Recipient Name", value: "John Smith",       copyable: true },
      { label: "Country",        value: "United States"                    },
      { label: "State / City",   value: "New York, NY"                     },
      { label: "Test Question",  value: "What is the code?"               },
      { label: "Test Answer",    value: "MATCHAPP2024",     copyable: true },
    ],
    instructions: [
      "Visit any Western Union agent or westernunion.com.",
      "Send to the recipient details above.",
      "Enter the exact amount.",
      "Note your MTCN (Money Transfer Control Number).",
      "Submit the MTCN as your payment reference.",
    ],
  },
  {
    id:        "bank",
    label:     "Bank Transfer",
    sublabel:  "SWIFT · SEPA",
    iconId:    "bank",
    color:     "text-blue-600",
    bg:        "bg-blue-50",
    border:    "border-blue-200",
    accentBtn: "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200",
    fields: [
      { label: "Bank Name",      value: "Chase Bank"                              },
      { label: "Account Name",   value: "MatchApp Inc."                           },
      { label: "Account Number", value: "000123456789",              copyable: true },
      { label: "Routing / ABA",  value: "021000021",                 copyable: true },
      { label: "SWIFT / BIC",    value: "CHASUS33",                  copyable: true },
      { label: "IBAN",           value: "US29 CHAS 0210 0002 1000 1234", copyable: true },
      { label: "Reference",      value: "Use your Order ID"                        },
    ],
    instructions: [
      "Log in to your online banking portal.",
      "Start a new international or domestic transfer.",
      "Enter the account details above exactly.",
      "Use your Order ID as the payment reference.",
      "Allow 1–3 business days for processing.",
    ],
  },
];

/* ================================================================
   ICON RESOLVER  — maps string ID → JSX (keeps components out of state)
   ================================================================ */

function PlanIcon({ iconId, className }) {
  if (iconId === "bolt")     return <BoltIcon      className={className} />;
  if (iconId === "trophy")   return <TrophyIcon    className={className} />;
  if (iconId === "sparkles") return <SparklesIcon  className={className} />;
  return <BoltIcon className={className} />;
}

function MethodIcon({ iconId, className }) {
  if (iconId === "crypto")        return <CryptoIcon        className={className} />;
  if (iconId === "phone")         return <PhoneIcon         className={className} />;
  if (iconId === "western_union") return <WesternUnionIcon  className={className} />;
  if (iconId === "bank")          return <BankIcon          className={className} />;
  return <CryptoIcon className={className} />;
}

function CryptoOptionIcon({ iconId, className }) {
  if (iconId === "bitcoin") return <BitcoinIcon className={className} />;
  if (iconId === "tether")  return <TetherIcon  className={className} />;
  return <CryptoIcon className={className} />;
}

/* ================================================================
   STEPS
   ================================================================ */

const STEP = { METHOD: 0, DETAILS: 1, CONFIRM: 2, DONE: 3 };

/* ================================================================
   MAIN PAGE
   ================================================================ */

export default function SubscriptionPayment() {
  const navigate        = useNavigate();
  const location        = useLocation();
  const { user }        = useAuth();

  // ✅ Only plain data from state — no components
  const { planId, billing } = location.state || {};

  // Re-hydrate plan from planId
  const plan = useMemo(
    () => PLANS_DATA.find((p) => p.id === planId) ?? null,
    [planId]
  );

  const price = billing === "annual" ? plan?.priceAnnual : plan?.priceMonthly;
  const total = billing === "annual"
    ? (plan?.priceAnnual  * 12).toFixed(2)
    : plan?.priceMonthly?.toFixed(2);

  const [step,         setStep]         = useState(STEP.METHOD);
  const [method,       setMethod]       = useState(null);
  const [cryptoOption, setCryptoOption] = useState(null);

  const [txRef,      setTxRef]      = useState("");
  const [proofUrl,   setProofUrl]   = useState("");
  const [note,       setNote]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderId,    setOrderId]    = useState(null);
  const [toast,      setToast]      = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, []);

  const copyToClipboard = useCallback(async (text, label) => {
    try {
      await navigator.clipboard.writeText(String(text));
      showToast(`${label} copied!`);
    } catch {
      showToast("Copy failed — please copy manually", "error");
    }
  }, [showToast]);

  const generateOrderId = () =>
    "ORD-" +
    Date.now().toString(36).toUpperCase() + "-" +
    Math.random().toString(36).slice(2, 6).toUpperCase();

  const handleMethodSelect = (m) => {
    setMethod(m);
    if (m.id === "crypto") setCryptoOption(CRYPTO_OPTIONS[0]);
    setOrderId(generateOrderId());
    setStep(STEP.DETAILS);
  };

  const handleSubmit = async () => {
    if (!txRef.trim()) {
      showToast("Please enter your transaction reference", "error");
      return;
    }
    if (!user?.id) {
      showToast("You must be signed in", "error");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("subscription_requests").insert({
        user_id:       user.id,
        order_id:      orderId,
        plan_id:       plan?.id,
        plan_name:     plan?.name,
        billing_cycle: billing,
        price_usd:     price,
        total_usd:     parseFloat(total),
        method:        method?.id,
        crypto_option: cryptoOption?.id ?? null,
        tx_reference:  txRef.trim(),
        proof_url:     proofUrl.trim() || null,
        note:          note.trim()     || null,
        status:        "pending",
        created_at:    new Date().toISOString(),
      });

      if (error) throw error;
      setStep(STEP.DONE);
    } catch (err) {
      console.error(err);
      showToast(err.message || "Submission failed. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Guard
  if (!plan) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-gray-50 px-4 text-center">
        <div className="h-16 w-16 rounded-full bg-red-50 flex items-center justify-center">
          <AlertIcon className="h-8 w-8 text-red-500" />
        </div>
        <p className="text-lg font-bold text-gray-900">No plan selected</p>
        <p className="text-sm text-gray-500">Please go back and choose a subscription plan.</p>
        <button
          onClick={() => navigate("/subscription")}
          className="mt-2 rounded-full bg-violet-600 px-8 py-3 text-sm font-bold text-white hover:bg-violet-700 transition-colors"
        >
          Choose a Plan
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gray-50 pb-12 antialiased">
      <Toast toast={toast} />

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-xl border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-lg px-4 py-4 flex items-center gap-3">
          <button
            onClick={() =>
              step === STEP.METHOD ? navigate("/subscription") : setStep((s) => s - 1)
            }
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 active:scale-95 transition-all"
            aria-label="Back"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-base font-extrabold text-gray-900 leading-tight">
              {step === STEP.METHOD  && "Payment Method"}
              {step === STEP.DETAILS && "Payment Details"}
              {step === STEP.CONFIRM && "Confirm Payment"}
              {step === STEP.DONE    && "Submitted!"}
            </h1>
            <p className="text-xs text-gray-400">
              {plan.name} · {billing === "annual" ? "Annual" : "Monthly"} · ${price?.toFixed(2)}/mo
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1.5">
            {[STEP.METHOD, STEP.DETAILS, STEP.CONFIRM].map((s) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all duration-300 ${
                  step >= s ? "bg-violet-600 w-4" : "bg-gray-200 w-2"
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 pt-6 space-y-5">

        {/* Order summary always visible */}
        <OrderSummaryCard
          plan={plan}
          billing={billing}
          price={price}
          total={total}
          orderId={orderId}
        />

        {/* ══ STEP 0 — Choose Method ══ */}
        {step === STEP.METHOD && (
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 px-1">
              Select payment method
            </p>

            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.id}
                onClick={() => handleMethodSelect(m)}
                className="w-full flex items-center gap-4 rounded-3xl border-2 border-gray-200 bg-white p-5 text-left hover:shadow-lg hover:border-gray-300 active:scale-[0.99] transition-all duration-200"
              >
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${m.bg}`}>
                  <MethodIcon iconId={m.iconId} className={`h-6 w-6 ${m.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-gray-900">{m.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{m.sublabel}</p>
                </div>
                <ChevronRightIcon className="h-5 w-5 text-gray-300 shrink-0" />
              </button>
            ))}

            <div className="flex items-start gap-3 rounded-2xl bg-blue-50 border border-blue-100 p-4">
              <ShieldIcon className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-blue-900">Admin-verified payments</p>
                <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                  Our team reviews every payment manually and activates your plan within 24 hours.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ══ STEP 1 — Payment Details ══ */}
        {step === STEP.DETAILS && method && (
          <div className="space-y-4">
            {/* Method header chip */}
            <div className={`flex items-center gap-4 rounded-3xl border-2 ${method.border} ${method.bg} p-5`}>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
                <MethodIcon iconId={method.iconId} className={`h-6 w-6 ${method.color}`} />
              </div>
              <div>
                <p className="font-extrabold text-gray-900">{method.label}</p>
                <p className="text-xs text-gray-500">{method.sublabel}</p>
              </div>
            </div>

            {/* ── CRYPTO ── */}
            {method.id === "crypto" && (
              <div className="space-y-4">
                {/* Coin picker */}
                <div className="grid grid-cols-2 gap-3">
                  {CRYPTO_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setCryptoOption(opt)}
                      className={[
                        "flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all",
                        cryptoOption?.id === opt.id
                          ? `${opt.border} ring-2 ${opt.ring} bg-white shadow-md`
                          : "border-gray-200 bg-white hover:border-gray-300",
                      ].join(" ")}
                    >
                      <div className={`h-10 w-10 rounded-full ${opt.bg} flex items-center justify-center`}>
                        <CryptoOptionIcon iconId={opt.iconId} className={`h-5 w-5 ${opt.color}`} />
                      </div>
                      <p className="font-extrabold text-sm text-gray-900">{opt.symbol}</p>
                      <p className="text-[11px] text-gray-400 text-center leading-tight">{opt.network}</p>
                    </button>
                  ))}
                </div>

                {cryptoOption && (
                  <div className="space-y-3">
                    <div className="rounded-3xl border border-gray-200 bg-white p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-gray-900 text-sm">Send {cryptoOption.symbol}</p>
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${cryptoOption.bg} ${cryptoOption.color}`}>
                          {cryptoOption.network}
                        </span>
                      </div>

                      {/* QR placeholder */}
                      <div className="flex justify-center">
                        <div className="h-40 w-40 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center bg-gray-50 gap-2">
                          <QrIcon className="h-10 w-10 text-gray-300" />
                          <p className="text-[10px] text-gray-400 font-semibold">QR Code</p>
                        </div>
                      </div>

                      {/* Address */}
                      <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                          {cryptoOption.symbol} Address
                        </p>
                        <p className="font-mono text-xs text-gray-800 break-all leading-relaxed">
                          {cryptoOption.address}
                        </p>
                        <button
                          onClick={() => copyToClipboard(cryptoOption.address, `${cryptoOption.symbol} address`)}
                          className={`mt-3 w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all active:scale-95 ${cryptoOption.bg} ${cryptoOption.color} border ${cryptoOption.border}`}
                        >
                          <CopyIcon className="h-3.5 w-3.5" />
                          Copy Address
                        </button>
                      </div>

                      <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3.5 py-3">
                        <ClockIcon className="h-4 w-4 text-amber-500 shrink-0" />
                        <p className="text-xs text-amber-700 font-medium">{cryptoOption.confirmations}</p>
                      </div>
                    </div>

                    <ImportantBox orderId={orderId} total={total} currency={cryptoOption.symbol} />
                  </div>
                )}
              </div>
            )}

            {/* ── NON-CRYPTO ── */}
            {method.id !== "crypto" && (
              <div className="space-y-4">
                {/* How to pay */}
                <div className="rounded-3xl bg-white border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 pt-5 pb-3 border-b border-gray-50 flex items-center gap-2">
                    <InfoIcon className="h-4 w-4 text-violet-500 shrink-0" />
                    <p className="text-sm font-bold text-gray-900">How to pay</p>
                  </div>
                  <div className="p-5 space-y-3">
                    {method.instructions?.map((line, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${method.bg} ${method.color}`}>
                          {i + 1}
                        </span>
                        <p className="text-sm text-gray-700 leading-relaxed">{line}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fields */}
                <div className="rounded-3xl bg-white border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 pt-5 pb-3 border-b border-gray-50">
                    <p className="text-sm font-bold text-gray-900">Payment details</p>
                  </div>
                  <div className="p-5 space-y-3">
                    {method.fields?.map((field) => (
                      <div key={field.label} className="rounded-2xl bg-gray-50 border border-gray-100 p-4">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                          {field.label}
                        </p>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-bold text-gray-900 break-all">{field.value}</p>
                          {field.copyable && (
                            <button
                              onClick={() => copyToClipboard(field.value, field.label)}
                              className="shrink-0 flex items-center gap-1.5 rounded-xl bg-white border border-gray-200 px-3 py-1.5 text-[11px] font-bold text-gray-600 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
                            >
                              <CopyIcon className="h-3 w-3" />
                              Copy
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <ImportantBox orderId={orderId} total={total} currency="USD" />
              </div>
            )}

            <button
              onClick={() => setStep(STEP.CONFIRM)}
              className={`w-full rounded-2xl py-4 text-base font-extrabold text-white shadow-lg active:scale-[0.98] transition-all ${method.accentBtn}`}
            >
              I Have Paid — Submit Proof
            </button>
          </div>
        )}

        {/* ══ STEP 2 — Confirm ══ */}
        {step === STEP.CONFIRM && method && (
          <div className="space-y-4">
            {/* Recap chip */}
            <div className={`rounded-3xl border-2 ${method.border} ${method.bg} p-5`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm">
                  <MethodIcon iconId={method.iconId} className={`h-5 w-5 ${method.color}`} />
                </div>
                <div>
                  <p className="font-extrabold text-gray-900">{method.label}</p>
                  {cryptoOption && (
                    <p className="text-xs text-gray-500">{cryptoOption.name}</p>
                  )}
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs text-gray-400">Total sent</p>
                  <p className="font-extrabold text-gray-900">${total}</p>
                </div>
              </div>
              {orderId && (
                <div className="flex items-center justify-between rounded-xl bg-white/70 border border-white px-4 py-2.5">
                  <p className="text-xs text-gray-500 font-medium">Order ID</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-xs font-bold text-gray-900">{orderId}</p>
                    <button
                      onClick={() => copyToClipboard(orderId, "Order ID")}
                      className="text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      <CopyIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Form */}
            <div className="rounded-3xl bg-white border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-3 border-b border-gray-50">
                <p className="text-sm font-bold text-gray-900">Payment confirmation</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Our team will verify and activate your plan within 24 hours.
                </p>
              </div>
              <div className="p-5 space-y-4">
                {/* TX ref */}
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-1.5">
                    Transaction / Reference ID
                    <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <div className="relative">
                    <HashIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={txRef}
                      onChange={(e) => setTxRef(e.target.value)}
                      placeholder={
                        method.id === "crypto"        ? "BTC / USDT transaction hash" :
                        method.id === "momo"          ? "MoMo reference number"       :
                        method.id === "western_union" ? "MTCN number"                 :
                                                        "Bank transfer reference"
                      }
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5 pl-1">
                    Copy this exactly from your receipt or transaction history.
                  </p>
                </div>

                {/* Proof URL */}
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-1.5">
                    Receipt / Screenshot URL
                    <span className="text-xs font-normal text-gray-400 ml-1">(optional)</span>
                  </label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="url"
                      value={proofUrl}
                      onChange={(e) => setProofUrl(e.target.value)}
                      placeholder="https://imgur.com/your-screenshot"
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
                    />
                  </div>
                </div>

                {/* Note */}
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-1.5">
                    Additional Note
                    <span className="text-xs font-normal text-gray-400 ml-1">(optional)</span>
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Any extra info that helps our team verify faster..."
                    rows={3}
                    className="w-full resize-none rounded-2xl border border-gray-200 p-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || !txRef.trim()}
              className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-4 text-base font-extrabold text-white shadow-lg shadow-violet-200 hover:from-violet-700 hover:to-fuchsia-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <SpinnerIcon className="h-5 w-5" /> Submitting…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <CheckIcon className="h-5 w-5" /> Submit for Verification
                </span>
              )}
            </button>

            <p className="text-center text-[11px] text-gray-400 leading-relaxed px-4">
              Once submitted, our team verifies your payment and activates your plan within 24 hours.
            </p>
          </div>
        )}

        {/* ══ STEP 3 — Done ══ */}
        {step === STEP.DONE && (
          <div className="flex flex-col items-center text-center py-8 space-y-6">
            {/* Success ring */}
            <div className="relative flex items-center justify-center">
              <div className="absolute h-28 w-28 rounded-full bg-green-100 animate-ping opacity-30" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-500 shadow-xl shadow-green-200">
                <CheckIcon className="h-12 w-12 text-white" strokeWidth={3} />
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-extrabold text-gray-900">Payment Submitted!</h2>
              <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto leading-relaxed">
                Our team will verify your{" "}
                <span className="font-bold text-gray-700">{method?.label}</span> payment and activate your{" "}
                <span className="font-bold text-gray-700">{plan?.name}</span> plan within{" "}
                <span className="font-bold text-gray-700">24 hours</span>.
              </p>
            </div>

            {/* Summary */}
            <div className="w-full rounded-3xl bg-white border border-gray-100 shadow-sm p-5 space-y-3 text-left">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Submission summary</p>
              {[
                { label: "Order ID",  value: orderId },
                { label: "Plan",      value: `${plan?.name} · ${billing === "annual" ? "Annual" : "Monthly"}` },
                { label: "Method",    value: method?.label + (cryptoOption ? ` (${cryptoOption.symbol})` : "") },
                { label: "Total",     value: `$${total}` },
                { label: "Reference", value: txRef },
                { label: "Status",    value: "Pending verification", highlight: true },
              ].map(({ label, value, highlight }) => (
                <div key={label} className="flex items-center justify-between gap-3 py-1 border-b border-gray-50 last:border-0">
                  <p className="text-xs text-gray-400 font-medium">{label}</p>
                  <p className={`text-xs font-bold text-right truncate max-w-[55%] ${highlight ? "text-amber-600" : "text-gray-900"}`}>
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {/* Email note */}
            <div className="flex items-start gap-3 w-full rounded-2xl bg-blue-50 border border-blue-100 p-4 text-left">
              <MailIcon className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-blue-900">Check your email</p>
                <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                  We'll send confirmation to{" "}
                  <span className="font-bold">{user?.email}</span> once your plan is activated.
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate("/profile")}
              className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-4 text-base font-extrabold text-white shadow-lg shadow-violet-200 hover:from-violet-700 hover:to-fuchsia-700 active:scale-[0.98] transition-all"
            >
              Back to My Profile
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   ORDER SUMMARY CARD
   ================================================================ */

function OrderSummaryCard({ plan, billing, price, total, orderId }) {
  if (!plan) return null;
  return (
    <div className="rounded-3xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500 p-5 text-white shadow-xl shadow-violet-200">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-white/60 uppercase tracking-wider">Subscribing to</p>
          <p className="text-xl font-extrabold mt-0.5">{plan.name} Plan</p>
          <p className="text-sm text-white/70 mt-0.5">
            {billing === "annual" ? "Annual billing" : "Monthly billing"}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-3xl font-extrabold">${price?.toFixed(2)}</p>
          <p className="text-xs text-white/60">/month</p>
          {billing === "annual" && (
            <p className="text-xs font-bold text-white/80 mt-1">${total} billed today</p>
          )}
        </div>
      </div>
      {orderId && (
        <div className="mt-4 rounded-xl bg-white/15 backdrop-blur-sm px-4 py-2.5 flex items-center justify-between">
          <p className="text-xs text-white/70">Order ID</p>
          <p className="font-mono text-xs font-bold text-white">{orderId}</p>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   IMPORTANT BOX
   ================================================================ */

function ImportantBox({ orderId, total, currency }) {
  return (
    <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <AlertIcon className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-sm font-bold text-amber-900">Important</p>
      </div>
      <ul className="space-y-1.5 pl-1">
        {[
          `Send the exact amount: $${total} ${currency}`,
          `Include Order ID in your payment note: ${orderId}`,
          "Double-check the address before sending.",
          "Keep your receipt — you'll need it to confirm.",
        ].map((line, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-amber-800">
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ================================================================
   TOAST
   ================================================================ */

function Toast({ toast }) {
  if (!toast) return null;
  const isError = toast.type === "error";
  return (
    <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 pointer-events-none animate-in slide-in-from-top duration-300">
      <div className={`flex items-center gap-2.5 rounded-2xl px-5 py-3 shadow-2xl border text-sm font-semibold ${
        isError
          ? "bg-red-500 border-red-400 text-white"
          : "bg-white border-gray-200 text-gray-900"
      }`}>
        {isError
          ? <AlertIcon className="h-4 w-4 shrink-0" />
          : <CheckIcon className="h-4 w-4 shrink-0 text-green-500" />
        }
        {toast.message}
      </div>
    </div>
  );
}

/* ================================================================
   SVG ICONS
   ================================================================ */

function ChevronLeftIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function ChevronRightIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
function CheckIcon({ className = "h-5 w-5", strokeWidth = 2.5 }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
function CopyIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}
function AlertIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function ShieldIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
function InfoIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
function QrIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <path d="M14 14h.01M14 17h3M17 14v3M20 14h.01M20 17h.01M20 20h.01M17 20h.01M14 20h.01" />
    </svg>
  );
}
function ClockIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" />
    </svg>
  );
}
function HashIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  );
}
function LinkIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  );
}
function MailIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}
function SpinnerIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
    </svg>
  );
}
function PhoneIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}
function BankIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10l9-7 9 7" /><path d="M3 10v10h18V10" />
      <path d="M9 10v10M15 10v10" /><path d="M3 20h18" />
    </svg>
  );
}
function CryptoIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.5 9h4a1.5 1.5 0 010 3h-4m0 0h4.5a1.5 1.5 0 010 3H9.5m0-6V7m0 8v2m3-10v-1m0 11v-1" />
    </svg>
  );
}
function BitcoinIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 8h5a2 2 0 010 4H9V8zm0 4h5.5a2 2 0 010 4H9v-4z" />
      <path d="M11 6v2M13 6v2M11 16v2M13 16v2" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}
function TetherIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M7 9h10M12 9v6M9 15a6 6 0 006 0" />
    </svg>
  );
}
function WesternUnionIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7l5 10 4-7 4 7 5-10" />
    </svg>
  );
}
function BoltIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}
function TrophyIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4a2 2 0 01-2-2V5h4" />
      <path d="M18 9h2a2 2 0 002-2V5h-4" />
      <path d="M12 17v4M8 21h8" />
      <path d="M6 5h12v7a6 6 0 01-12 0V5z" />
    </svg>
  );
}
function SparklesIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M5 17l.75 2.25L8 20l-2.25.75L5 23l-.75-2.25L2 20l2.25-.75L5 17z" />
      <path d="M19 3l.75 2.25L22 6l-2.25.75L19 9l-.75-2.25L16 6l2.25-.75L19 3z" />
    </svg>
  );
}