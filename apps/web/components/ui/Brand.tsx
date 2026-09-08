import Link from "next/link";
import CircleMark from "./CircleMark";

export default function Brand({ className = "", href = "/feed" }: { className?: string; href?: string }) {
  return (
    <Link href={href} aria-label="Isntgram home" className={`brand-lockup brand-link rounded-lg ${className}`}>
      <span className="brand-motion">
        <CircleMark size={64} className="brand-mark" />
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/logo.svg" alt="Isntgram logo" className="brand-wordmark" />
    </Link>
  );
}
