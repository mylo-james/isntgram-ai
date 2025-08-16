'use client';

import Link from 'next/link';
import { UserProfile } from '../../lib/api-client';

interface UserListItemProps {
  user: UserProfile;
}

export function UserListItem({ user }: UserListItemProps) {
  return (
    <Link href={`/${user.username}`} className="block p-4 hover:bg-gray-50">
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0">
          {user.profilePictureUrl ? (
            <img
              src={user.profilePictureUrl}
              alt={`${user.username}'s profile`}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
              <span className="text-gray-600 font-medium text-sm">
                {user.fullName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {user.username}
          </p>
          <p className="text-sm text-gray-500 truncate">
            {user.fullName}
          </p>
        </div>
      </div>
    </Link>
  );
}