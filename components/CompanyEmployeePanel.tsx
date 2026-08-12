"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, X } from "lucide-react";
import type { CompanyEmployee } from "@/lib/companyTypes";
import { compactNumber } from "@/lib/graphUtils";

interface Props {
  employee: CompanyEmployee | null;
  onClose: () => void;
}

export default function CompanyEmployeePanel({ employee, onClose }: Props) {
  const [isMobile, setIsMobile] = useState(false);
  const isOpen = Boolean(employee);

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
  }, [isOpen, employee?.id]);

  const panel = (
    <AnimatePresence>
      {employee && (
        <>
          <motion.button
            type="button"
            key={`${employee.id}-backdrop`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/45 sm:bg-black/40"
            onClick={onClose}
            aria-label="Close profile"
          />
          <motion.div
            key={employee.id}
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
                {employee.profilePicUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={employee.profilePicUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-white/15"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0A66C2]/20 text-lg font-bold text-[#0A66C2]">
                    {employee.fullName.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-white">
                    {employee.fullName}
                  </h3>
                  <p className="truncate text-sm text-white/55">{employee.title}</p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-pan-y px-4 py-3">
              {employee.headline && employee.headline !== employee.title && (
                <p className="text-sm leading-relaxed text-white/45">
                  {employee.headline}
                </p>
              )}

              <dl className="mt-4 grid gap-2 text-sm">
                {employee.location && (
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-white/35">Location</dt>
                    <dd className="text-white/75">{employee.location}</dd>
                  </div>
                )}
                {employee.tenure && (
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-white/35">Tenure</dt>
                    <dd className="text-white/75">{employee.tenure}</dd>
                  </div>
                )}
                {employee.connectionsCount != null && (
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-white/35">Connections</dt>
                    <dd className="font-mono text-white/75">
                      {compactNumber(employee.connectionsCount)}
                    </dd>
                  </div>
                )}
                {employee.followerCount != null && (
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-white/35">Followers</dt>
                    <dd className="font-mono text-white/75">
                      {compactNumber(employee.followerCount)}
                    </dd>
                  </div>
                )}
              </dl>

              {employee.education && employee.education.length > 0 && (
                <div className="mt-4">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                    Education
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {employee.education.map((ed) => (
                      <li key={ed.school} className="text-sm text-white/65">
                        <span className="text-white/80">{ed.school}</span>
                        {(ed.degree || ed.fieldOfStudy) && (
                          <span className="text-white/45">
                            {" "}
                            · {[ed.degree, ed.fieldOfStudy].filter(Boolean).join(", ")}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {employee.topSkills && employee.topSkills.length > 0 && (
                <div className="mt-4">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                    Skills
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {employee.topSkills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-xs text-white/60"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <a
                href={employee.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm text-[#0A66C2] hover:underline"
              >
                View on LinkedIn
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  if (typeof document !== "undefined") {
    return createPortal(panel, document.body);
  }

  return panel;
}
