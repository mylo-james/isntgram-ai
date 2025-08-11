import Image from "next/image";

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

interface ProfileHeaderProps {
  profile: UserProfile;
}

export default function ProfileHeader({ profile }: ProfileHeaderProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center space-x-6">
        {/* Profile Picture */}
        <div className="flex-shrink-0">
          {profile.profilePictureUrl ? (
            <Image
              src={profile.profilePictureUrl}
              alt={`${profile.username}'s profile picture`}
              width={96}
              height={96}
              className="w-24 h-24 rounded-full object-cover border border-gray-200"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
              {profile.username.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Profile Information */}
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">{profile.username}</h1>
          <h2 className="text-lg text-gray-600 mb-2">{profile.fullName}</h2>
          {profile.bio && <p className="text-gray-700 text-sm leading-relaxed">{profile.bio}</p>}
        </div>
      </div>
    </div>
  );
}
