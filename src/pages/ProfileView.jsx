import TopBar from "../components/TopBar.jsx";
import Avatar from "../components/Avatar.jsx";

export default function ProfileView(){
  return (
    <div className="min-h-dvh">
      <TopBar title="Profile" />
      <div className="space-y-6 p-6">
        <div className="overflow-hidden rounded-3xl shadow-card">
          <img src="https://images.unsplash.com/photo-1519340241574-2cec6aef0c01?q=80&w=1200&auto=format&fit=crop" className="aspect-[3/4] w-full object-cover"/>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Jessica Parkes, 23</h2>
              <p className="text-sm text-gray-500">San Diego, 8 km away</p>
            </div>
            <Avatar size={48}/>
          </div>
          <div className="mt-4 space-y-2 text-sm text-gray-700">
            <div className="font-medium">About</div>
            <p>Designer. Loves hiking, film photography and oat lattes.</p>
          </div>
          <div className="mt-4">
            <div className="mb-2 text-sm font-medium">Interests</div>
            <div className="flex flex-wrap gap-2">
              {["Hiking","Photography","Dancing","Music","Outdoors","Travel"].map(t=>
                <div key={t} className="chip chip-off">{t}</div>
              )}
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {Array.from({length:6}).map((_,i)=>(
              <img key={i} className="aspect-square w-full rounded-xl object-cover"
                src={`https://images.unsplash.com/photo-15${70+i}...?q=80&w=400&auto=format&fit=crop`}/>
            ))}
          </div>
        </div>
        <div className="sticky bottom-4 flex justify-center gap-4">
          <button className="grid h-14 w-14 place-items-center rounded-full bg-white shadow-card" aria-label="Message">
            <i className="lni lni-comments text-2xl text-gray-700" />
          </button>
          <button className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-glow" aria-label="Like">
            <i className="lni lni-heart text-2xl" />
          </button>
        </div>
      </div>
    </div>
  );
}