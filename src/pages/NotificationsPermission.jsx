import Button from "../components/Button.jsx";
import TopBar from "../components/TopBar.jsx";
import { useNavigate } from "react-router-dom";

export default function NotificationsPermission(){
  const nav = useNavigate();
  return (
    <div className="min-h-dvh">
      <TopBar title="Enable notifications"/>
      <div className="grid place-items-center gap-6 p-6 text-center">
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-3xl bg-orange-400 text-white">
          <i className="lni lni-alarm text-3xl" />
        </div>
        <p className="text-gray-600">Get notified about new matches and messages.</p>
        <div className="space-y-3 w-full">
          <Button className="w-full" onClick={()=>nav("/discover")}>I want to be notified</Button>
          <Button className="w-full btn-outline" onClick={()=>nav("/discover")}>Maybe later</Button>
        </div>
      </div>
    </div>
  );
}