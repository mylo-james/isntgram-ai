"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { validateEmail, validatePassword, ValidationResult } from "@/lib/validation";
import Spinner from "@/components/ui/Spinner";
import Brand from "@/components/ui/Brand";

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
  const reauthenticate = searchParams.get("reauth") === "1";
  const demoEnabled = process.env.NEXT_PUBLIC_DEMO_ENABLED === "true";

  const [formData, setFormData] = useState<LoginFormData>({ email: "", password: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [demoLoading, setDemoLoading] = useState(false);
  const [isClientReady, setIsClientReady] = useState(false);
  const mountedRef = useRef(false);
  const redirectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    setIsClientReady(true);
    return () => {
      mountedRef.current = false;
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, []);

  const navigateToFeed = (delayMs = 0) => {
    if (!mountedRef.current) return;
    if (redirectTimerRef.current !== null) {
      window.clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
    if (delayMs === 0) {
      router.push("/");
      return;
    }
    redirectTimerRef.current = window.setTimeout(() => {
      redirectTimerRef.current = null;
      if (mountedRef.current) router.push("/");
    }, delayMs);
  };

  // Check for success message from registration
  useEffect(() => {
    const message = searchParams.get("message");
    if (message) {
      setSuccessMessage(message);
    }
  }, [searchParams]);

  // Redirect if already authenticated
  useEffect(() => {
    if (status === "authenticated" && session && !reauthenticate) {
      router.push("/");
    }
  }, [status, session, router, reauthenticate]);

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
    if (!isClientReady || isLoading || demoLoading) return;
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
      if (!mountedRef.current) return;

      if (result?.error) {
        let message = "Log in couldn’t complete. Your details are still here. Try again.";
        if (result.error === "CredentialsSignin" || result.error === "Invalid credentials") {
          message = "The email or password doesn’t match. Check both fields and try again.";
        } else if (result.error === "Configuration") {
          message = "Log in is temporarily unavailable. Your details are still here. Try again shortly.";
        }
        setFormError(message);
      } else if (result?.ok) {
        setSuccessMessage("Login successful! Redirecting...");
        setFormData({ email: "", password: "" });
        navigateToFeed(1000);
      } else {
        setFormError("We couldn't complete sign in. Please try again.");
      }
    } catch {
      if (!mountedRef.current) return;
      const message = "Log in couldn’t connect. Check your connection and try again. Your details are still here.";
      setFormError(message);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  };

  const handleDemoSignIn = async () => {
    if (!isClientReady || isLoading || demoLoading || !demoEnabled) return;
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
      if (!mountedRef.current) return;
      if (result?.error) {
        setFormError("Demo sign-in failed");
      } else if (result?.ok) {
        navigateToFeed();
      } else {
        setFormError("We couldn't complete sign in. Please try again.");
      }
    } catch {
      if (!mountedRef.current) return;
      setFormError("Demo sign-in failed");
    } finally {
      if (mountedRef.current) setDemoLoading(false);
    }
  };

  const controlsDisabled = !isClientReady || isLoading || demoLoading;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      aria-label="Log in"
      className="relative min-h-screen w-full flex items-center justify-end bg-gray-50 overflow-hidden"
    >
      <div className="absolute inset-0 z-0">
        <div className="relative w-full h-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="w-full h-full object-cover"
            src="https://picsum.photos/seed/isntgram-login/2000/3000"
            alt=""
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20" />
        </div>
      </div>

      <div className="relative z-10 min-h-screen w-full max-w-md bg-white/95">
        <div className="flex flex-col items-center justify-center min-h-screen px-8 py-12">
          <div className="mb-8">
            <Brand className="auth-brand" />
          </div>

          <div className="w-full max-w-sm">
            <h1 className="page-heading mb-6">Log in</h1>
            {reauthenticate ? (
              <p className="mb-4 text-sm text-gray-700">
                Log in again to continue. Your draft in the other tab will stay there.
              </p>
            ) : null}
            <div className="w-full space-y-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isClientReady ? (
                  <p className="sr-only" role="status">
                    Preparing login…
                  </p>
                ) : null}
                {formError ? <ErrorNotice key={formError} message={formError} /> : null}

                <div>
                  <label className="mb-2 block text-sm font-medium" htmlFor="email">
                    Email
                  </label>
                  <input
                    className="ui-field"
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
                    aria-describedby={errors.email ? "login-email-error" : undefined}
                    disabled={controlsDisabled}
                  />
                  {errors.email ? (
                    <p id="login-email-error" className="mt-1 text-xs text-red-600" role="alert">
                      {errors.email}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium" htmlFor="password">
                    Password
                  </label>
                  <input
                    className="ui-field"
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    name="password"
                    autoComplete="current-password"
                    id="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    onBlur={() => handleBlur("password")}
                    required
                    aria-invalid={errors.password ? true : undefined}
                    aria-describedby={errors.password ? "login-password-error" : undefined}
                    disabled={controlsDisabled}
                  />
                  <button
                    type="button"
                    className="ui-quiet mt-1"
                    aria-controls="password"
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? "Hide password" : "Show password"}
                  </button>
                  {errors.password ? (
                    <p id="login-password-error" className="mt-1 text-xs text-red-600" role="alert">
                      {errors.password}
                    </p>
                  ) : null}
                </div>

                {successMessage ? (
                  <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md" role="status">
                    {successMessage}
                  </div>
                ) : null}

                <button className="ui-primary w-full" type="submit" disabled={controlsDisabled}>
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
                    className="ui-secondary w-full"
                    onClick={handleDemoSignIn}
                    data-portfolio-demo-sign-in
                    type="button"
                    disabled={controlsDisabled}
                  >
                    {demoLoading ? "Starting demo..." : "Try Our Demo"}
                  </button>
                ) : null}
              </form>

              {process.env.NEXT_PUBLIC_DEPLOYMENT_DEMO === "true" ? (
                <p className="text-sm text-center text-gray-600">
                  This public demo lasts 48 hours. Your uploads are temporary;
                  private recovery copies can remain for up to 7 days.
                </p>
              ) : <div className="text-sm text-center">
                <span className="text-gray-600">Don&apos;t have an account? </span>
                <Link className="ui-quiet font-semibold" href="/register">
                  Sign up
                </Link>
              </div>}
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
