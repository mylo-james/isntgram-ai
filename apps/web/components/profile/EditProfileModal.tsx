"use client";

import React, { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { validateFullName, validateUsername } from "@/lib/validation";
import ErrorNotice from "@/components/ui/ErrorNotice";
import Dialog from "@/components/ui/Dialog";

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
    clearErrors,
    setFocus,
    watch,
  } = useForm<EditProfileInitialValues>({ defaultValues: initialValues, mode: "onBlur" });

  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const focusFieldAfterRecovery = (field: keyof EditProfileInitialValues) => {
    window.setTimeout(() => setFocus(field), 0);
  };

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  if (!open) return null;

  const submitHandler = async (values: EditProfileInitialValues) => {
    clearErrors("root");
    // Client-side validation
    const fullNameValidation = validateFullName(values.fullName);
    if (!fullNameValidation.isValid) {
      setError("fullName", { type: "validate", message: fullNameValidation.message });
      focusFieldAfterRecovery("fullName");
      return;
    }
    const usernameValidation = validateUsername(values.username);
    if (!usernameValidation.isValid) {
      setError("username", { type: "validate", message: usernameValidation.message });
      focusFieldAfterRecovery("username");
      return;
    }

    // Async check username availability if provided
    try {
      if (checkUsername) {
        const available = await Promise.resolve(checkUsername(values.username));
        if (!available) {
          setError("username", { type: "validate", message: "Username already taken" });
          focusFieldAfterRecovery("username");
          return;
        }
      }

      await Promise.resolve(onSubmit?.(values));
    } catch {
      setError("root", {
        type: "submit",
        message: "We couldn't save your profile. Your changes are still here. Please try again.",
      });
      focusFieldAfterRecovery("username");
    }
  };

  const currentUsername = watch("username");

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      aria-labelledby="edit-profile-title"
      data-testid="edit-profile-modal"
      initialFocusRef={closeButtonRef}
      contentClassName="mx-4 w-full max-w-md rounded-xl bg-white"
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <h2 id="edit-profile-title" className="text-lg font-semibold text-gray-900">
          Edit Profile
        </h2>
        <button
          ref={closeButtonRef}
          onClick={onClose}
          aria-label="Close edit profile"
          disabled={isSubmitting}
          className="ui-quiet text-gray-700"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit(submitHandler)} className="px-6 py-4 space-y-4">
        {errors.root?.message ? (
          <ErrorNotice
            key={errors.root.message}
            message={errors.root.message}
            onRetry={() => void handleSubmit(submitHandler)()}
            pending={isSubmitting}
            retryLabel="Try saving again"
          />
        ) : null}
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
            Full Name
          </label>
          <input
            id="fullName"
            autoComplete="name"
            disabled={isSubmitting}
            maxLength={100}
            type="text"
            {...register("fullName", { required: "Full name is required" })}
            aria-invalid={errors.fullName ? true : undefined}
            aria-describedby={errors.fullName?.message ? "edit-profile-full-name-error" : undefined}
            className="ui-field mt-1"
            placeholder="Enter your full name"
          />
          {errors.fullName?.message && (
            <p id="edit-profile-full-name-error" className="mt-1 text-sm text-red-600" role="alert">
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
            autoComplete="username"
            disabled={isSubmitting}
            maxLength={30}
            type="text"
            {...register("username", {
              required: "Username is required",
              minLength: { value: 3, message: "Username must be at least 3 characters" },
            })}
            aria-invalid={errors.username ? true : undefined}
            aria-describedby={
              errors.username?.message ? "edit-username-help edit-profile-username-error" : "edit-username-help"
            }
            className="ui-field mt-1"
            placeholder="Enter your username"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <p id="edit-username-help" className="text-sm text-gray-700">
            3–30 lowercase letters, numbers or underscores. Changing it updates your profile link.
          </p>
          {errors.username?.message && (
            <p id="edit-profile-username-error" className="mt-1 text-sm text-red-600" role="alert">
              {errors.username.message}
            </p>
          )}
          {currentUsername !== initialValues.username ? (
            <p className="mt-1 text-xs text-gray-500">Changing your username will update your profile URL.</p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <button type="button" onClick={onClose} disabled={isSubmitting} className="ui-secondary">
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className="ui-primary">
            {isSubmitting ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
