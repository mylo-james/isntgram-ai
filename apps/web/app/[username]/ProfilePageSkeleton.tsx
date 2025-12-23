import LegacyNav from "@/components/legacy/LegacyNav";

export default function ProfilePageSkeleton() {
  return (
    <>
      <LegacyNav />
      <main className="min-h-screen bg-[#fafafa]" style={{ paddingTop: "calc(var(--demo-banner-height, 0px) + 54px)" }}>
        <div className="mx-auto w-full max-w-[935px] px-5 pb-10 pt-6">
          <div className="flex gap-8 pb-8 pt-4">
            <div className="h-[96px] w-[96px] rounded-full bg-gray-200 animate-pulse sm:h-[150px] sm:w-[150px]" />
            <div className="flex-1">
              <div className="h-8 w-48 rounded bg-gray-200 animate-pulse" />
              <div className="mt-5 flex gap-10">
                <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
                <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
                <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-4 w-40 rounded bg-gray-200 animate-pulse" />
                <div className="h-4 w-72 rounded bg-gray-200 animate-pulse" />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-300 pt-5">
            <div className="mt-5 grid grid-cols-3 gap-1 pb-14 sm:gap-6 sm:pb-0">
              {Array.from({ length: 9 }).map((_, index) => (
                <div key={index} className="aspect-square w-full bg-gray-200 animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
