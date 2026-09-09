import Spinner from "@/components/ui/Spinner";
export default function Loading() {
  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-[60vh] items-center justify-center">
      <Spinner size={64} label="Loading page…" />
    </main>
  );
}
