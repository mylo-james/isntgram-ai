import LegacyNav from "@/components/legacy/LegacyNav";
import { auth } from "@/lib/auth";
import { getApiAccessToken, getRequestId, internalApi } from "@/lib/server-api";
import { redirect } from "next/navigation";
import UploadClient from "./UploadClient";

export default async function UploadPage() {
  const session = await auth();
  const accessToken = await getApiAccessToken();
  const requestId = await getRequestId();

  if (!session?.user?.id || !accessToken) {
    redirect(session?.user?.id ? "/login?reauth=1" : "/login");
  }

  const { data, response } = await internalApi.GET("/api/users/me", {
    headers: { Authorization: `Bearer ${accessToken}`, "x-request-id": requestId },
    cache: "no-store",
  });

  const avatarSrc = data?.profilePictureUrl ?? "/assets/default-avatar.svg";
  const profileHref =
    response.ok && typeof data?.username === "string" && data.username.length > 0 ? `/${data.username}` : "/feed";

  return (
    <>
      <LegacyNav avatarSrc={avatarSrc} profileHref={profileHref} />
      <main
        id="main-content"
        tabIndex={-1}
        className="social-page min-h-screen bg-[#fafafa]"
        style={{ paddingTop: "calc(var(--demo-banner-height, 0px) + 72px)" }}
      >
        <UploadClient />
      </main>
    </>
  );
}
