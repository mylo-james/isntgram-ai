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
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="flex justify-around">
        {/* Posts Count */}
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{profile.postCount}</div>
          <div className="text-sm text-gray-600">Posts</div>
        </div>

        {/* Followers Count */}
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{profile.followerCount}</div>
          <div className="text-sm text-gray-600">Followers</div>
        </div>

        {/* Following Count */}
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{profile.followingCount}</div>
          <div className="text-sm text-gray-600">Following</div>
        </div>
      </div>
    </div>
  );
}
