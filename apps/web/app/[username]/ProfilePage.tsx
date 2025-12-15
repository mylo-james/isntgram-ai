"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { type Session } from "next-auth";
import { apiClient } from "@/lib/api-client";
import ProfileActions from "./components/ProfileActions";
import ProfileStats from "./components/ProfileStats";
import ProfilePosts from "./components/ProfilePosts";
import ProfilePageSkeleton from "./ProfilePageSkeleton";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import type { PublicUserProfile } from "@/lib/api-client";

// Extend the Session type to include username
type AppSession = Session & {
  user: NonNullable<Session["user"]> & { id: string; username?: string };
};

export type UserProfile = PublicUserProfile;

interface ProfilePageProps {
  username: string;
  currentUser?: AppSession["user"] | null;
  initialProfile?: UserProfile | null;
  initialIsFollowing?: boolean;
}

function Avatar({ username, url }: { username: string; url?: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="avatar" className="h-full w-full object-cover" draggable={false} />;
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-gray-100 text-xl font-semibold text-gray-700">
      {username.slice(0, 1).toUpperCase()}
    </div>
  );
}

export default function ProfilePage({ username, currentUser, initialProfile, initialIsFollowing }: ProfilePageProps) {
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile ?? null);
  const [loading, setLoading] = useState(!initialProfile);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const isOwnProfile = currentUser?.username === username;
  const loadedUsernameRef = useRef<string | null>(initialProfile?.username ?? null);

  useEffect(() => {
    if (initialProfile && loadedUsernameRef.current === username) return;

    const fetchProfile = async () => {
      try {
        if (loadedUsernameRef.current !== username) setLoading(true);
        setError(null);

        const profileData = await apiClient.getUserProfile(username);
        setProfile(profileData);
        loadedUsernameRef.current = username;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    void fetchProfile();
  }, [username, initialProfile]);

  const handleProfileUpdated = (updated: { fullName: string; username: string }) => {
    setProfile((prev) => (prev ? { ...prev, fullName: updated.fullName, username: updated.username } : prev));
  };

  if (loading) {
    return <ProfilePageSkeleton />;
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">User Not Found</h1>
          <p className="text-gray-600 mb-6">The user &quot;{username}&quot; could not be found.</p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="w-full bg-[#fafafa] pb-[54px] min-[475px]:pb-0">
        <div className="w-full pt-[1px] min-[735px]:mx-auto min-[735px]:max-w-[975px] min-[735px]:px-5 min-[735px]:pt-[31px]">
          {/* Mobile header */}
          <div className="min-[735px]:hidden">
            <div className="mx-4 mb-[30px] mt-[30px] flex h-[82px]">
              <div className="mr-[28px] h-[82px] w-[77px] flex-shrink-0 overflow-hidden rounded-full">
                <Avatar username={profile.username} url={profile.profilePictureUrl} />
              </div>
              <section className="flex h-[82px] w-full flex-col justify-between">
                <div className="flex items-center justify-between text-[28px]">
                  <div className="w-[50vw] overflow-hidden text-ellipsis whitespace-nowrap text-[28px] text-[#262626]">
                    {profile.username}
                  </div>
                </div>
                <ProfileActions
                  profile={profile}
                  currentUser={currentUser}
                  isOwnProfile={isOwnProfile}
                  initialIsFollowing={initialIsFollowing}
                  onProfileUpdated={handleProfileUpdated}
                  variant="mobile"
                />
              </section>
            </div>

            <div className="px-4 pb-[11px] font-semibold text-[#262626]">{profile.fullName}</div>
            {profile.bio ? <div className="px-4 pb-[21px] text-[#262626]">{profile.bio}</div> : null}

            <ProfileStats profile={profile} currentUserId={currentUser?.id} variant="mobile" />
          </div>

          {/* Desktop header */}
          <div className="hidden min-[735px]:flex">
            <div className="mb-[44px] flex h-[150px] w-full max-w-[975px]">
              <div className="h-[150px] w-[150px] flex-shrink-0 overflow-hidden rounded-full">
                <Avatar username={profile.username} url={profile.profilePictureUrl} />
              </div>
              <section className="ml-[28px] w-full">
                <div className="mb-[20px] flex items-center text-[28px] font-normal text-[#262626]">
                  <div className="text-[28px]">{profile.username}</div>
                  <div className="ml-5">
                    <ProfileActions
                      profile={profile}
                      currentUser={currentUser}
                      isOwnProfile={isOwnProfile}
                      initialIsFollowing={initialIsFollowing}
                      onProfileUpdated={handleProfileUpdated}
                      variant="desktop"
                    />
                  </div>
                </div>

                <ProfileStats profile={profile} currentUserId={currentUser?.id} variant="desktop" />

                <div className="font-semibold text-[#262626]">{profile.fullName}</div>
                {profile.bio ? <div className="pt-[5px] text-[#262626]">{profile.bio}</div> : null}
              </section>
            </div>
          </div>

          <ProfilePosts username={profile.username} />
        </div>
      </div>
    </ErrorBoundary>
  );
}
