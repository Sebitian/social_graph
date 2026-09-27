"use client";

import { useActionState, useState, type ComponentType, type SVGProps } from "react";
import { motion } from "framer-motion";
import { startJobForm } from "@/app/actions/startJob";
import { ArrowRight, Loader2 } from "lucide-react";
import {
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  SpotifyIcon,
  TikTokIcon,
} from "@/components/PlatformIcons";

type PlatformId =
  | "linkedin"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "spotify";

type PlatformIcon = ComponentType<SVGProps<SVGSVGElement> & { title?: string }>;

const PLATFORMS: {
  id: PlatformId;
  label: string;
  placeholder: string;
  Icon: PlatformIcon;
  accent: string;
}[] = [
  {
    id: "linkedin",
    label: "LinkedIn",
    placeholder: "profile-slug",
    Icon: LinkedInIcon,
    accent: "#0A66C2",
  },
  {
    id: "instagram",
    label: "Instagram",
    placeholder: "username",
    Icon: InstagramIcon,
    accent: "#E4405F",
  },
  {
    id: "facebook",
    label: "Facebook",
    placeholder: "page-or-username",
    Icon: FacebookIcon,
    accent: "#1877F2",
  },
  {
    id: "tiktok",
    label: "TikTok",
    placeholder: "username",
    Icon: TikTokIcon,
    accent: "#69C9D0",
  },
  {
    id: "spotify",
    label: "Spotify",
    placeholder: "user-id-or-name",
    Icon: SpotifyIcon,
    accent: "#1DB954",
  },
];

const HANDLE_RE = /^[a-z0-9._-]{1,64}$/i;

type Handles = Record<PlatformId, string>;

const EMPTY: Handles = {
  linkedin: "",
  instagram: "",
  facebook: "",
  tiktok: "",
  spotify: "",
};

function cleanHandle(raw: string): string {
  return raw.replace(/^@/, "").trim().toLowerCase();
}

function validateHandle(raw: string): string | null {
  const handle = cleanHandle(raw);
  if (!handle) return null;
  if (!HANDLE_RE.test(handle)) return "invalid";
  return handle;
}

export default function HeroInput() {
  const [handles, setHandles] = useState<Handles>(EMPTY);
  const [state, formAction, pending] = useActionState(startJobForm, null);

  function update(id: PlatformId, value: string) {
    setHandles((prev) => ({ ...prev, [id]: value }));
  }

  const clientError = (() => {
    for (const { id, label } of PLATFORMS) {
      if (validateHandle(handles[id]) === "invalid") {
        return `Enter a valid ${label} handle`;
      }
    }
    return null;
  })();
  const error = clientError ?? state?.error ?? null;

  return (
    <form id="map" action={formAction} className="w-full max-w-lg text-left">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.45 }}
        className="overflow-hidden rounded-2xl border border-[#D5CDBF] bg-[#FBF8F2]"
      >
        <div className="border-b border-[#E4DDD0] px-4 py-3 sm:px-5">
          <p className="text-sm font-medium text-[#161A17]">Your handles</p>
          <p className="mt-0.5 text-xs text-[#5E665F]">
            Add one or more. Only filled platforms are mapped.
          </p>
        </div>

        <ul className="divide-y divide-[#E4DDD0]">
          {PLATFORMS.map(({ id, label, placeholder, Icon, accent }) => (
            <li key={id} className="flex min-h-[52px] items-center gap-3 px-4 py-2 sm:px-5">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E4DDD0]"
                style={{ color: accent }}
              >
                <Icon className="h-4 w-4" title={label} />
              </span>
              <label htmlFor={`handle-${id}`} className="w-[5.5rem] shrink-0 text-sm text-[#5E665F]">
                {label}
              </label>
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <span className="select-none text-sm text-[#5E665F]">@</span>
                <input
                  id={`handle-${id}`}
                  name={id}
                  value={handles[id]}
                  onChange={(e) => update(id, e.target.value)}
                  placeholder={placeholder}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="off"
                  className="w-full bg-transparent py-2 text-sm text-[#161A17] placeholder-[#5E665F]/70 outline-none sm:text-[15px]"
                />
              </div>
            </li>
          ))}
        </ul>

        <div className="border-t border-[#E4DDD0] p-3 sm:p-4">
          <button
            type="submit"
            disabled={pending || Boolean(clientError)}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-5 py-3 text-sm font-semibold text-[#FBF8F2] transition hover:bg-[#0c615b] disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                Map a handle <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </motion.div>

      {error && (
        <p className="mt-2.5 px-1 text-sm text-ig-pink" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
