"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Translucent overlay that slides in from the right. The garden stays visible
 * behind it — panels are never full-page navigations.
 */
export function SlidePanel({
  open,
  onClose,
  title,
  children,
  width = 380,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(10,14,24,0.35)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="panel-glass fixed right-0 top-0 z-50 flex h-dvh flex-col"
            style={{ width: `min(${width}px, 92vw)` }}
            initial={reduce ? { opacity: 0 } : { x: "100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
          >
            <div className="flex items-center justify-between px-5 pt-5">
              <span className="data">{title}</span>
              <button
                onClick={onClose}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-full text-moonlight-dim transition-colors hover:text-moonlight"
                style={{ border: "1px solid rgba(232,236,241,0.10)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-6 pt-3">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
