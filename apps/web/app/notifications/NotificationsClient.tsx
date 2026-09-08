"use client";

import { userError } from "@/lib/user-error";
import ErrorNotice from "@/components/ui/ErrorNotice";
import Link from "next/link";
import { useCallback, useState } from "react";
import type { NotificationItem, NotificationsResponse } from "@isntgram-ai/shared-types";
import { apiClient } from "@/lib/api-client";

interface NotificationsClientProps {
  initialNotifications: NotificationsResponse;
  initialLoadError?: boolean;
}

type LoadError = "initial" | "more" | null;

function mergeNotifications(existing: NotificationItem[], incoming: NotificationItem[]): NotificationItem[] {
  const knownIds = new Set(existing.map((notification) => notification.id));
  const merged = [...existing];

  for (const notification of incoming) {
    if (knownIds.has(notification.id)) continue;
    knownIds.add(notification.id);
    merged.push(notification);
  }

  return merged;
}

function timeAgoLabel(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";

  const seconds = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  return `${Math.floor(hours / 24)}d`;
}

function notificationTarget(notification: NotificationItem): string {
  const actorHref = `/${notification.actor.username}`;
  if (notification.type === "follow") return actorHref;
  return notification.postId ? `/post/${notification.postId}` : actorHref;
}

function notificationAction(notification: NotificationItem): string {
  if (notification.type === "follow") return "started following you.";
  if (notification.type === "comment") return "commented on your post.";
  return "liked your post.";
}

export default function NotificationsClient({
  initialNotifications,
  initialLoadError = false,
}: NotificationsClientProps) {
  const [items, setItems] = useState<NotificationItem[]>(initialNotifications.items);
  const [nextCursor, setNextCursor] = useState<string | undefined>(initialNotifications.nextCursor);
  const [loadError, setLoadError] = useState<LoadError>(initialLoadError ? "initial" : null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (isLoading) return;

    const cursor = loadError === "initial" ? undefined : nextCursor;
    if (loadError !== "initial" && !cursor) return;

    setIsLoading(true);
    try {
      const response = await apiClient.getNotifications(cursor ? { cursor } : undefined);
      setItems((previous) => mergeNotifications(previous, response.items));
      setNextCursor(response.nextCursor);
      setLoadError(null);
      setRequestError(null);
    } catch (error) {
      setRequestError(
        userError(
          error,
          cursor
            ? "We couldn’t load more notifications. Your earlier notifications are still here."
            : "We couldn’t load your notifications. Please try again.",
        ),
      );
      setLoadError(cursor ? "more" : "initial");
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, loadError, nextCursor]);

  if (loadError === "initial" && items.length === 0) {
    return (
      <ErrorNotice
        message={requestError ?? "We couldn’t load your notifications. Please try again."}
        onRetry={() => void loadNotifications()}
        pending={isLoading}
        retryLabel="Retry notifications"
      />
    );
  }

  return (
    <section className="mt-4">
      <p role="status" className="sr-only">
        {isLoading ? "Loading notifications…" : ""}
      </p>
      {items.length === 0 ? (
        <div className="social-surface p-6 text-gray-700">
          <p>No activity yet.</p>
          <Link href="/feed" className="ui-quiet mt-3">
            Home
          </Link>
        </div>
      ) : (
        <ul className="notification-list" aria-label="Notifications">
          {items.map((notification) => {
            const actor = notification.actor;
            const time = timeAgoLabel(notification.createdAt);

            return (
              <li key={notification.id}>
                <Link href={notificationTarget(notification)} className="notification-item">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={actor.profilePictureUrl ?? "/assets/default-avatar.svg"}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1 text-sm text-gray-800">
                    <span className="font-semibold text-gray-900">{actor.username}</span>{" "}
                    <span>{notificationAction(notification)}</span>{" "}
                    {time ? (
                      <time
                        className="text-gray-600"
                        dateTime={notification.createdAt}
                        title={new Date(notification.createdAt).toLocaleString()}
                      >
                        <span aria-hidden="true">{time}</span>
                        <span className="sr-only">{new Date(notification.createdAt).toLocaleString()}</span>
                      </time>
                    ) : null}
                  </div>
                  {notification.type !== "follow" && notification.postMediaUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={notification.postMediaUrl} alt="" className="h-11 w-11 rounded-lg object-cover" />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {loadError === "more" ? (
        <ErrorNotice
          message={requestError ?? "We couldn’t load more notifications. Your earlier notifications are still here."}
          onRetry={() => void loadNotifications()}
          pending={isLoading}
          retryLabel="Retry load more"
        />
      ) : null}

      {nextCursor && !loadError ? (
        <button
          type="button"
          onClick={() => void loadNotifications()}
          disabled={isLoading}
          className="ui-secondary mt-5"
        >
          {isLoading ? "Loading..." : loadError === "more" ? "Retry load more" : "Load more"}
        </button>
      ) : null}
    </section>
  );
}
