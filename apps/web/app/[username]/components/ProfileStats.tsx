import ProfileStatsInner from "@/components/profile/ProfileStats";
import FollowersModal from "@/components/profile/FollowersModal";
import FollowingModal from "@/components/profile/FollowingModal";
import { useState } from "react";

interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  email: string;
  profilePictureUrl?: string;
  bio?: string;
  postCount: number;
  followerCount: number;
  followingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ProfileStatsProps {
  profile: UserProfile;
}

export default function ProfileStats({ profile }: ProfileStatsProps) {
  const [openFollowers, setOpenFollowers] = useState(false);
  const [openFollowing, setOpenFollowing] = useState(false);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <ProfileStatsInner
        postCount={profile.postCount}
        followerCount={profile.followerCount}
        followingCount={profile.followingCount}
        onFollowersClick={() => setOpenFollowers(true)}
        onFollowingClick={() => setOpenFollowing(true)}
      />
      <FollowersModal
        username={profile.username}
        isOpen={openFollowers}
        onClose={() => setOpenFollowers(false)}
        followerCount={profile.followerCount}
        currentUserId={profile.id}
      />
      <FollowingModal
        username={profile.username}
        isOpen={openFollowing}
        onClose={() => setOpenFollowing(false)}
        followingCount={profile.followingCount}
        currentUserId={profile.id}
      />
    </div>
  );
}
