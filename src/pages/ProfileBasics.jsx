import TopBar from "../components/TopBar.jsx";
import TextField from "../components/TextField.jsx";
import Button from "../components/Button.jsx";
import Avatar from "../components/Avatar.jsx";
import { useNavigate } from "react-router-dom";

export default function ProfileBasics(){
  const nav = useNavigate();
  return (
    <div className="min-h-dvh">
      <TopBar title="Profile details"/>
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar size={68}/>
            <button className="absolute -right-1 -bottom-1 rounded-full bg-violet-600 p-1 text-white shadow-card" aria-label="Upload">
              <i className="lni lni-camera text-base" />
            </button>
          </div>
          <p className="text-sm text-gray-600">Add a clear face photo</p>
        </div>
        <TextField label="Display name" placeholder="Jess"/>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 rounded border-gray-300"/>
          <span>Show my details publicly</span>
        </label>
        <Button className="w-full" onClick={()=>nav("/profile/dob")}>Continue</Button>
      </div>
    </div>
  );
}