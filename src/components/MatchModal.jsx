// src/components/MatchModal.jsx
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../contexts/AuthContext.jsx";
import Confetti from "./Confetti.jsx";

export default function MatchModal({ isOpen, person, onClose, onMessage }) {
  const { profile } = useAuth();

  if (!person) return null;

  const myPhoto = profile?.avatar_url || "/me.jpg";
  const theirPhoto =
    person.avatar_url ||
    person.photo ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${person.id}`;
  const theirName = person.display_name || person.name || "Someone";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          {/* Confetti */}
          <Confetti />

          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            transition={{ type: "spring", damping: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-pink-600 to-rose-500 p-1"
          >
            <div className="rounded-[22px] bg-white p-6">
              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-center"
              >
                <h2 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">
                  It's a Match!
                </h2>
                <p className="mt-2 text-gray-500">
                  You and {theirName} liked each other
                </p>
              </motion.div>

              {/* Photos */}
              <div className="relative mt-6 flex justify-center">
                {/* Heart connector */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.2, 1] }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-500 shadow-lg shadow-pink-300">
                    <i className="lni lni-heart-fill text-white text-xl" />
                  </div>
                </motion.div>

                {/* My photo */}
                <motion.div
                  initial={{ x: -100, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.3, type: "spring" }}
                  className="relative -mr-6"
                >
                  <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-white shadow-xl">
                    <img
                      src={myPhoto}
                      alt="You"
                      className="h-full w-full object-cover"
                    />
                  </div>
                </motion.div>

                {/* Their photo */}
                <motion.div
                  initial={{ x: 100, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.3, type: "spring" }}
                  className="relative -ml-6"
                >
                  <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-white shadow-xl">
                    <img
                      src={theirPhoto}
                      alt={theirName}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </motion.div>
              </div>

              {/* Actions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-8 space-y-3"
              >
                <button
                  onClick={onMessage}
                  className="w-full rounded-full bg-gradient-to-r from-violet-600 to-pink-600 py-3 font-semibold text-white shadow-lg shadow-violet-200 hover:shadow-xl transition-shadow"
                >
                  Send a Message
                </button>
                <button
                  onClick={onClose}
                  className="w-full rounded-full border border-gray-200 bg-white py-3 font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Keep Swiping
                </button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}