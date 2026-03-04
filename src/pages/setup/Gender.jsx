import { useState } from "react";
import { supabase } from "../../lib/supabase.client.js";
import { useNavigate } from "react-router-dom";

export default function SetupGender(){
  const nav = useNavigate();
  const [val, setVal] = useState(null);     // 'woman' | 'man' | 'nonbinary' | 'other'
  const [saving, setSaving] = useState(false);
  const [showSheet, setShowSheet] = useState(false);

  const save = async ()=>{
    if (!val) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase
        .from("profiles")
        .update({ gender: val })
        .eq("id", user.id)
        .throwOnError();
      nav("/setup/interests");
    } catch(e) {
      alert(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-white text-gray-900">
      {/* Header: back + Skip */}
      <div className="sticky top-0 z-10 bg-white/90 px-4 pt-4 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center">
          <button
            onClick={() => nav(-1)}
            aria-label="Back"
            className="grid h-10 w-10 place-items-center rounded-2xl border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <i className="lni lni-chevron-left text-lg" />
          </button>
          <button
            onClick={() => nav("/setup/interests")}
            className="ml-auto text-sm font-medium text-violet-600 hover:text-violet-700"
          >
            Skip
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-md px-4 pb-40 pt-6">
        <h1 className="text-3xl font-bold">I am a</h1>

        <div className="mt-6 space-y-3" role="radiogroup" aria-label="Gender">
          <OptionPill
            label="Woman"
            selected={val === "woman"}
            onClick={() => setVal("woman")}
            trailingIcon={val === "woman" ? "check" : "chevron"}
          />
          <OptionPill
            label="Man"
            selected={val === "man"}
            onClick={() => setVal("man")}
            trailingIcon={val === "man" ? "check" : "chevron"}
          />
          <OptionPill
            label="Choose another"
            selected={val === "nonbinary" || val === "other"}
            onClick={() => setShowSheet(true)}
            trailingIcon="chevron"
          />
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-100 bg-white/95 px-4 pb-[env(safe-area-inset-bottom)] pt-3 backdrop-blur">
        <div className="mx-auto max-w-md">
          <button
            onClick={save}
            disabled={!val || saving}
            className={[
              "w-full rounded-full px-4 py-3.5 text-center text-base font-semibold shadow-card transition active:scale-[0.99]",
              val && !saving ? "bg-violet-600 text-white hover:bg-violet-700" : "bg-violet-300 text-white"
            ].join(" ")}
          >
            {saving ? "Saving..." : "Continue"}
          </button>
        </div>
      </div>

      {/* Choose another sheet */}
      {showSheet && (
        <ChooseAnotherSheet
          current={val}
          onClose={() => setShowSheet(false)}
          onPick={(v) => {
            setVal(v);
            setShowSheet(false);
          }}
        />
      )}
    </div>
  );
}

function OptionPill({ label, selected, onClick, trailingIcon = "chevron" }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={[
        "flex w-full items-center justify-between rounded-full border px-4 py-3.5 text-left text-sm transition",
        selected
          ? "border-transparent bg-violet-600 text-white shadow"
          : "border-gray-300 bg-white text-gray-900 hover:border-violet-200"
      ].join(" ")}
    >
      <span>{label}</span>
      {selected ? (
        <span className="grid h-7 w-7 place-items-center rounded-full border border-white/60 bg-white/20 text-white">
          <i className="lni lni-checkmark" />
        </span>
      ) : trailingIcon === "chevron" ? (
        <i className="lni lni-chevron-right text-violet-600" />
      ) : (
        <i className="lni lni-checkmark text-violet-600" />
      )}
    </button>
  );
}

function ChooseAnotherSheet({ current, onPick, onClose }) {
  return (
    <div className="fixed inset-0 z-30">
      {/* Overlay */}
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 bg-black/20"
      />
      {/* Sheet */}
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-3xl border border-gray-200 bg-white p-4 shadow-xl">
        <div className="mx-auto h-1.5 w-12 rounded-full bg-gray-200" />
        <div className="mt-4 space-y-3">
          <OptionPill
            label="Non-binary"
            selected={current === "nonbinary"}
            onClick={() => onPick("nonbinary")}
            trailingIcon={current === "nonbinary" ? "check" : "chevron"}
          />
          <OptionPill
            label="Other"
            selected={current === "other"}
            onClick={() => onPick("other")}
            trailingIcon={current === "other" ? "check" : "chevron"}
          />
        </div>
        <div className="mt-4 text-center">
          <button onClick={onClose} className="text-sm font-medium text-gray-600 hover:text-gray-800">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}