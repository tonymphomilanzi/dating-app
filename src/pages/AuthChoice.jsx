import { Link } from "react-router-dom";
import Button from "../components/Button.jsx";

export default function AuthChoice(){
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6">
      <div className="w-full space-y-5 rounded-3xl bg-white p-6 text-center shadow-card">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-600 to-violet-600 text-white">
          <i className="lni lni-heart text-2xl" />
        </div>
        <h1 className="text-xl font-semibold">Sign in or create an account</h1>
        <div className="space-y-3">
          <Link to="/auth/email"><Button className="w-full"><i className="lni lni-envelope text-lg" /> Continue with email</Button></Link>
        </div>
        <p className="text-xs text-gray-500">By continuing you agree to our Terms & Privacy</p>
      </div>

        <p className="pt-5 text-center text-xs text-brand-700/70 leading-relaxed">
            By continuing, you agree to our <br />
            <span className="underline underline-offset-2">
              Terms & Privacy Policy
            </span>
          </p>
    </div>
  );
}
        
