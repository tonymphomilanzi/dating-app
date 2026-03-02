import { Link } from "react-router-dom";
import Button from "../components/Button.jsx";
import { Icon } from "../components/Icon.jsx";
import { Icons } from "../icons";

export default function AuthChoice() {
  return (
    <div className="relative min-h-screen w-full bg-brand-50 overflow-hidden">

      {/* Brand ambient glow */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-300/40 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-40 h-80 w-80 rounded-full bg-brand-200/40 blur-3xl" />

      <div className="relative flex min-h-screen flex-col">

        {/* Branding */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="mb-6 grid h-20 w-20 place-items-center rounded-[28px] bg-gradient-to-br from-brand-600 to-brand-700 text-white shadow-glow">
            <i className="lni lni-heart text-4xl" />
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-brand-900">
           Umukunzi 4.0
          </h1>

          <p className="mt-2 max-w-xs text-sm text-brand-700/80">
            Genuine connections, real conversations, and meaningful moments.
          </p>

          {/* Trust badge */}
          <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-100 px-4 py-1.5 text-xs font-medium text-brand-700">
            Built for real love
          </span>
        </div>

        {/* Actions */}
        <div className="px-6 pb-10 space-y-4">

          {/* Primary CTA */}
          <Link to="/auth/phone">
            <Button className="relative w-full overflow-hidden rounded-full py-4 text-base font-semibold text-white bg-gradient-to-r from-brand-600 to-brand-700 shadow-glow active:scale-[0.98] transition">
              <span className="absolute inset-0 bg-white/10 opacity-0 hover:opacity-100 transition" />
              <i className="lni lni-phone text-lg" />
              Continue with phone
            </Button>
          </Link>

          {/* Social buttons */}
          {[
            { icon: Icons.Facebook, label: "Continue with Facebook" },
            { icon: Icons.Google, label: "Continue with Google" },
            { icon: Icons.Apple, label: "Continue with Apple" },
          ].map(({ icon, label }) => (
            <button
              key={label}
              className="w-full rounded-full py-4 bg-white border border-brand-200 flex items-center justify-center gap-3 text-brand-900 font-medium shadow-sm hover:shadow-card hover:bg-brand-50 transition"
            >
              <Icon as={icon} size={20} />
              {label}
            </button>
          ))}

          <p className="pt-5 text-center text-xs text-brand-700/70 leading-relaxed">
            By continuing, you agree to our <br />
            <span className="underline underline-offset-2">
              Terms & Privacy Policy
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}