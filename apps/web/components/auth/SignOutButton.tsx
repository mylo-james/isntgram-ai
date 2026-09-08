"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import { apiClient } from "@/lib/api-client";

interface SignOutButtonProps {
  className?: string;
  variant?: "primary" | "secondary" | "outline" | "destructive";
  size?: "sm" | "md" | "lg";
  iconOnly?: boolean;
}

export default function SignOutButton({
  className = "",
  variant = "destructive",
  size = "md",
  iconOnly = false,
}: SignOutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const router = useRouter();

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await apiClient.logout().catch((error) => {
        if (process.env.NODE_ENV !== "production") {
          console.error("Logout API error:", error);
        }
      });

      await signOut({
        redirect: false,
        callbackUrl: "/login",
      });

      // Redirect to login page
      router.push("/login");
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Sign out error:", error);
      }
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
    if (!isLoading) setShowConfirmation(false);
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        className={className}
        aria-label={iconOnly ? "Log out" : undefined}
        title={iconOnly ? "Log out" : undefined}
      >
        {iconOnly ? (
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 5H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4M14 8l4 4-4 4M8 12h10" />
          </svg>
        ) : (
          "Sign Out"
        )}
      </Button>
      <Dialog
        open={showConfirmation}
        onClose={handleCancel}
        aria-label="Log out?"
        contentClassName="ui-panel w-full max-w-sm p-6"
      >
        <h2 className="text-xl font-semibold">Log out?</h2>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            Stay logged in
          </Button>
          <Button variant="destructive" onClick={handleSignOut} loading={isLoading} loadingText="Signing out...">
            Log out
          </Button>
        </div>
      </Dialog>
    </>
  );
}
