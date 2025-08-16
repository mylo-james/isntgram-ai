'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { SignOutButton } from '../auth/SignOutButton';

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
            Isntgram
          </Link>

          {/* Navigation */}
          {session ? (
            <nav className="flex items-center space-x-6">
              <Link 
                href="/feed" 
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
              >
                Feed
              </Link>
              <Link 
                href={`/${session.user?.username || 'profile'}`} 
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
              >
                Profile
              </Link>
              <SignOutButton />
            </nav>
          ) : (
            <nav className="flex items-center space-x-4">
              <Link 
                href="/login" 
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
              >
                Sign In
              </Link>
              <Link 
                href="/register" 
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Sign Up
              </Link>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}