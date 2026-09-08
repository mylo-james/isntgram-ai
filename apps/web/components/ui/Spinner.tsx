import CircleMark from "./CircleMark";

export default function Spinner({
  label = "Loading",
  className = "",
  size = 40,
}: {
  label?: string;
  className?: string;
  size?: number;
}) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-hidden={label ? undefined : true}
      className={`inline-flex items-center gap-3 text-sm text-gray-700 ${className}`}
    >
      <CircleMark size={size} />
      <span>{label}</span>
    </span>
  );
}
