"use client";

import React, { useState } from "react";
import Link from "next/link";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Form from "@/components/ui/Form";
import { validateEmail, validatePassword, ValidationResult } from "@/lib/validation";

interface LoginFormData {
  email: string;
  password: string;
}

interface FormErrors {
  email?: string;
  password?: string;
}

export default function LoginPage() {
  const [formData, setFormData] = useState<LoginFormData>({ email: "", password: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [formError, setFormError] = useState("");

  const handleInputChange = (field: keyof LoginFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validateField = (field: keyof LoginFormData, value: string): ValidationResult => {
    switch (field) {
      case "email":
        return validateEmail(value);
      case "password":
        return validatePassword(value);
      default:
        return { isValid: true };
    }
  };

  const handleBlur = (field: keyof LoginFormData) => {
    const value = formData[field];
    const result = validateField(field, value);
    if (!result.isValid) setErrors((prev) => ({ ...prev, [field]: result.message }));
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    (Object.keys(formData) as Array<keyof LoginFormData>).forEach((key) => {
      const result = validateField(key, formData[key]);
      if (!result.isValid) newErrors[key] = result.message;
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError("");

    if (!validateForm()) return;

    setIsLoading(true);
    setSuccessMessage("");
    try {
      await new Promise((r) => setTimeout(r, 1000));
      setSuccessMessage("Login successful!");
      setFormData({ email: "", password: "" });
    } catch {
      setFormError("Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Isntgram</h1>
          <p className="mt-2 text-sm text-gray-600">Welcome back</p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <Form onSubmit={handleSubmit} errorMessage={formError}>
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
              id="password"
              name="password"
              type="password"
              label="Password"
              value={formData.password}
              onChange={(e) => handleInputChange("password", e.target.value)}
              onBlur={() => handleBlur("password")}
              error={errors.password}
              placeholder="Enter your password"
              required
            />

            {successMessage && (
              <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md">{successMessage}</div>
            )}

            <Button type="submit" loading={isLoading} loadingText="Logging in..." className="w-full">
              Log In
            </Button>
          </Form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
