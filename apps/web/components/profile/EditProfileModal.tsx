"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { validateFullName, validateUsername } from "@/lib/validation";
import ErrorNotice from "@/components/ui/ErrorNotice";
import Dialog from "@/components/ui/Dialog";
import { apiClient } from "@/lib/api-client";
import { ApiRequestError } from "@/lib/api-error";
import { userError } from "@/lib/user-error";

const DIRECT_UPLOAD_TIMEOUT_MS = 15_000;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

class ProfilePhotoUploadError extends Error {}

function isDefinitivePhotoSaveRejection(error: unknown): boolean {
  return error instanceof ApiRequestError && [400, 404, 409, 413, 415, 422].includes(error.status);
}

function photoSaveRejectionMessage(error: unknown): string | undefined {
  if (!(error instanceof ApiRequestError)) return undefined;
  if ([400, 413, 415, 422].includes(error.status)) {
    return "This photo can’t be used. Choose another photo, then save again.";
  }
  return undefined;
}

function valuesInitials(fullName: string, username: string): string {
  const initials = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  return (initials || username.slice(0, 1) || "U").toUpperCase();
}

export interface EditProfileInitialValues {
  fullName: string;
  username: string;
  profilePictureUrl?: string;
}

export interface EditProfileSubmission extends EditProfileInitialValues {
  profilePictureUploadId?: string;
}

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
  initialValues: EditProfileInitialValues;
  onSubmit?: (values: EditProfileSubmission) => Promise<void> | void;
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
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [profilePictureUploadId, setProfilePictureUploadId] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const focusFieldAfterRecovery = (field: keyof EditProfileInitialValues) => {
    window.setTimeout(() => setFocus(field), 0);
  };

  useEffect(() => {
    reset(initialValues);
    setSelectedPhoto(null);
    setProfilePictureUploadId(null);
    setPhotoError(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }, [initialValues, reset]);

  useEffect(() => {
    if (!selectedPhoto) {
      setPhotoPreviewUrl(null);
      return;
    }
    if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return;
    const url = URL.createObjectURL(selectedPhoto);
    setPhotoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedPhoto]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      uploadAbortRef.current?.abort();
    };
  }, []);

  if (!open) return null;

  const submitHandler = async (values: EditProfileInitialValues) => {
    clearErrors("root");
    let uploadId = profilePictureUploadId ?? undefined;
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

      if (selectedPhoto && !uploadId) {
        const presign = await apiClient.createUploadUrl({
          fileName: selectedPhoto.name,
          contentType: selectedPhoto.type,
          contentLength: selectedPhoto.size,
        });
        if (!mountedRef.current) return;
        if (!presign.uploadId)
          throw new ProfilePhotoUploadError("Photo upload is unavailable. Choose the photo again.");
        const controller = new AbortController();
        uploadAbortRef.current = controller;
        const timeout = window.setTimeout(() => controller.abort(), DIRECT_UPLOAD_TIMEOUT_MS);
        let uploaded: Response;
        try {
          uploaded = await fetch(presign.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": selectedPhoto.type },
            body: selectedPhoto,
            signal: controller.signal,
          });
        } catch (error) {
          if (controller.signal.aborted) throw new ProfilePhotoUploadError("Photo upload timed out. Try saving again.");
          throw error;
        } finally {
          window.clearTimeout(timeout);
          if (uploadAbortRef.current === controller) uploadAbortRef.current = null;
        }
        if (!mountedRef.current) return;
        if (!uploaded.ok) throw new ProfilePhotoUploadError("Photo upload failed. Try saving again.");
        uploadId = presign.uploadId;
        setProfilePictureUploadId(uploadId);
      }
      if (!mountedRef.current) return;
      await Promise.resolve(onSubmit?.(uploadId ? { ...values, profilePictureUploadId: uploadId } : values));
    } catch (error) {
      if (!mountedRef.current) return;
      if (isDefinitivePhotoSaveRejection(error) && selectedPhoto && uploadId) {
        setProfilePictureUploadId(null);
      }
      setError("root", {
        type: "submit",
        message: userError(
          error,
          (selectedPhoto ? photoSaveRejectionMessage(error) : undefined) ??
            (error instanceof ProfilePhotoUploadError && error.message
              ? error.message
              : "We couldn't save your profile. Your changes are still here. Try again."),
        ),
      });
      focusFieldAfterRecovery("username");
    }
  };

  const currentUsername = watch("username");
  const avatarUrl = photoPreviewUrl ?? initialValues.profilePictureUrl;

  const choosePhoto = (file: File | undefined, input: HTMLInputElement) => {
    if (!file) return;
    if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
      setPhotoError("Choose a JPEG, PNG, WebP, or GIF photo.");
      input.value = "";
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setPhotoError("Choose a photo up to 5MB.");
      input.value = "";
      return;
    }
    setPhotoError(null);
    setSelectedPhoto(file);
    setProfilePictureUploadId(null);
  };

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
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-gray-100">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt="Profile photo preview"
                width={64}
                height={64}
                unoptimized
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gray-900 text-lg font-semibold text-white">
                {valuesInitials(initialValues.fullName, initialValues.username)}
              </div>
            )}
          </div>
          <div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              hidden
              data-testid="profile-photo-input"
              disabled={isSubmitting}
              onChange={(event) => {
                choosePhoto(event.target.files?.[0], event.currentTarget);
              }}
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={isSubmitting}
              aria-label="Change profile photo"
              title="Change profile photo"
              className="ui-secondary inline-flex h-11 w-11 items-center justify-center"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 7h3l1.5-2h7L17 7h3v12H4V7Z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            </button>
          </div>
        </div>
        {photoError ? (
          <p className="text-sm text-red-600" role="alert">
            {photoError}
          </p>
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
