"use client";

import type { ReactNode } from "react";

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-screen w-screen justify-end overflow-hidden bg-[#fafafa]">
      <div
        className="absolute inset-0 -z-10 bg-cover bg-center"
        aria-hidden
        style={{ backgroundImage: "url(/auth-splash.svg)" }}
      />
      <div className="h-full w-full max-w-[500px] border border-[#dfdfdf] bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="mx-auto mt-[20%] w-full max-w-[200px] object-contain" src="/logo.svg" alt="logo" />
        {children}
      </div>
    </div>
  );
}
