import { auth, type AppSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import UploadForm from "./UploadForm";

export default async function UploadPage() {
  const session = (await auth()) as AppSession | null;
  const accessToken = session?.accessToken;
  if (!accessToken) redirect("/login");

  const isDemoUser = Boolean(session?.user.isDemoUser);

  return (
    <main className="mx-auto w-full max-w-[500px] px-5 pb-[54px] pt-6 min-[475px]:pb-0">
      <UploadForm isDemoUser={isDemoUser} />
    </main>
  );
}
