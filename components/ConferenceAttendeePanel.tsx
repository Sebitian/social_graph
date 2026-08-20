"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, X } from "lucide-react";
import type { ConferenceAttendee } from "@/lib/conferenceTypes";
import { compactNumber } from "@/lib/graphUtils";

interface Props {
  attendee: ConferenceAttendee | null;
  onClose: () => void;
}

function matchLabel(attendee: ConferenceAttendee): string {
  if (attendee.matchStatus === "matched") {
    return attendee.confidence != null
      ? `LinkedIn match · ${attendee.confidence}%`
      : "LinkedIn match";
  }
  if (attendee.matchStatus === "unmatched") return "No confident LinkedIn match";
  return "No LinkedIn profile found";
}

export default function ConferenceAttendeePanel({ attendee, onClose }: Props) {
  const [isMobile, setIsMobile] = useState(false);
  const isOpen = Boolean(attendee);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen, attendee?.id]);

  const panel = (
    <AnimatePresence>
      {attendee && (
        <>
          <motion.button
            type="button"
            key={`${attendee.id}-backdrop`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/45 sm:bg-black/40"
            onClick={onClose}
            aria-label="Close profile"
          />
          <motion.div
            key={attendee.id}
            initial={isMobile ? { y: "100%" } : { opacity: 0, x: 24 }}
            animate={isMobile ? { y: 0 } : { opacity: 1, x: 0 }}
            exit={isMobile ? { y: "100%" } : { opacity: 0, x: 24 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed inset-x-0 bottom-0 z-50 flex w-full max-h-[min(88dvh,100%)] flex-col overflow-hidden rounded-t-2xl rounded-b-none border border-white/10 bg-black/90 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-20 sm:max-h-[calc(100dvh-6rem)] sm:w-[320px] sm:rounded-2xl sm:pb-0"
            onTouchMove={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/20 sm:hidden" />

            <div className="relative shrink-0 border-b border-white/10 px-4 pb-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white sm:right-3 sm:top-3 sm:h-8 sm:w-8"
                aria-label="Close"
              >
                <X className="h-5 w-5 sm:h-4 sm:w-4" />
              </button>

              <div className="flex min-w-0 items-center gap-3 pr-8">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E11D48]/20 text-lg font-bold text-[#FDA4AF]">
                  {attendee.fullName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-white">
                    {attendee.fullName}
                  </h3>
                  <p className="truncate text-sm text-white/55">
                    {attendee.title || attendee.company || "Conference guest"}
                  </p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-pan-y px-4 py-3">
              <p className="text-[11px] text-white/40">{matchLabel(attendee)}</p>
              {attendee.matchNote && attendee.matchStatus !== "matched" && (
                <p className="mt-1 text-xs leading-relaxed text-white/45">
                  {attendee.matchNote.replace(/^⚠️\s*/, "")}
                </p>
              )}
              {attendee.lumaName !== attendee.fullName && (
                <p className="mt-2 text-xs text-white/40">
                  Luma name: {attendee.lumaName}
                </p>
              )}

              <dl className="mt-4 grid gap-2 text-sm">
                {attendee.company && (
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-white/35">Company</dt>
                    <dd className="text-white/75">{attendee.company}</dd>
                  </div>
                )}
                {attendee.location && (
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-white/35">Location</dt>
                    <dd className="text-white/75">{attendee.location}</dd>
                  </div>
                )}
                {attendee.connectionsCount != null && (
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-white/35">Connections</dt>
                    <dd className="font-mono text-white/75">
                      {compactNumber(attendee.connectionsCount)}
                    </dd>
                  </div>
                )}
                {attendee.followerCount != null && (
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-white/35">Followers</dt>
                    <dd className="font-mono text-white/75">
                      {compactNumber(attendee.followerCount)}
                    </dd>
                  </div>
                )}
              </dl>

              {attendee.headline && attendee.headline !== attendee.title && (
                <p className="mt-4 text-sm leading-relaxed text-white/45">
                  {attendee.headline}
                </p>
              )}

              {attendee.profileSummary && (
                <p className="mt-3 text-xs leading-relaxed text-white/40">
                  {attendee.profileSummary}
                </p>
              )}

              {attendee.linkedinUrl && attendee.matchStatus === "matched" && (
                <a
                  href={attendee.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm text-[#FDA4AF] hover:underline"
                >
                  Open LinkedIn
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  if (typeof document === "undefined") return null;
  return createPortal(panel, document.body);
}
