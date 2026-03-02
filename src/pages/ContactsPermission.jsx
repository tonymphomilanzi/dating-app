import Button from "../components/Button.jsx";
import TopBar from "../components/TopBar.jsx";
import { useNavigate } from "react-router-dom";

export default function ContactsPermission(){
  const nav = useNavigate();
  return (
    <div className="min-h-dvh">
      <TopBar title="Search friends"/>
      <div className="grid place-items-center gap-6 p-6 text-center">
        <div className="mx-auto grid h-28 w-28 place-items-center rounded-3xl bg-gradient-to-br from-fuchsia-600 to-violet-600 text-white">
          <i className="lni lni-address-book text-4xl" />
        </div>
        <p className="text-gray-600">Let us scan your contacts to find friends already on the app.</p>
        <Button className="w-full" onClick={()=>nav("/permissions/notifications")}>Allow access to contact list</Button>
      </div>
    </div>
  );
}