"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import {
  validateEmail,
  validatePassword,
  validateRequired,
  validateUsername,
  ValidationResult,
} from "@/lib/validation";
import AuthShell from "@/components/auth/AuthShell";

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

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

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
        return validateRequired(value, "Full name");
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

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setSuccessMessage("");
    setErrors({});

    try {
      // Call the registration API
      await apiClient.register({
        email: formData.email,
        username: formData.username,
        fullName: formData.fullName,
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
      // Handle different types of errors
      if (
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        (error as { response?: { data?: { message?: string } } }).response?.data?.message
      ) {
        // Backend validation error
        const errorMessage = (error as { response?: { data?: { message?: string } } }).response?.data
          ?.message as string;
        if (errorMessage.includes("email")) {
          setErrors({ email: errorMessage });
        } else if (errorMessage.includes("username")) {
          setErrors({ username: errorMessage });
        } else {
          setErrors({ email: errorMessage });
        }
      } else if (error instanceof Error && error.message) {
        // Network or other error
        setErrors({ email: error.message });
      } else {
        setErrors({ email: "Registration failed. Please try again." });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="mt-[12%] flex w-full flex-col items-center justify-center">
        <form onSubmit={handleSubmit} className="flex w-full flex-col items-center gap-4">
          <div className="w-[80%] text-center text-[0.9rem]">
            <label className="sr-only" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              value={formData.username}
              onChange={(e) => handleInputChange("username", e.target.value)}
              onBlur={() => handleBlur("username")}
              placeholder="Username"
              required
              className="h-8 w-full rounded-[5px] border border-[#dfdfdf] px-[5px] text-left text-[0.9rem] text-[#262626] outline-none"
            />
            {errors.username ? <div className="mt-1 text-left text-xs text-red-700">{errors.username}</div> : null}
          </div>

          <div className="w-[80%] text-center text-[0.9rem]">
            <label className="sr-only" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              onBlur={() => handleBlur("email")}
              placeholder="Email"
              required
              className="h-8 w-full rounded-[5px] border border-[#dfdfdf] px-[5px] text-left text-[0.9rem] text-[#262626] outline-none"
            />
            {errors.email ? <div className="mt-1 text-left text-xs text-red-700">{errors.email}</div> : null}
          </div>

          <div className="w-[80%] text-center text-[0.9rem]">
            <label className="sr-only" htmlFor="fullName">
              Full name
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              value={formData.fullName}
              onChange={(e) => handleInputChange("fullName", e.target.value)}
              onBlur={() => handleBlur("fullName")}
              placeholder="Full Name"
              required
              className="h-8 w-full rounded-[5px] border border-[#dfdfdf] px-[5px] text-left text-[0.9rem] text-[#262626] outline-none"
            />
            {errors.fullName ? <div className="mt-1 text-left text-xs text-red-700">{errors.fullName}</div> : null}
          </div>

          <div className="w-[80%] text-center text-[0.9rem]">
            <label className="sr-only" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={(e) => handleInputChange("password", e.target.value)}
              onBlur={() => handleBlur("password")}
              placeholder="Password"
              required
              className="h-8 w-full rounded-[5px] border border-[#dfdfdf] px-[5px] text-left text-[0.9rem] text-[#262626] outline-none"
            />
            {errors.password ? <div className="mt-1 text-left text-xs text-red-700">{errors.password}</div> : null}
          </div>

          {successMessage ? (
            <div className="w-[80%] rounded-[5px] border border-green-200 bg-green-50 p-3 text-left text-sm text-green-700">
              {successMessage}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="h-[30px] w-[80%] rounded-[5px] bg-[#0095f6] text-[0.9rem] font-bold text-white disabled:opacity-60"
          >
            {isLoading ? "Signing up..." : "Register"}
          </button>

          <div className="w-[80%] text-center text-[0.9rem] text-[#262626]">
            Have an account?{" "}
            <Link href="/login" className="font-bold text-[#0095f6] hover:underline">
              Log in
            </Link>
          </div>
        </form>
      </div>
    </AuthShell>
  );
}
