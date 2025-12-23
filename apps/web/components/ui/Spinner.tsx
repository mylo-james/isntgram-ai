"use client";

export default function Spinner({
  label = "Loading",
  className = "",
  size = 24,
}: {
  label?: string;
  className?: string;
  size?: number;
}) {
  return (
    <div className={["inline-flex items-center gap-2 text-sm text-gray-600", className].join(" ")}>
      <svg
        aria-hidden="true"
        focusable="false"
        className="animate-spin text-gray-600"
        width={size}
        height={size}
        viewBox="0 0 24 24"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
      </svg>
      <span>{label}</span>
    </div>
  );
}
