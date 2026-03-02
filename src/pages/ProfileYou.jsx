import TopBar from "../components/TopBar.jsx";
import Avatar from "../components/Avatar.jsx";
import Button from "../components/Button.jsx";

export default function ProfileYou(){
  return (
    <div className="min-h-dvh">
      <TopBar title="Your profile" />
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Avatar size={64}/>
          <div>
            <div className="text-lg font-semibold">You</div>
            <div className="text-sm text-gray-500">Complete your profile</div>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-card">
          <div className="text-sm text-gray-600">Status</div>
          <div className="mt-1 text-gray-800">Free • Boosts: 0 • Super Likes: 0</div>
          <Button className="mt-4 w-full">Upgrade to Premium</Button>
        </div>
      </div>
    </div>
  );
}