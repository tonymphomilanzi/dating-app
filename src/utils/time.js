// src/utils/time.js
const toDate = (v) => (typeof v === "string" || typeof v === "number" ? new Date(v) : v);

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const daysBetween = (a, b) => {
  const aMid = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bMid = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((aMid - bMid) / 86400000);
};

export function formatChatListTime(input, { hour12 = true } = {}) {
  if (!input) return "";
  const d = toDate(input);
  if (Number.isNaN(d.getTime())) return "";

  const now = new Date();

  // Today → h:mm AM/PM (or 24h if hour12:false)
  if (isSameDay(d, now)) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12 });
  }

  // Yesterday
  if (daysBetween(now, d) === 1) return "Yesterday";

  // Within last 7 days → weekday short (Mon)
  const diff = daysBetween(now, d);
  if (diff > 1 && diff < 7) {
    return d.toLocaleDateString([], { weekday: "short" });
  }

  // Older → 5 Dec (same year) or 5 Dec 2023 (different year)
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString([], sameYear
    ? { day: "numeric", month: "short" }
    : { day: "numeric", month: "short", year: "numeric" }
  );
}