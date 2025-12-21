import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/feed");
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fef3c7,_#fff_45%,_#e2e8f0_90%)]">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <header className="flex flex-col gap-6 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Isntgram AI</p>
          <h1 className="text-4xl font-semibold text-slate-900 sm:text-6xl">Build a signal-first social feed.</h1>
          <p className="mx-auto max-w-2xl text-base text-slate-600">
            Isntgram is a modern, AI-assisted social platform that prioritizes meaningful updates, curated follow
            graphs, and lightweight media sharing.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="rounded-full bg-slate-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Create account
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-slate-300 px-8 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
            >
              Sign in
            </Link>
          </div>
        </header>

        <section className="mt-16 grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Curated feed",
              description: "Follow the people you care about and keep your feed focused on real signal.",
            },
            {
              title: "Instant posting",
              description: "Share concise updates with optional imagery in a clean, distraction-free composer.",
            },
            {
              title: "Profile clarity",
              description: "Showcase your updates, follower counts, and profile details with zero clutter.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-3 text-sm text-slate-600">{item.description}</p>
            </div>
          ))}
        </section>

        <section className="mt-16 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Stack</h2>
            <p className="mt-4 text-base text-slate-700">
              Next.js App Router, NestJS, Auth.js, Postgres, and S3-compatible media storage. Built with
              production-shaped patterns and tested end to end.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-900 bg-slate-900 p-8 text-white shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Demo-ready</h2>
            <p className="mt-4 text-base text-slate-200">
              Spin up the stack locally in minutes, explore the demo workflow, and review the API docs without
              guesswork.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
