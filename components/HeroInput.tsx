"use client";

import { useState, FormEvent, type ComponentType, type SVGProps } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
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
  const router = useRouter();
  const [handles, setHandles] = useState<Handles>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(id: PlatformId, value: string) {
    setHandles((prev) => ({ ...prev, [id]: value }));
    if (error) setError(null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();

    const cleaned: Partial<Record<PlatformId, string>> = {};
    for (const { id } of PLATFORMS) {
      const result = validateHandle(handles[id]);
      if (result === "invalid") {
        setError(`Enter a valid ${PLATFORMS.find((p) => p.id === id)?.label} handle`);
        return;
      }
      if (result) cleaned[id] = result;
    }

    const primary = PLATFORMS.map((p) => p.id).find((id) => cleaned[id]);
    if (!primary || !cleaned[primary]) {
      setError("Add at least one handle to map your network");
      return;
    }

    setError(null);
    setLoading(true);

    const params = new URLSearchParams();
    for (const id of PLATFORMS.map((p) => p.id)) {
      if (cleaned[id]) params.set(id, cleaned[id]!);
    }

    const qs = params.toString();
    router.push(`/graph/${cleaned[primary]}${qs ? `?${qs}` : ""}`);
  }

  return (
    <form onSubmit={submit} className="w-full max-w-lg text-left">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.45 }}
        className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur"
      >
        <div className="border-b border-white/10 px-4 py-3 sm:px-5">
          <p className="text-sm font-medium text-white/85">Your handles</p>
          <p className="mt-0.5 text-xs text-white/40">
            Add one or more — only filled platforms are mapped.
          </p>
        </div>

        <ul className="divide-y divide-white/10">
          {PLATFORMS.map(({ id, label, placeholder, Icon, accent }) => (
            <li key={id} className="flex min-h-[52px] items-center gap-3 px-4 py-2 sm:px-5">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5"
                style={{ color: accent }}
              >
                <Icon className="h-4 w-4" title={label} />
              </span>
              <label htmlFor={`handle-${id}`} className="w-[5.5rem] shrink-0 text-sm text-white/55">
                {label}
              </label>
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <span className="select-none text-sm text-white/25">@</span>
                <input
                  id={`handle-${id}`}
                  value={handles[id]}
                  onChange={(e) => update(id, e.target.value)}
                  placeholder={placeholder}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="off"
                  className="w-full bg-transparent py-2 text-sm text-white placeholder-white/25 outline-none sm:text-[15px]"
                />
              </div>
            </li>
          ))}
        </ul>

        <div className="border-t border-white/10 p-3 sm:p-4">
          <button
            type="submit"
            disabled={loading}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-background transition hover:bg-white/90 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                Map network <ArrowRight className="h-4 w-4" />
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
