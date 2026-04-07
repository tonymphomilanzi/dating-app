// src/pages/ProfileYou.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { supabase } from "../lib/supabase.client.js";
import Button from "../components/Button.jsx"; // Assuming styled with Tailwind

export default function ProfileYou() {
  const { profile, reloadProfile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("media"); // 'media' or 'about'
  const [uploading, setUploading] = useState(false);

  // Redesign: Floating Action Bar
  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-24">
      {/* 1. CINEMATIC HERO SECTION */}
      <div className="relative h-[50vh] w-full overflow-hidden bg-gray-900">
        <img 
          src={profile?.avatar_url || "https://via.placeholder.com/600"} 
          className="h-full w-full object-cover opacity-80 transition-transform duration-700 hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#F9FAFB] via-transparent to-black/20" />
        
        {/* Floating Profile Info */}
        <div className="absolute bottom-10 left-6 right-6">
          <h1 className="text-4xl font-black text-white drop-shadow-lg">
            {profile?.display_name || "Guest"}, {calculateAge(profile?.dob)}
          </h1>
          <p className="text-white/90 font-medium italic">
            {profile?.profession || "Adventurer"}
          </p>
        </div>
      </div>

      {/* 2. TABBED CONTENT CARD */}
      <div className="relative -mt-8 mx-4 rounded-[2rem] bg-white p-6 shadow-xl ring-1 ring-black/5">
        <div className="flex bg-gray-100 p-1 rounded-2xl mb-8">
          {['media', 'about'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab ? "bg-white shadow-md text-violet-600" : "text-gray-500"
              }`}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        {activeTab === "media" ? (
          <MediaGrid profile={profile} />
        ) : (
          <AboutForm profile={profile} onSave={reloadProfile} />
        )}
      </div>

      {/* 3. THE "BIG BRAND" LOGOUT STYLES */}
      <div className="p-6 space-y-4">
        <button 
          onClick={signOut}
          className="w-full py-4 rounded-2xl bg-red-50 text-red-500 font-bold border border-red-100 hover:bg-red-100 transition-colors"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

// Sub-component for clean code
function MediaGrid({ profile }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {/* Big Tile */}
      <div className="col-span-2 row-span-2 aspect-[3/4] rounded-3xl bg-gray-200 overflow-hidden relative group">
        <img src={profile?.avatar_url} className="h-full w-full object-cover" />
        <div className="absolute top-3 left-3 bg-violet-600 text-white text-[10px] px-2 py-1 rounded-full font-bold">PRIMARY</div>
      </div>
      {/* Small Add Button */}
      <div className="aspect-square rounded-3xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-violet-400 hover:text-violet-400 transition-all cursor-pointer">
        <i className="lni lni-plus text-2xl" />
      </div>
    </div>
  );
}

function AboutForm({ profile, onSave }) {
    // Implement your TextFields here with the fuchsia/violet focus rings
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-2">Bio</label>
                <textarea 
                    className="w-full p-4 rounded-3xl bg-gray-50 border-none focus:ring-2 focus:ring-violet-400 min-h-[120px]"
                    placeholder="Tell them something they can't forget..."
                    defaultValue={profile?.bio}
                />
            </div>
            <Button className="w-full h-14 !rounded-3xl !bg-gradient-to-r !from-fuchsia-500 !to-violet-600 shadow-lg shadow-violet-200 uppercase tracking-widest font-black">
                Update Profile
            </Button>
        </div>
    )
}

function calculateAge(dob) {
  if (!dob) return "";
  return Math.floor((new Date() - new Date(dob).getTime()) / 3.15576e+10);
}