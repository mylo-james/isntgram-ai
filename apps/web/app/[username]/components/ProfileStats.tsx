import { useState } from "react";
import FollowersModal from "@/components/profile/FollowersModal";
import FollowingModal from "@/components/profile/FollowingModal";
import type { PublicUserProfile } from "@/lib/api-client";

interface ProfileStatsProps {
  profile: PublicUserProfile;
  currentUserId?: string;
  variant?: "mobile" | "desktop";
}

export default function ProfileStats({ profile, currentUserId, variant = "desktop" }: ProfileStatsProps) {
  const [openFollowers, setOpenFollowers] = useState(false);
  const [openFollowing, setOpenFollowing] = useState(false);

  const stats = (
    <>
      <FollowersModal
        username={profile.username}
        isOpen={openFollowers}
        onClose={() => setOpenFollowers(false)}
        followerCount={profile.followerCount}
        currentUserId={currentUserId}
      />
      <FollowingModal
        username={profile.username}
        isOpen={openFollowing}
        onClose={() => setOpenFollowing(false)}
        followingCount={profile.followingCount}
        currentUserId={currentUserId}
      />
    </>
  );

  if (variant === "mobile") {
    return (
      <>
        <section className="flex h-[61px] items-center justify-around border-b border-t border-[#dfdfdf] py-3">
          <div className="flex flex-col items-center">
            <div className="text-[14px] font-semibold text-[#262626]">{profile.postCount}</div>
            <div className="text-[14px] text-[#aaa]">posts</div>
          </div>
          <button type="button" onClick={() => setOpenFollowers(true)} className="flex flex-col items-center">
            <div className="text-[14px] font-semibold text-[#262626]">{profile.followerCount}</div>
            <div className="text-[14px] text-[#aaa]">followers</div>
          </button>
          <button type="button" onClick={() => setOpenFollowing(true)} className="flex flex-col items-center">
            <div className="text-[14px] font-semibold text-[#262626]">{profile.followingCount}</div>
            <div className="text-[14px] text-[#aaa]">following</div>
          </button>
        </section>
        {stats}
      </>
    );
  }

  return (
    <>
      <div className="mb-[20px] flex text-[#262626]">
        <div className="mr-[40px]">
          <span className="font-semibold">{profile.postCount}</span> posts
        </div>
        <button type="button" className="mr-[40px] cursor-pointer" onClick={() => setOpenFollowers(true)}>
          <span className="font-semibold">{profile.followerCount}</span> followers
        </button>
        <button type="button" className="cursor-pointer" onClick={() => setOpenFollowing(true)}>
          <span className="font-semibold">{profile.followingCount}</span> following
        </button>
      </div>
      {stats}
    </>
  );
}
