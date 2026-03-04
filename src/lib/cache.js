const LS = typeof window !== "undefined" ? window.localStorage : null;
const CAP = {
  threads: 200,      // keep last 200 threads
  messages: 300,     // keep last 300 messages per conv
};

function kThreads(uid) { return `cache:threads:${uid}`; }
function kMsgs(cid)   { return `cache:messages:${cid}`; }

function safeGet(key, fallback) {
  if (!LS) return fallback;
  try { const v = LS.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function safeSet(key, val) {
  if (!LS) return;
  try { LS.setItem(key, JSON.stringify(val)); } catch {}
}

export const ChatCache = {
  // Threads
  loadThreads(userId) {
    return safeGet(kThreads(userId), []);
  },
  saveThreads(userId, threads = []) {
    const pruned = threads.slice(0, CAP.threads);
    safeSet(kThreads(userId), pruned);
  },

  // Messages
  loadMessages(convId) {
    return safeGet(kMsgs(convId), []);
  },
  saveMessages(convId, msgs = []) {
    const pruned = msgs.slice(-CAP.messages);
    safeSet(kMsgs(convId), pruned);
  },
  appendMessage(convId, msg) {
    const cur = ChatCache.loadMessages(convId);
    const next = [...cur, msg].slice(-CAP.messages);
    ChatCache.saveMessages(convId, next);
    return next;
  },
};