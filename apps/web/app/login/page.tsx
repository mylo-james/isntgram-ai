"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { validateEmail, validatePassword, ValidationResult } from "@/lib/validation";
import Spinner from "@/components/ui/Spinner";

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
  const demoEnabled = process.env.NEXT_PUBLIC_DEMO_ENABLED === "true";

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
    const nextValue = field === "email" ? value.toLowerCase() : value;
    setFormData((prev) => ({ ...prev, [field]: nextValue }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validateField = (field: keyof LoginFormData, value: string): ValidationResult => {
    switch (field) {
      case "email":
        return validateEmail(value);
      case "password":
        return validatePassword(value);
      /* istanbul ignore next */
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
        email: formData.email.trim().toLowerCase(),
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
    if (!demoEnabled) return;
    setFormError("");
    setSuccessMessage("");
    setDemoLoading(true);
    try {
      // Now sign in via credentials using demo email/password pair
      const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL || "demo@isntgram.ai";
      const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD || "demo";
      const result = await signIn("credentials", {
        email: demoEmail.trim().toLowerCase(),
        password: demoPassword,
        redirect: false,
      });
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
    <div className="relative min-h-screen w-full flex items-center justify-end bg-gray-50 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="relative w-full h-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="w-full h-full object-cover"
            src="https://picsum.photos/seed/isntgram-login/2000/3000"
            alt="Isntgram splash background"
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
            <div className="w-full space-y-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {formError ? <p className="text-sm text-red-600">{formError}</p> : null}

                <div>
                  <label className="sr-only" htmlFor="email">
                    Email
                  </label>
                  <input
                    className="w-full px-3 py-3 border border-gray-300 rounded-md text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                    placeholder="Phone number, username, or email"
                    name="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    onBlur={() => handleBlur("email")}
                    autoCapitalize="none"
                    autoCorrect="off"
                    required
                    type="email"
                  />
                  {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email}</p> : null}
                </div>

                <div>
                  <label className="sr-only" htmlFor="password">
                    Password
                  </label>
                  <input
                    className="w-full px-3 py-3 border border-gray-300 rounded-md text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                    type="password"
                    placeholder="Password"
                    name="password"
                    id="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    onBlur={() => handleBlur("password")}
                    required
                  />
                  {errors.password ? <p className="mt-1 text-xs text-red-600">{errors.password}</p> : null}
                </div>

                {successMessage ? (
                  <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md">{successMessage}</div>
                ) : null}

                <button
                  className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-2 px-4 rounded-md transition-colors duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? "Logging in..." : "Log In"}
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">OR</span>
                  </div>
                </div>

                {demoEnabled ? (
                  <button
                    className="w-full bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold py-2 px-4 rounded-md transition-colors duration-200 text-sm border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleDemoSignIn}
                    type="button"
                    disabled={demoLoading}
                  >
                    {demoLoading ? "Starting demo..." : "Try Our Demo"}
                  </button>
                ) : null}
              </form>

              <div className="text-sm text-center">
                <span className="text-gray-600">Don&apos;t have an account? </span>
                <Link
                  className="text-blue-600 font-semibold hover:text-blue-700 transition-colors duration-200"
                  href="/register"
                >
                  Sign up
                </Link>
              </div>
            </div>
          </div>

          <div className="absolute flex justify-between items-center h-[10vh] w-[90%] bottom-[35px] left-[5%]">
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
                className="w-[70%] h-full rounded-full object-cover hover:opacity-80 transition-opacity duration-200"
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
                className="w-[70%] h-full rounded-full object-cover hover:opacity-80 transition-opacity duration-200"
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
                className="w-[70%] h-full rounded-full object-cover hover:opacity-80 transition-opacity duration-200"
              />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <Spinner label="Loading..." />
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
