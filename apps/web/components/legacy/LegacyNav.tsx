"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Brand from "@/components/ui/Brand";
import SignOutButton from "@/components/auth/SignOutButton";

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
  const pathname = usePathname();
  const entries = [
    { href: "/feed", label: "Home", icon: icons.home },
    { href: "/explore", label: "Explore", icon: icons.search },
    { href: "/upload", label: "Create", icon: icons.camera },
    { href: "/notifications", label: "Activity", icon: icons.heart },
    { href: profileHref, label: "Profile", icon: null },
  ];
  return (
    <header
      className="social-header fixed inset-x-0 z-[100] h-[72px] bg-white"
      style={{ top: "var(--demo-banner-height, 0px)" }}
    >
      <div className="mx-auto flex h-full max-w-[1000px] items-center justify-between gap-4 px-4">
        <Brand href="/feed" className="shrink-0" />
        <nav
          aria-label="Main navigation"
          className="social-nav fixed inset-x-0 bottom-0 bg-white pb-[env(safe-area-inset-bottom)] sm:static sm:pb-0"
        >
          <ul className="flex justify-around gap-1 px-1 sm:gap-2 sm:px-0">
            {entries.map(({ href, label, icon }) => (
              <li key={label} className="min-w-0 flex-1 sm:flex-auto">
                {label === "Profile" && href === "/feed" ? (
                  <button
                    type="button"
                    disabled
                    aria-label="Profile unavailable"
                    className="flex min-h-16 min-w-11 items-center justify-center px-1 py-2 text-xs text-gray-600 sm:min-h-11 sm:px-3 sm:text-sm"
                  >
                    <span className="h-6 w-6 overflow-hidden rounded-full" aria-hidden="true">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
                    </span>
                  </button>
                ) : (
                  <Link
                    href={href}
                    aria-label={label}
                    title={label}
                    aria-current={pathname === href && (label !== "Profile" || href !== "/feed") ? "page" : undefined}
                    className="nav-item flex min-h-16 min-w-11 flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium sm:min-h-11 sm:flex-row sm:gap-2 sm:px-3 sm:text-sm"
                  >
                    {icon ? (
                      <Icon path={icon} className="text-xl" />
                    ) : (
                      <span className="h-6 w-6 overflow-hidden rounded-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
                      </span>
                    )}
                  </Link>
                )}
              </li>
            ))}
            <li className="min-w-0 flex-1 sm:flex-auto">
              <SignOutButton
                iconOnly
                variant="outline"
                className="nav-item min-h-16 min-w-11 px-1 py-2 sm:min-h-11 sm:px-3"
              />
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
