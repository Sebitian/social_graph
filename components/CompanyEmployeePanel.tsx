"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, X } from "lucide-react";
import type { CompanyEmployee } from "@/lib/companyTypes";
import { compactNumber } from "@/lib/graphUtils";

interface Props {
  employee: CompanyEmployee | null;
  onClose: () => void;
}

export default function CompanyEmployeePanel({ employee, onClose }: Props) {
  return (
    <AnimatePresence>
      {employee && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur sm:p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
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
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white/70"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {employee.headline && employee.headline !== employee.title && (
            <p className="mt-3 text-sm leading-relaxed text-white/45">
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
