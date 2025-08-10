"use client";

import React, { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { validateRequired, validateUsername } from "@/lib/validation";

export interface EditProfileInitialValues {
  fullName: string;
  username: string;
}

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
  initialValues: EditProfileInitialValues;
  onSubmit?: (values: EditProfileInitialValues) => Promise<void> | void;
  checkUsername?: (username: string) => Promise<boolean> | boolean; // returns true if available
}

export default function EditProfileModal({
  open,
  onClose,
  initialValues,
  onSubmit,
  checkUsername,
}: EditProfileModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
    watch,
  } = useForm<EditProfileInitialValues>({ defaultValues: initialValues, mode: "onBlur" });

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    const timer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  const submitHandler = async (values: EditProfileInitialValues) => {
    // Client-side validation
    const fullNameValidation = validateRequired(values.fullName, "Full name");
    if (!fullNameValidation.isValid) {
      setError("fullName", { type: "validate", message: fullNameValidation.message });
      return;
    }
    const usernameValidation = validateUsername(values.username);
    if (!usernameValidation.isValid) {
      setError("username", { type: "validate", message: usernameValidation.message });
      return;
    }

    // Async check username availability if provided
    if (checkUsername) {
      const available = await Promise.resolve(checkUsername(values.username));
      if (!available) {
        setError("username", { type: "validate", message: "Username already taken" });
        return;
      }
    }

    await Promise.resolve(onSubmit?.(values));
  };

  const currentUsername = watch("username");

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-profile-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={handleOverlayClick}
      data-testid="edit-profile-modal"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 id="edit-profile-title" className="text-lg font-semibold text-gray-900">
            Edit Profile
          </h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close edit profile"
            className="text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit(submitHandler)} className="px-6 py-4 space-y-4">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              {...register("fullName", { required: "Full name is required" })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Enter your full name"
            />
            {errors.fullName?.message && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {errors.fullName.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              Username
            </label>
            <input
              id="username"
              type="text"
              {...register("username", {
                required: "Username is required",
                minLength: { value: 3, message: "Username must be at least 3 characters" },
              })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Enter your username"
            />
            {errors.username?.message && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {errors.username.message}
              </p>
            )}
            {/* Subtle hint when username changes */}
            {currentUsername !== initialValues.username && (
              <p className="mt-1 text-xs text-gray-500">Changing your username will update your profile URL.</p>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
