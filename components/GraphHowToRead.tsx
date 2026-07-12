import { PROXIMITY_RINGS } from "@/lib/graphUtils";

const RECEIVED_COLOR = "#3b82f6";
const SENT_COLOR = "#ef4444";

export function GraphHowToRead({ className = "" }: { className?: string }) {
  return (
    <div
      className={`border-b border-white/10 bg-black/70 px-4 py-3 backdrop-blur ${className}`}
    >
      <div className="text-xs font-semibold text-white/85 sm:text-[11px]">
        How to read this
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-white/60 sm:text-[10px] sm:leading-relaxed sm:text-white/45">
        <span className="text-white/75">Distance</span> = closeness: closer to you means
        more recent, consistent interaction. <span className="text-white/75">Color</span> =
        people who comment on the same posts as each other (not distance).{" "}
        <span className="text-white/75">Spokes</span> = comments with you.
      </p>
      <div className="mt-2.5 grid gap-2 border-t border-white/10 pt-2.5 text-xs sm:grid-cols-2 sm:text-[10px]">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-0.5 w-5 shrink-0 rounded-full"
            style={{ backgroundColor: SENT_COLOR }}
          />
          <span className="text-white/65">
            <span style={{ color: SENT_COLOR }}>Red → them</span>
            {" "}
            comments you sent
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-0.5 w-5 shrink-0 rounded-full"
            style={{ backgroundColor: RECEIVED_COLOR }}
          />
          <span className="text-white/65">
            <span style={{ color: RECEIVED_COLOR }}>Blue → you</span>
            {" "}
            comments they sent
          </span>
        </div>
        <p className="text-white/50 sm:col-span-2">
          Spoke label: <span style={{ color: SENT_COLOR }}>sent</span>
          {" · "}
          <span style={{ color: RECEIVED_COLOR }}>received</span>
          {" "}
          (— = their posts weren&apos;t scraped)
        </p>
      </div>
      <div className="mt-2.5 grid gap-2 border-t border-white/10 pt-2.5 sm:grid-cols-2">
        {PROXIMITY_RINGS.map((ring) => (
          <div key={ring.id} className="flex items-center gap-2 text-xs sm:text-[10px]">
            <span className="flex h-3 w-3 shrink-0 items-center justify-center">
              <span
                className="rounded-full border border-white/40"
                style={{ width: 4 + ring.id * 3, height: 4 + ring.id * 3 }}
              />
            </span>
            <div>
              <span className="font-medium text-white/75">{ring.label}</span>
              <span className="text-white/50"> — {ring.subtitle}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
