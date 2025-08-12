"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
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

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const [formData, setFormData] = useState<LoginFormData>({ email: "", password: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [demoLoading, setDemoLoading] = useState(false);

  // Check for success message from registration
  useEffect(() => {
    const message = searchParams.get("message");
    if (message) {
      setSuccessMessage(message);
    }
  }, [searchParams]);

  // Redirect if already authenticated
  useEffect(() => {
    if (status === "authenticated" && session) {
      router.push("/");
    }
  }, [status, session, router]);

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
    setSuccessMessage("");

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        let message = result.error;
        if (message === "CredentialsSignin") {
          message = "Invalid credentials";
        } else if (message === "Configuration") {
          message = "Authentication configuration error";
        }
        setFormError(message);
      } else if (result?.ok) {
        setSuccessMessage("Login successful! Redirecting...");
        setFormData({ email: "", password: "" });
        // Redirect to main feed after successful login
        setTimeout(() => {
          router.push("/");
        }, 1000);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Login failed. Please try again.";
      setFormError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoSignIn = async () => {
    setFormError("");
    setSuccessMessage("");
    setDemoLoading(true);
    try {
      // Hit backend to ensure demo user exists and return user; NextAuth will not use this response directly,
      // but this guarantees the account is present and DB is warmed.
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const res = await fetch(`${apiBase}/api/auth/demo`, { method: "POST" });
      if (!res.ok) {
        throw new Error("Demo sign-in failed");
      }
      // Now sign in via credentials using demo email/password pair
      const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL || "demo@isntgram.ai";
      const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD || "changeme";
      const result = await signIn("credentials", { email: demoEmail, password: demoPassword, redirect: false });
      if (result?.error) {
        setFormError("Demo sign-in failed");
      } else if (result?.ok) {
        router.push("/");
      }
    } catch {
      setFormError("Demo sign-in failed");
    } finally {
      setDemoLoading(false);
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

          <div className="mt-4">
            <Button
              type="button"
              loading={demoLoading}
              loadingText="Starting demo..."
              className="w-full bg-gray-100 text-gray-800 hover:bg-gray-200"
              onClick={handleDemoSignIn}
            >
              Try our demo
            </Button>
          </div>

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

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Loading...</div>}>
      <LoginInner />
    </Suspense>
  );
}
