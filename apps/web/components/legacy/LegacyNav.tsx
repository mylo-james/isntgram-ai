import Link from "next/link";

function Icon({ path, className }: { path: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
      stroke="currentColor"
      fill="currentColor"
      strokeWidth="0"
      height="1em"
      width="1em"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path fill="none" d="M0 0h24v24H0z" />
      <path d={path} />
    </svg>
  );
}

const icons = {
  home: "M13 19h6V9.978l-7-5.444-7 5.444V19h6v-6h2v6zm8 1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.49a1 1 0 0 1 .386-.79l8-6.222a1 1 0 0 1 1.228 0l8 6.222a1 1 0 0 1 .386.79V20z",
  search:
    "M18.031 16.617l4.283 4.282-1.415 1.415-4.282-4.283A8.96 8.96 0 0 1 11 20c-4.968 0-9-4.032-9-9s4.032-9 9-9 9 4.032 9 9a8.96 8.96 0 0 1-1.969 5.617zm-2.006-.742A6.977 6.977 0 0 0 18 11c0-3.868-3.133-7-7-7-3.868 0-7 3.132-7 7 0 3.867 3.132 7 7 7a6.977 6.977 0 0 0 4.875-1.975l.15-.15z",
  camera:
    "M2 3.993A1 1 0 0 1 2.992 3h18.016c.548 0 .992.445.992.993v16.014a1 1 0 0 1-.992.993H2.992A.993.993 0 0 1 2 20.007V3.993zM4 5v14h16V5H4zm8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm5-11h2v2h-2V6z",
  heart:
    "M12.001 4.529c2.349-2.109 5.979-2.039 8.242.228 2.262 2.268 2.34 5.88.236 8.236l-8.48 8.492-8.478-8.492c-2.104-2.356-2.025-5.974.236-8.236 2.265-2.264 5.888-2.34 8.244-.228zm6.826 1.641c-1.5-1.502-3.92-1.563-5.49-.153l-1.335 1.198-1.336-1.197c-1.575-1.412-3.99-1.35-5.494.154-1.49 1.49-1.565 3.875-.192 5.451L12 18.654l7.02-7.03c1.374-1.577 1.299-3.959-.193-5.454z",
} as const;

export default function LegacyNav({
  avatarSrc = "/assets/default-avatar.svg",
  profileHref = "/feed",
}: {
  avatarSrc?: string;
  profileHref?: string;
}) {
  return (
    <div
      className="fixed left-0 right-0 h-[54px] w-full border-b border-gray-300 bg-white z-[100] flex justify-center"
      style={{ top: "var(--demo-banner-height, 0px)" }}
    >
      <nav className="flex justify-between items-center w-full max-w-[935px] px-5">
        <Link href="/feed">
          {/* Using the legacy logo SVG for pixel parity. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mt-2 h-10" src="/assets/logo.svg" alt="logo" />
        </Link>

        <ul className="flex items-center gap-4 sm:gap-[22px]">
          <li className="pt-1.5">
            <Link href="/feed" aria-label="Home" className="text-gray-800 hover:text-blue-500 transition-colors">
              <Icon path={icons.home} className="text-2xl fill-current" />
            </Link>
          </li>
          <li className="pt-1.5">
            <Link href="/explore" aria-label="Search" className="text-gray-800 hover:text-blue-500 transition-colors">
              <Icon path={icons.search} className="text-2xl fill-current" />
            </Link>
          </li>
          <li className="pt-1.5">
            <Link href="/upload" aria-label="Upload" className="text-gray-800 hover:text-blue-500 transition-colors">
              <Icon path={icons.camera} className="text-2xl fill-current" />
            </Link>
          </li>
          <li className="pt-1.5">
            <Link
              href="/notifications"
              aria-label="Notifications"
              className="text-gray-800 hover:text-blue-500 transition-colors"
            >
              <Icon path={icons.heart} className="text-2xl fill-current" />
            </Link>
          </li>
          <li className="pt-1.5">
            <Link href={profileHref} aria-label="Profile" className="block">
              <div className="w-6 h-6 rounded-full overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="w-full h-full object-cover" src={avatarSrc} alt="avatar" />
              </div>
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}
