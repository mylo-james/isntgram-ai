"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { validateRequired, validateUsername } from "@/lib/validation";
import Modal from "@/components/ui/Modal";

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
  isDemoUser?: boolean;
}

export default function EditProfileModal({
  open,
  onClose,
  initialValues,
  onSubmit,
  checkUsername,
  isDemoUser = false,
}: EditProfileModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
    watch,
  } = useForm<EditProfileInitialValues>({ defaultValues: initialValues, mode: "onBlur" });

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  if (!open) return null;

  const submitHandler = async (values: EditProfileInitialValues) => {
    if (isDemoUser) return; // read-only

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
    <Modal open={open} onClose={onClose} title="Edit Profile" testId="edit-profile-modal">
      <form onSubmit={handleSubmit(submitHandler)} className="space-y-4">
        {isDemoUser && (
          <div className="rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-700">
            Demo mode: profile editing is disabled.
          </div>
        )}

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
            disabled={isDemoUser}
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
            disabled={isDemoUser}
          />
          {errors.username?.message && (
            <p className="mt-1 text-sm text-red-600" role="alert">
              {errors.username.message}
            </p>
          )}
          {currentUsername !== initialValues.username && (
            <p className="mt-1 text-xs text-gray-500">Changing your username will update your profile URL.</p>
          )}
        </div>

        <div className="flex justify-end space-x-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isDemoUser}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
          >
            {isSubmitting ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
