import TextField from "../components/TextField.jsx";
import Button from "../components/Button.jsx";
import TopBar from "../components/TopBar.jsx";
import { useNavigate } from "react-router-dom";

export default function PhoneNumber(){
  const nav = useNavigate();
  return (
    <div className="min-h-dvh">
      <TopBar title="My mobile"/>
      <div className="space-y-6 p-6">
        <p className="text-sm text-gray-600">We’ll text you a code. Your number is safe with us.</p>
        <TextField label="Phone number" placeholder="+1 202 555 0132" inputMode="tel"/>
        <Button className="w-full" onClick={()=>nav("/auth/otp")}>Continue</Button>
      </div>
    </div>
  );
}