"use client";

import { useActionState, useState, type FormEvent } from "react";
import { startJobForm } from "@/app/actions/startJob";
import {
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  SpotifyIcon,
  TikTokIcon,
} from "@/components/PlatformIcons";
import type { RunPlatform } from "@/lib/jobCatalog";

const PLATFORMS: {
  id: RunPlatform;
  label: string;
  Icon: typeof LinkedInIcon;
  accent: string;
}[] = [
  { id: "linkedin", label: "LinkedIn", Icon: LinkedInIcon, accent: "#0A66C2" },
  { id: "instagram", label: "Instagram", Icon: InstagramIcon, accent: "#E4405F" },
  { id: "facebook", label: "Facebook", Icon: FacebookIcon, accent: "#1877F2" },
  { id: "tiktok", label: "TikTok", Icon: TikTokIcon, accent: "#FE2C55" },
  { id: "spotify", label: "Spotify", Icon: SpotifyIcon, accent: "#1DB954" },
];

const HANDLE_RE = /^[a-z0-9._-]{1,64}$/i;

function cleanHandle(raw: string): string {
  return raw.replace(/^@/, "").trim().toLowerCase();
}

export default function SearchForm() {
  const [platform, setPlatform] = useState<RunPlatform>("linkedin");
  const [handle, setHandle] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(startJobForm, null);
  const selected = PLATFORMS.find((item) => item.id === platform) ?? PLATFORMS[0];
  const SelectedIcon = selected.Icon;
  const error = clientError ?? state?.error ?? null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const next = cleanHandle(handle);
    if (!next || !HANDLE_RE.test(next)) {
      event.preventDefault();
      setClientError(`Enter a valid ${selected.label} handle`);
    }
  }

  return (
    <main className="flex min-h-[calc(100dvh-2.25rem)] items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-medium tracking-tight text-white">
          New search
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/50">
          Pick a network, then enter the handle you want to map.
        </p>

        <div
          role="radiogroup"
          aria-label="Network"
          className="mt-8 flex items-center justify-between gap-2"
        >
          {PLATFORMS.map(({ id, label, Icon, accent }) => {
            const active = id === platform;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={label}
                title={label}
                onClick={() => {
                  setPlatform(id);
                  setClientError(null);
                }}
                className={`flex h-14 w-14 items-center justify-center rounded-2xl border transition ${
                  active
                    ? "border-white/30 bg-white/10"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                <Icon className="h-6 w-6" style={{ color: accent }} title={label} />
              </button>
            );
          })}
        </div>

        <form action={formAction} onSubmit={onSubmit} className="mt-6">
          <input type="hidden" name={platform} value={cleanHandle(handle)} />
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 focus-within:border-white/25">
            <SelectedIcon
              className="h-5 w-5 shrink-0"
              style={{ color: selected.accent }}
              title=""
            />
            <span className="sr-only">{selected.label} handle</span>
            <input
              value={handle}
              onChange={(event) => {
                setHandle(event.target.value);
                if (clientError) setClientError(null);
              }}
              placeholder="@handle"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              autoFocus
              className="h-12 min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/30"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="mt-3 h-11 w-full rounded-2xl bg-white text-sm font-medium text-[#120e18] transition hover:bg-white/90 disabled:opacity-60"
          >
            {pending ? "Opening…" : "Open graph"}
          </button>
        </form>

        {error ? (
          <p className="mt-3 text-sm text-[#F0A8A8]" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
