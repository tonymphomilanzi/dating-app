// src/utils/debug.js
export function isDebug() {
  try {
    const qs = new URLSearchParams(window.location.search);
    if (qs.get("debug") === "1") return true;
    const ls = window.localStorage.getItem("DEBUG");
    return ls === "1" || ls === "true";
  } catch {
    return false;
  }
}

export function vinfo(...args) { if (isDebug()) console.info(...args); }
export function vdebug(...args) { if (isDebug()) console.debug(...args); }
export function vgroup(label, cb) { if (!isDebug()) return; console.groupCollapsed(label); try { cb?.(); } finally { console.groupEnd(); } }
export function vtable(obj) { if (isDebug() && typeof console.table === "function") console.table(obj); }