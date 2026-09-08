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
      <span className="circle-loader" style={{ width: size, height: size }} aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <span
            key={index}
            className={`circle-loader-arm circle-loader-arm-${index % 4} ${index > 3 ? "circle-loader-reverse" : ""}`}
          >
            <span className="circle-loader-dot" />
          </span>
        ))}
      </span>
      <span>{label}</span>
    </span>
  );
}
