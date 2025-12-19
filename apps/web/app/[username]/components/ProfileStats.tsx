import { PublicUserProfile } from "@/lib/api-client";

interface ProfileStatsProps {
  profile: PublicUserProfile;
}

export default function ProfileStats({ profile }: ProfileStatsProps) {
  return (
    <div className="mt-6 border-t border-slate-200 pt-6">
      <div className="flex justify-around">
        {/* Posts Count */}
        <div className="text-center">
          <div className="text-2xl font-semibold text-gray-900">{profile.postCount}</div>
          <div className="text-sm text-gray-600">Posts</div>
        </div>

        {/* Followers Count */}
        <div className="text-center">
          <div className="text-2xl font-semibold text-gray-900">{profile.followerCount}</div>
          <div className="text-sm text-gray-600">Followers</div>
        </div>

        {/* Following Count */}
        <div className="text-center">
          <div className="text-2xl font-semibold text-gray-900">{profile.followingCount}</div>
          <div className="text-sm text-gray-600">Following</div>
        </div>
      </div>
    </div>
  );
}
