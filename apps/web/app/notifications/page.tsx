import LegacyNav from "@/components/legacy/LegacyNav";
import { auth } from "@/lib/auth";
import { getApiAccessToken, getRequestId, internalApi } from "@/lib/server-api";
import { redirect } from "next/navigation";
import NotificationsClient from "./NotificationsClient";

function isNotificationsPayload(value: unknown): value is {
  items: Array<{
    id: string;
    type: "follow" | "like" | "comment";
    createdAt: string;
    actor: { id: string; username: string; fullName: string; profilePictureUrl?: string };
    postId?: string;
    postMediaUrl?: string;
  }>;
  nextCursor?: string;
} {
  return typeof value === "object" && value !== null && Array.isArray((value as { items?: unknown }).items);
}

export default async function NotificationsPage() {
  const session = await auth();
  const accessToken = await getApiAccessToken();
  const requestId = await getRequestId();

  if (!session?.user?.id || !accessToken) {
    redirect(session?.user?.id ? "/login?reauth=1" : "/login");
  }

  const profileRequest = internalApi
    .GET("/api/users/me", {
      headers: { Authorization: `Bearer ${accessToken}`, "x-request-id": requestId },
      cache: "no-store",
    })
    .catch(() => undefined);
  const notificationsRequest = internalApi
    .GET("/api/notifications", {
      headers: { Authorization: `Bearer ${accessToken}`, "x-request-id": requestId },
      cache: "no-store",
    })
    .catch(() => undefined);

  const [profileResult, notificationsResult] = await Promise.all([profileRequest, notificationsRequest]);
  if (notificationsResult?.response.status === 401) redirect("/login?reauth=1");
  const notifications = notificationsResult?.data;
  const initialLoadError = !notificationsResult?.response.ok || !isNotificationsPayload(notifications);
  const initialNotifications = isNotificationsPayload(notifications)
    ? notifications
    : { items: [], nextCursor: undefined };

  const avatarSrc = profileResult?.data?.profilePictureUrl ?? "/assets/default-avatar.svg";
  const profileHref =
    profileResult?.response.ok &&
    typeof profileResult.data?.username === "string" &&
    profileResult.data.username.length > 0
      ? `/${profileResult.data.username}`
      : "/feed";

  return (
    <>
      <LegacyNav avatarSrc={avatarSrc} profileHref={profileHref} />
      <main
        id="main-content"
        tabIndex={-1}
        className="social-page min-h-screen bg-[#fafafa]"
        style={{ paddingTop: "calc(var(--demo-banner-height, 0px) + 72px)" }}
      >
        <div className="mx-auto w-full max-w-[600px] px-4 pb-10 pt-6">
          <h1 className="text-sm font-semibold text-gray-800">Notifications</h1>
          <NotificationsClient initialNotifications={initialNotifications} initialLoadError={initialLoadError} />
        </div>
      </main>
    </>
  );
}
