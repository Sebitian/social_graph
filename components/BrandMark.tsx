export default function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="Starling"
    >
      <defs>
        <clipPath id="starling-mark">
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>
      <g clipPath="url(#starling-mark)">
        <rect width="64" height="64" fill="#120e18" />
        <image
          href="/brand/starling.png"
          x="3"
          y="3"
          width="58"
          height="58"
          preserveAspectRatio="xMidYMid meet"
        />
      </g>
      <circle
        cx="32"
        cy="32"
        r="31.25"
        fill="none"
        stroke="white"
        strokeOpacity="0.22"
        strokeWidth="1.5"
      />
    </svg>
  );
}
