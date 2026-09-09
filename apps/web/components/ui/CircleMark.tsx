/** The original eight-circle motif, shared by the brand and loading states. */
export default function CircleMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`circle-loader ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => (
        <span
          key={index}
          className={`circle-loader-arm circle-loader-arm-${index % 4} ${index > 3 ? "circle-loader-reverse" : ""}`}
        >
          <span className="circle-loader-dot" />
        </span>
      ))}
    </span>
  );
}
