import { useEffect, useState } from "react";
import OTPInput from "../components/OTPInput.jsx";
import Button from "../components/Button.jsx";
import TopBar from "../components/TopBar.jsx";
import { useNavigate } from "react-router-dom";

export default function OTPVerify(){
  const [code, setCode] = useState("");
  const [left, setLeft] = useState(42);
  const nav = useNavigate();

  useEffect(()=>{
    const t = setInterval(()=>setLeft(s => s>0 ? s-1 : 0), 1000);
    return ()=>clearInterval(t);
  },[]);

  return (
    <div className="min-h-dvh">
      <TopBar title="Verify code"/>
      <div className="space-y-6 p-6 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-fuchsia-600 to-violet-600 text-white">
          0{Math.floor(left/10)}:{(left%60).toString().padStart(2,"0")}
        </div>
        <p className="text-sm text-gray-600">Type the 4-digit code we sent you</p>
        <OTPInput length={4} onChange={setCode}/>
        <div className="pt-4">
          <Button className="w-full" disabled={code.length<4} onClick={()=>nav("/profile/basics")}>Continue</Button>
        </div>
      </div>
    </div>
  );
}