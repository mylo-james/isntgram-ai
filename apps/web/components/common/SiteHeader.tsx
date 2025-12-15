"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import SignOutButton from "@/components/auth/SignOutButton";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import { svgDataUri } from "@/lib/placeholder-image";
import { RiCamera2Line, RiHeartLine, RiHome5Line, RiSearchLine } from "react-icons/ri";

export default function SiteHeader() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated" && Boolean(session?.user);
  const username = (session?.user as unknown as { username?: string })?.username;
  const isVisualTestMode = process.env.NEXT_PUBLIC_VISUAL_TEST_MODE === "true";
  const effectiveUsername = isVisualTestMode ? process.env.NEXT_PUBLIC_VISUAL_TEST_USERNAME || "demo_user" : username;

  const isAuthPage = pathname === "/login" || pathname === "/register";
  const showNav = (isVisualTestMode || isAuthenticated) && !isAuthPage;

  const [avatarUrl, setAvatarUrl] = useState<string | null>(() =>
    isVisualTestMode ? svgDataUri("ME", "#dbeafe", "#1e3a8a") : null,
  );
  const avatarFallback = useMemo(
    () => (effectiveUsername ? effectiveUsername.slice(0, 1).toUpperCase() : "?"),
    [effectiveUsername],
  );

  useEffect(() => {
    if (!showNav) return;
    if (isVisualTestMode) return;
    let cancelled = false;
    (async () => {
      try {
        const me = await apiClient.getMyProfile();
        if (cancelled) return;
        setAvatarUrl(me.profilePictureUrl ?? null);
      } catch {
        if (cancelled) return;
        setAvatarUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showNav, isVisualTestMode]);

  if (!showNav) return null;

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const profileHref = effectiveUsername ? `/${effectiveUsername}` : "/feed";
  const isProfileActive = effectiveUsername ? pathname === profileHref : false;

  return (
    <>
      <header
        data-testid="site-header"
        className="sticky top-0 z-50 flex h-[54px] w-full justify-center border-b border-[#dfdfdf] bg-white"
      >
        <nav className="flex w-full max-w-[935px] items-center justify-center px-5 min-[475px]:justify-between">
          <Link href="/feed" aria-label="Home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="mt-[9px] h-10" src="/logo.svg" alt="logo" />
          </Link>

          <ul className="hidden items-center min-[475px]:flex" aria-label="Primary">
            <li className="ml-[22px] pt-[6px]">
              <Link
                href="/feed"
                aria-label="Feed"
                className={cn("inline-flex items-center", isActive("/feed") ? "text-[#0095f6]" : "text-[#262626]")}
              >
                <RiHome5Line size={25} aria-hidden />
              </Link>
            </li>
            <li className="ml-[22px] pt-[6px]">
              <Link
                href="/explore"
                aria-label="Explore"
                className={cn("inline-flex items-center", isActive("/explore") ? "text-[#0095f6]" : "text-[#262626]")}
              >
                <RiSearchLine size={25} aria-hidden />
              </Link>
            </li>
            <li className="ml-[22px] pt-[6px]">
              <Link
                href="/upload"
                aria-label="Upload"
                className={cn("inline-flex items-center", isActive("/upload") ? "text-[#0095f6]" : "text-[#262626]")}
              >
                <RiCamera2Line size={25} aria-hidden />
              </Link>
            </li>
            <li className="ml-[22px] pt-[6px]">
              <Link
                href="/notifications"
                aria-label="Notifications"
                className={cn(
                  "inline-flex items-center",
                  isActive("/notifications") ? "text-[#0095f6]" : "text-[#262626]",
                )}
              >
                <RiHeartLine size={25} aria-hidden />
              </Link>
            </li>
            <li className="ml-[22px] pt-[6px]">
              <Link href={profileHref} aria-label="Profile">
                <div
                  className={cn(
                    "flex h-[25px] w-[25px] items-center justify-center overflow-hidden rounded-full bg-gray-100 text-xs font-semibold text-gray-700",
                    isProfileActive ? "p-px ring-2 ring-[#0095f6]" : "",
                  )}
                >
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="avatar" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    avatarFallback
                  )}
                </div>
              </Link>
            </li>
          </ul>

          <div className="hidden min-[475px]:flex items-center gap-3" data-testid="nav-authenticated">
            {isVisualTestMode ? null : <SignOutButton variant="secondary" size="sm" />}
          </div>
        </nav>
      </header>

      <nav
        className="fixed bottom-0 left-0 z-50 flex h-[54px] w-full justify-center border-t border-[#dfdfdf] bg-white min-[475px]:hidden"
        aria-label="Mobile"
      >
        <div className="flex w-full items-center justify-around px-5">
          <Link
            href="/feed"
            aria-label="Feed"
            className={cn("inline-flex items-center", isActive("/feed") ? "text-[#0095f6]" : "text-[#262626]")}
          >
            <RiHome5Line size={25} aria-hidden />
          </Link>
          <Link
            href="/explore"
            aria-label="Explore"
            className={cn("inline-flex items-center", isActive("/explore") ? "text-[#0095f6]" : "text-[#262626]")}
          >
            <RiSearchLine size={25} aria-hidden />
          </Link>
          <Link
            href="/upload"
            aria-label="Upload"
            className={cn("inline-flex items-center", isActive("/upload") ? "text-[#0095f6]" : "text-[#262626]")}
          >
            <RiCamera2Line size={25} aria-hidden />
          </Link>
          <Link
            href="/notifications"
            aria-label="Notifications"
            className={cn("inline-flex items-center", isActive("/notifications") ? "text-[#0095f6]" : "text-[#262626]")}
          >
            <RiHeartLine size={25} aria-hidden />
          </Link>
          <Link href={profileHref} aria-label="Profile">
            <div
              className={cn(
                "flex h-[25px] w-[25px] items-center justify-center overflow-hidden rounded-full bg-gray-100 text-xs font-semibold text-gray-700",
                isProfileActive ? "p-px ring-2 ring-[#0095f6]" : "",
              )}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="avatar" className="h-full w-full rounded-full object-cover" />
              ) : (
                avatarFallback
              )}
            </div>
          </Link>
        </div>
      </nav>
    </>
  );
}
