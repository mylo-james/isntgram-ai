"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { apiClient } from "@/lib/api-client";
import {
  validateEmail,
  validatePassword,
  validateRequired,
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
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-gray-900">Isntgram</h1>
          <p className="mt-2 text-sm text-gray-600">Share your moments with the world</p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm border border-gray-200 sm:rounded-xl sm:px-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              id="email"
              name="email"
              type="email"
              label="Email"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              onBlur={() => handleBlur("email")}
              error={errors.email}
              placeholder="Enter your email"
              required
            />

            <Input
              id="fullName"
              name="fullName"
              type="text"
              label="Full Name"
              value={formData.fullName}
              onChange={(e) => handleInputChange("fullName", e.target.value)}
              onBlur={() => handleBlur("fullName")}
              error={errors.fullName}
              placeholder="Enter your full name"
              required
            />

            <Input
              id="username"
              name="username"
              type="text"
              label="Username"
              value={formData.username}
              onChange={(e) => handleInputChange("username", e.target.value)}
              onBlur={() => handleBlur("username")}
              error={errors.username}
              placeholder="Choose a username"
              required
            />

            <Input
              id="password"
              name="password"
              type="password"
              label="Password"
              value={formData.password}
              onChange={(e) => handleInputChange("password", e.target.value)}
              onBlur={() => handleBlur("password")}
              error={errors.password}
              placeholder="Create a password"
              required
            />

            {successMessage && (
              <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md border border-green-200">
                {successMessage}
              </div>
            )}

            <Button type="submit" loading={isLoading} loadingText="Signing up..." className="w-full">
              Sign Up
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
