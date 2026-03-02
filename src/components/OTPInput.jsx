import React, { useMemo } from "react";

export default function OTPInput({ length = 4, onChange }) {
  const refs = useMemo(() => Array.from({ length }, () => React.createRef()), [length]);

  const handle = (i, e) => {
    const val = e.target.value.replace(/\D/g, "").slice(-1);
    e.target.value = val;
    if (val && i < length - 1) refs[i + 1].current?.focus();
    const code = refs.map(r => r.current?.value ?? "").join("");
    onChange?.(code);
  };

  const back = (i, e) => {
    if (e.key === "Backspace" && !refs[i].current?.value && i > 0) refs[i - 1].current?.focus();
  };

  return (
    <div className="flex items-center justify-center gap-3">
      {refs.map((ref, i) => (
        <input
          key={i}
          ref={ref}
          inputMode="numeric"
          maxLength={1}
          onChange={(e) => handle(i, e)}
          onKeyDown={(e) => back(i, e)}
          className="h-12 w-12 rounded-xl border border-gray-200 text-center text-xl focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
        />
      ))}
    </div>
  );
}