"use client";

import React, { useState } from "react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import {
  validateEmail,
  validateFullName,
  validatePassword,
  validateUsername,
  ValidationResult,
} from "@/lib/validation";

interface FormData {
  email: string;
  fullName: string;
  username: string;
  password: string;
}

interface FormErrors {
  email?: string;
  fullName?: string;
  username?: string;
  password?: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    email: "",
    fullName: "",
    username: "",
    password: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");

  const handleInputChange = (field: keyof FormData, value: string) => {
    const nextValue = field === "email" || field === "username" ? value.toLowerCase() : value;
    setFormData((prev) => ({ ...prev, [field]: nextValue }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleBlur = (field: keyof FormData) => {
    const value = formData[field];
    const validation = validateField(field, value);

    if (!validation.isValid) {
      setErrors((prev) => ({ ...prev, [field]: validation.message }));
    }
  };

  const validateField = (field: keyof FormData, value: string): ValidationResult => {
    switch (field) {
      case "email":
        return validateEmail(value);
      case "password":
        return validatePassword(value);
      case "username":
        return validateUsername(value);
      case "fullName":
        return validateFullName(value);
      default:
        return { isValid: true };
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    let isValid = true;

    Object.keys(formData).forEach((field) => {
      const key = field as keyof FormData;
      const validation = validateField(key, formData[key]);

      if (!validation.isValid) {
        newErrors[key] = validation.message;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (isLoading) return;
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setSuccessMessage("");
    setErrors({});

    try {
      // Call the registration API
      await apiClient.register({
        email: formData.email.trim().toLowerCase(),
        username: formData.username.trim().toLowerCase(),
        fullName: formData.fullName.trim(),
        password: formData.password,
      });

      setSuccessMessage("Registration successful! Redirecting to login...");

      // Reset form after successful submission
      setFormData({
        email: "",
        fullName: "",
        username: "",
        password: "",
      });

      // Redirect to login page after a short delay
      setTimeout(() => {
        router.push("/login?message=Registration successful! Please log in.");
      }, 2000);
    } catch (error: unknown) {
      const rawMessage = error instanceof Error ? error.message.toLowerCase() : "";
      const message = rawMessage.includes("username")
        ? "That username is unavailable. Choose another username."
        : rawMessage.includes("email")
          ? "That email cannot be used. Try another email or log in to your existing account."
          : "Your account couldn’t be created. Your details are still here. Try again.";
      if (message.toLowerCase().includes("username")) {
        setErrors({ username: message });
      } else if (message.toLowerCase().includes("email")) {
        setErrors({ email: message });
      } else {
        setFormError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main
      id="main-content"
      tabIndex={-1}
      aria-label="Create an account"
      className="relative min-h-screen w-full flex items-center justify-end bg-gray-50 overflow-hidden"
    >
      <div className="absolute inset-0 z-0">
        <div className="relative w-full h-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="w-full h-full object-cover"
            src="https://picsum.photos/seed/isntgram-signup/2000/3000"
            alt=""
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20" />
        </div>
      </div>

      <div className="relative min-h-screen w-full max-w-md bg-white border border-gray-200 shadow-xl z-10">
        <div className="flex flex-col items-center justify-center min-h-screen px-8 py-12">
          <div className="mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="w-48 h-auto object-contain" src="/assets/logo.svg" alt="Isntgram logo" />
          </div>

          <div className="w-full max-w-sm">
            <h1 className="page-heading mb-6">Create an account</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError ? <ErrorNotice key={formError} message={formError} /> : null}

              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="email">
                  Email
                </label>
                <input
                  className="w-full px-3 py-3 border border-gray-300 rounded-md text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                  placeholder="Email"
                  name="email"
                  autoComplete="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  onBlur={() => handleBlur("email")}
                  autoCapitalize="none"
                  autoCorrect="off"
                  required
                  type="email"
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={errors.email ? "register-email-error" : undefined}
                />
                {errors.email ? (
                  <p id="register-email-error" className="mt-1 text-xs text-red-600" role="alert">
                    {errors.email}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="fullName">
                  Full Name
                </label>
                <input
                  className="w-full px-3 py-3 border border-gray-300 rounded-md text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                  placeholder="Full Name"
                  name="fullName"
                  autoComplete="name"
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange("fullName", e.target.value)}
                  onBlur={() => handleBlur("fullName")}
                  required
                  type="text"
                  aria-invalid={errors.fullName ? true : undefined}
                  aria-describedby={errors.fullName ? "register-full-name-error" : undefined}
                />
                {errors.fullName ? (
                  <p id="register-full-name-error" className="mt-1 text-xs text-red-600" role="alert">
                    {errors.fullName}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="username">
                  Username
                </label>
                <input
                  className="w-full px-3 py-3 border border-gray-300 rounded-md text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                  placeholder="Username"
                  name="username"
                  autoComplete="username"
                  id="username"
                  value={formData.username}
                  onChange={(e) => handleInputChange("username", e.target.value)}
                  onBlur={() => handleBlur("username")}
                  autoCapitalize="none"
                  autoCorrect="off"
                  required
                  type="text"
                  aria-invalid={errors.username ? true : undefined}
                  aria-describedby={errors.username ? "username-help register-username-error" : "username-help"}
                />
                <p id="username-help" className="mt-2 text-sm text-gray-700">
                  3–30 lowercase letters, numbers or underscores.
                </p>
                {errors.username ? (
                  <p id="register-username-error" className="mt-1 text-xs text-red-600" role="alert">
                    {errors.username}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="password">
                  Password
                </label>
                <input
                  className="w-full px-3 py-3 border border-gray-300 rounded-md text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                  placeholder="Password"
                  name="password"
                  autoComplete="new-password"
                  id="password"
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  onBlur={() => handleBlur("password")}
                  required
                  type={showPassword ? "text" : "password"}
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={errors.password ? "password-help register-password-error" : "password-help"}
                />
                <p id="password-help" className="mt-2 text-sm text-gray-700">
                  Use 8–128 characters, with an uppercase letter, a lowercase letter and a number.
                </p>
                <button
                  type="button"
                  className="ui-action mt-1 text-blue-700 underline"
                  aria-controls="password"
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? "Hide password" : "Show password"}
                </button>
                {errors.password ? (
                  <p id="register-password-error" className="mt-1 text-xs text-red-600" role="alert">
                    {errors.password}
                  </p>
                ) : null}
              </div>

              {successMessage ? (
                <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md" role="status">
                  {successMessage}
                </div>
              ) : null}

              <button
                className="min-h-11 w-full bg-blue-700 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-2 px-4 rounded-md transition-colors duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? "Signing up..." : "Sign Up"}
              </button>
            </form>

            <div className="mt-6 text-sm text-center">
              <span className="text-gray-600">Have an account? </span>
              <Link
                className="text-blue-600 font-semibold hover:text-blue-700 transition-colors duration-200"
                href="/login"
              >
                Log in
              </Link>
            </div>
          </div>

          <div className="mt-10 flex w-full max-w-sm items-center justify-around gap-4">
            <a
              href="https://github.com/jamesurobertson/"
              className="flex justify-center w-[30%]"
              target="_blank"
              rel="noopener noreferrer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/profile.jpeg"
                alt="James Robertson"
                className="h-12 w-12 rounded-full object-cover hover:opacity-80 transition-opacity duration-200"
              />
            </a>
            <a
              href="https://github.com/ajpierskalla3/"
              className="flex justify-center w-[30%]"
              target="_blank"
              rel="noopener noreferrer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/aaron-profile.jpeg"
                alt="Aaron Pierskalla"
                className="h-12 w-12 rounded-full object-cover hover:opacity-80 transition-opacity duration-200"
              />
            </a>
            <a
              href="https://github.com/mylo-james/"
              className="flex justify-center w-[30%]"
              target="_blank"
              rel="noopener noreferrer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/mylo-profile.jpg"
                alt="Mylo James"
                className="h-12 w-12 rounded-full object-cover hover:opacity-80 transition-opacity duration-200"
              />
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
