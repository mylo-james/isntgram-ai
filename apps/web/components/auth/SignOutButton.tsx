"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

interface SignOutButtonProps {
  className?: string;
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
}

export default function SignOutButton({ className = "", variant = "outline", size = "md" }: SignOutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const router = useRouter();

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut({
        redirect: false,
        callbackUrl: "/login",
      });

      // Redirect to login page
      router.push("/login");
    } catch (error) {
      console.error("Sign out error:", error);
      // Even if sign out fails, redirect to login
      router.push("/login");
    } finally {
      setIsLoading(false);
      setShowConfirmation(false);
    }
  };

  const handleClick = () => {
    setShowConfirmation(true);
  };

  const handleCancel = () => {
    setShowConfirmation(false);
  };

  if (showConfirmation) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Are you sure?</span>
        <Button variant="secondary" size="sm" onClick={handleSignOut} loading={isLoading} loadingText="Signing out...">
          Yes, Sign Out
        </Button>
        <Button variant="outline" size="sm" onClick={handleCancel} disabled={isLoading}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button variant={variant} size={size} onClick={handleClick} className={className}>
      Sign Out
    </Button>
  );
}
