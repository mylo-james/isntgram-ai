import LegacyNav from "@/components/legacy/LegacyNav";
import { auth } from "@/lib/auth";
import { getApiAccessToken, getRequestId, internalApi } from "@/lib/server-api";
import { redirect } from "next/navigation";
import Link from "next/link";

function timeAgoLabel(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default async function NotificationsPage() {
  const session = await auth();
  const accessToken = await getApiAccessToken();
  const requestId = await getRequestId();

  if (!session?.user?.id || !accessToken) {
    redirect("/login");
  }

  const [{ data }, { data: notifications }] = await Promise.all([
    internalApi.GET("/api/users/me", {
      headers: { Authorization: `Bearer ${accessToken}`, "x-request-id": requestId },
      cache: "no-store",
    }),
    internalApi.GET("/api/notifications", {
      headers: { Authorization: `Bearer ${accessToken}`, "x-request-id": requestId },
      cache: "no-store",
    }),
  ]);

  const avatarSrc = data?.profilePictureUrl ?? "/assets/profile.jpeg";
  const profileHref = session.user.username ? `/${session.user.username}` : "/feed";
  const items = notifications?.items ?? [];

  return (
    <>
      <LegacyNav avatarSrc={avatarSrc} profileHref={profileHref} />
      <main className="min-h-screen bg-[#fafafa]" style={{ paddingTop: "calc(var(--demo-banner-height, 0px) + 54px)" }}>
        <div className="mx-auto w-full max-w-[600px] px-4 pb-10 pt-6">
          <h1 className="text-sm font-semibold text-gray-800">Notifications</h1>

          {items.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No notifications yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {items.map((notification) => {
                const actor = notification.actor;
                const actorHref = `/${actor.username}`;
                const postHref = notification.postId ? `/post/${notification.postId}` : null;
                const targetHref = notification.type === "follow" ? actorHref : (postHref ?? actorHref);
                const action =
                  notification.type === "follow"
                    ? "started following you."
                    : notification.type === "comment"
                      ? "commented on your post."
                      : "liked your post.";
                const time = timeAgoLabel(notification.createdAt);

                return (
                  <li key={notification.id}>
                    <Link
                      href={targetHref}
                      className="flex items-center gap-3 rounded-sm border border-gray-200 bg-white px-3 py-3 hover:bg-gray-50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={actor.profilePictureUrl ?? "/assets/profile.jpeg"}
                        alt={actor.username}
                        className="h-10 w-10 rounded-full object-cover"
                      />

                      <div className="min-w-0 flex-1 text-sm text-gray-800">
                        <span className="font-semibold text-gray-900">{actor.username}</span>{" "}
                        <span className="text-gray-800">{action}</span>{" "}
                        {time ? <span className="text-gray-500">{time}</span> : null}
                      </div>

                      {notification.type !== "follow" && notification.postMediaUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={notification.postMediaUrl} alt="" className="h-10 w-10 rounded-sm object-cover" />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
