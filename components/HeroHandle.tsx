"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { catalogJobForHandle, jobPath } from "@/lib/jobCatalog";

export default function HeroHandle() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const handle = value.trim();
    if (!handle) {
      setError("Add a handle.");
      return;
    }
    const job = catalogJobForHandle(handle);
    if (!job) {
      setError("No saved map for that handle.");
      return;
    }
    setError(null);
    router.push(jobPath(job.id));
  }

  return (
    <form onSubmit={onSubmit} className="mt-8">
      <div className="flex items-baseline text-[15px] leading-none">
        <label className="sr-only" htmlFor="hero-handle">
          Handle
        </label>
        <span className="inline-grid items-baseline">
          <span className="invisible col-start-1 row-start-1 whitespace-pre px-px">
            {value || "@handle"}
          </span>
          <input
            id="hero-handle"
            value={value}
            size={Math.max((value || "@handle").length, 1)}
            onChange={(event) => {
              setValue(event.target.value);
              if (error) setError(null);
            }}
            placeholder="@handle"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="col-start-1 row-start-1 w-auto min-w-0 bg-transparent text-[#161A17] outline-none placeholder:text-[#161A17]"
          />
        </span>
        <span aria-hidden className="pl-2 text-[#161A17]">
          ·
        </span>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-[#9B3A4A]" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
