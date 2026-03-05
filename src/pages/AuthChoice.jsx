import { Link } from "react-router-dom";

export default function AuthChoice(){
  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-white px-6 py-10 text-gray-900">
      {/* Soft brand glow accents */}
      <div className="pointer-events-none absolute -top-10 -right-10 h-56 w-56 rounded-full bg-fuchsia-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-10 h-64 w-64 rounded-full bg-violet-300/25 blur-3xl" />

      <div className="w-full max-w-md">
        <div className="space-y-6 rounded-3xl border border-gray-100 bg-white p-6 text-center shadow-card">
          {/* Brand mark */}
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-600 to-violet-600 text-white shadow-md">
            <i className="lni lni-heart text-2xl" />
          </div>

          {/* Title + subtitle */}
          <div>
            <h1 className="text-2xl font-bold">Sign in or create an account</h1>
            <p className="mt-1 text-sm text-gray-600">
              Join and enjoy a personalized experience.
            </p>
          </div>

          {/* Primary CTA */}
          <div className="space-y-3">
            <Link to="/auth/email" className="block">
              <button className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-3 text-white shadow-md active:scale-[0.99]">
                <i className="lni lni-envelope text-lg" />
                Continue with email
              </button>
            </Link>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 text-gray-400">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs">or</span>
            <p className="h-px flex-1 bg-gray-200" > sign up with</p>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          {/* Socials (UI only — hook up to OAuth if you want) */}
          <div className="flex items-center justify-center gap-3">
            <button
              className="grid h-12 w-12 place-items-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50"
              aria-label="Continue with Google"
            >
              <i className="lni lni-google text-lg" />
            </button>
            <button
              className="grid h-12 w-12 place-items-center rounded-full border border-gray-200 bg-white text-gray-900 shadow-sm hover:bg-gray-50"
              aria-label="Continue with Apple"
            >
              <i className="lni lni-apple text-lg" />
            </button>
            <button
              className="grid h-12 w-12 place-items-center rounded-full border border-gray-200 bg-white text-[#1877F2] shadow-sm hover:bg-gray-50"
              aria-label="Continue with Facebook"
            >
              <i className="lni lni-facebook-filled text-lg" />
            </button>
          </div>

          {/* Fine print */}
    
        </div>

        {/* Bottom legal (optional, matches your style) */}
        <p className="pt-5 text-center text-xs leading-relaxed text-violet-700/80">
          By continuing, you agree to our <br />
          <span className="underline underline-offset-2">Terms & Privacy Policy</span>
        </p>
      </div>
    </div>
  );
}