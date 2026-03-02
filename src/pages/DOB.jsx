import TopBar from "../components/TopBar.jsx";
import Button from "../components/Button.jsx";
import { useNavigate } from "react-router-dom";

export default function DOB(){
  const nav = useNavigate();
  return (
    <div className="min-h-dvh">
      <TopBar title="Profile details"/>
      <div className="space-y-6 p-6">
        <p className="text-sm text-gray-600">Your date of birth</p>
        <div className="grid grid-cols-3 gap-3">
          <select className="field"><option>Jan</option><option>Feb</option><option>Mar</option></select>
          <select className="field"><option>1</option><option>2</option><option>3</option></select>
          <select className="field"><option>1995</option><option>1996</option><option>1997</option></select>
        </div>
        <Button className="w-full" onClick={()=>nav("/profile/gender")}>Save</Button>
      </div>
    </div>
  );
}