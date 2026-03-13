import { Link } from "react-router-dom";

export default function AuthChoice() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-white px-6 py-12 text-gray-900">

      {/* background glow */}
      <div className="pointer-events-none absolute -top-16 -right-16 h-72 w-72 rounded-full bg-fuchsia-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 h-80 w-80 rounded-full bg-violet-300/25 blur-3xl" />

      <div className="relative w-full max-w-sm text-center">

        {/* logo */}
        <div className="mx-auto mb-8 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-600 to-violet-600 text-white shadow-lg">
          <i className="lni lni-heart text-2xl" />
        </div>

        {/* heading */}
        <h1 className="text-3xl font-bold tracking-tight">
          Umukunzi 4.0
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          Sign in or create an account to continue
        </p>

        {/* primary action */}
        <div className="mt-8">
          <Link to="/auth/email">
            <button className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3.5 text-sm font-medium text-white shadow-md transition active:scale-[0.98]">
              <i className="lni lni-envelope text-lg" />
              Continue with email
            </button>
          </Link>
        </div>

        {/* divider */}
        <div className="my-8 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-400">or continue with</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        {/* social buttons */}
        <div className="flex justify-center gap-4">
          <button
            className="grid h-12 w-12 place-items-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-50"
            aria-label="Google"
          >
            <i className="lni lni-google text-lg" />
          </button>

          <button
            className="grid h-12 w-12 place-items-center rounded-full border border-gray-200 bg-white text-gray-900 shadow-sm transition hover:bg-gray-50"
            aria-label="Apple"
          >
            <i className="lni lni-apple text-lg" />
          </button>

          <button
            className="grid h-12 w-12 place-items-center rounded-full border border-gray-200 bg-white text-[#1877F2] shadow-sm transition hover:bg-gray-50"
            aria-label="Facebook"
          >
            <i className="lni lni-facebook-filled text-lg" />
          </button>
        </div>

        {/* legal */}
        <p className="mt-10 text-xs leading-relaxed text-violet-700/80">
          By continuing you agree to our <br />
          <span className="underline underline-offset-2">
            Terms & Privacy Policy
          </span>
        </p>

      </div>
    </div>
  );
}