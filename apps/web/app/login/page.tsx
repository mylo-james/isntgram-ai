"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { validateEmail, validatePassword, ValidationResult } from "@/lib/validation";
import AuthShell from "@/components/auth/AuthShell";

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
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
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
    <AuthShell>
      <div className="mt-[15%] flex h-[50vh] w-full flex-col items-center justify-evenly">
        <form onSubmit={handleSubmit} className="flex h-[70%] w-full flex-col items-center justify-between">
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
          {formError ? (
            <div className="w-[80%] rounded-[5px] border border-red-200 bg-red-50 p-3 text-left text-sm text-red-700">
              {formError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="h-[30px] w-[80%] rounded-[5px] bg-[#0095f6] text-[0.9rem] font-bold text-white disabled:opacity-60"
          >
            {isLoading ? "Logging in..." : "Log In"}
          </button>

          <button
            type="button"
            onClick={handleDemoSignIn}
            disabled={demoLoading}
            className="h-[30px] w-[80%] rounded-[5px] bg-gray-100 text-[0.9rem] font-bold text-gray-800 disabled:opacity-60"
          >
            {demoLoading ? "Starting demo..." : "Try our demo"}
          </button>

          <div className="w-[80%] text-center text-[0.9rem] text-[#262626]">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-bold text-[#0095f6] hover:underline">
              Sign up
            </Link>
          </div>
        </form>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Loading...</div>}>
      <LoginInner />
    </Suspense>
  );
}
