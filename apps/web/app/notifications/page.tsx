import { auth, type AppSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function NotificationsPage() {
  const session = (await auth()) as AppSession | null;
  const accessToken = session?.accessToken;
  if (!accessToken) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-[614px] px-5 pb-[54px] pt-6 min-[475px]:pb-0">
      <div className="bg-white px-5 py-6 min-[500px]:mt-5 min-[500px]:rounded-[3px] min-[500px]:border min-[500px]:border-[#dfdfdf]">
        <h1 className="text-base font-semibold text-[#262626]">Notifications</h1>
        <p className="mt-2 text-sm text-gray-600">Notifications aren’t implemented yet.</p>
      </div>
    </main>
  );
}
