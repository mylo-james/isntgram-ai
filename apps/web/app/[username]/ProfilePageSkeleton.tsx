import LegacyNav from "@/components/legacy/LegacyNav";
import Spinner from "@/components/ui/Spinner";

export default function ProfilePageSkeleton() {
  return (
    <>
      <LegacyNav />
      <main
        id="main-content"
        tabIndex={-1}
        className="social-page flex min-h-[60vh] items-center justify-center bg-[#fafafa]"
        style={{ paddingTop: "calc(var(--demo-banner-height, 0px) + 72px)" }}
      >
        <Spinner size={64} label="Loading profile…" />
      </main>
    </>
  );
}
