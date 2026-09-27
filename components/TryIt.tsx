"use client";

import { FormEvent, useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { startJobForm } from "@/app/actions/startJob";
import {
  InstagramIcon,
  LinkedInIcon,
  SpotifyIcon,
  TikTokIcon,
} from "@/components/PlatformIcons";
import {
  catalogJobForHandle,
  catalogJobMatchesPlatform,
  jobPath,
  type RunPlatform,
} from "@/lib/jobCatalog";

const SAVED = [
  { label: "diandra", handle: "diandra" },
  { label: "aiman", handle: "nuancedaiman" },
  { label: "aiman fma", handle: "aiman-fma" },
  { label: "kossof instagram", handle: "kossof_salonspa" },
  { label: "kossof facebook", handle: "kossof-facebook" },
  { label: "kossof tiktok", handle: "kossof.salon.spa" },
  { label: "sebastian", handle: "sebastian" },
  { label: "formation bio", handle: "formation-bio" },
  { label: "nous", handle: "nous-research" },
  { label: "romanian", handle: "romanian" },
] as const;

const FIELDS: {
  id: RunPlatform;
  label: string;
  Icon: typeof InstagramIcon;
  accent: string;
}[] = [
  { id: "instagram", label: "Instagram", Icon: InstagramIcon, accent: "#E4405F" },
  { id: "linkedin", label: "LinkedIn", Icon: LinkedInIcon, accent: "#0A66C2" },
  { id: "tiktok", label: "TikTok", Icon: TikTokIcon, accent: "#111111" },
  { id: "spotify", label: "Spotify", Icon: SpotifyIcon, accent: "#1DB954" },
];

const EMPTY: Record<(typeof FIELDS)[number]["id"], string> = {
  instagram: "",
  linkedin: "",
  tiktok: "",
  spotify: "",
};

export default function TryIt({ titleClassName = "" }: { titleClassName?: string }) {
  const router = useRouter();
  const [values, setValues] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(startJobForm, null);

  function openHandle(raw: string) {
    const job = catalogJobForHandle(raw);
    if (!job) {
      setError("no saved map for that handle.");
      return;
    }
    setError(null);
    router.push(jobPath(job.id));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const filled = FIELDS.flatMap((field) => {
      const handle = values[field.id].replace(/^@/, "").trim();
      return handle ? [{ ...field, handle }] : [];
    });
    if (!filled.length) {
      event.preventDefault();
      setError("add a handle.");
      return;
    }
    const missing = filled.filter((field) => {
      const job = catalogJobForHandle(field.handle);
      return !job || !catalogJobMatchesPlatform(job, field.id);
    });
    if (missing.length) {
      event.preventDefault();
      const names = missing.map((field) => field.label.toLowerCase());
      setError(
        names.length === 1
          ? `no saved ${names[0]} map for that handle.`
          : `no saved map for ${names.join(" or ")}.`,
      );
      return;
    }
    setError(null);
  }

  const shownError = error ?? state?.error ?? null;

  return (
    <section id="try" className="mx-auto max-w-xl px-6 py-24 text-center">
      <h2 className={`${titleClassName} text-4xl tracking-tight sm:text-5xl`}>
        try it out
      </h2>
      <form action={formAction} onSubmit={onSubmit} className="mx-auto mt-8 w-full max-w-sm">
        <ul className="flex flex-col gap-2 text-left">
          {FIELDS.map(({ id, label, Icon, accent }) => (
            <li key={id} className="flex items-center gap-3">
              <Icon className="h-[18px] w-[18px] shrink-0" style={{ color: accent }} title={label} />
              <label className="sr-only" htmlFor={`try-${id}`}>
                {label} handle
              </label>
              <input
                id={`try-${id}`}
                name={id}
                value={values[id]}
                onChange={(event) => {
                  setValues((prev) => ({ ...prev, [id]: event.target.value }));
                  if (error) setError(null);
                }}
                placeholder="@handle"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="off"
                className="min-w-0 flex-1 border-b border-[#D5CDBF] bg-transparent py-2 text-base text-[#161A17] outline-none placeholder:text-[#5E665F]"
              />
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="text-sm font-medium text-[#0F766E] disabled:opacity-60"
          >
            open
          </button>
        </div>
      </form>
      {shownError ? (
        <p className="mt-3 text-sm text-[#9B3A4A]" role="alert">
          {shownError}
        </p>
      ) : null}
      <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-[#5E665F]">
        {SAVED.map((item) => (
          <li key={item.handle}>
            <button
              type="button"
              onClick={() => openHandle(item.handle)}
              className="hover:text-[#161A17]"
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
