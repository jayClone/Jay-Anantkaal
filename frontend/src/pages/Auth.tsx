import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type AuthPageProps = {
  mode: "login" | "signup";
};

type FormState = {
  identifier: string;
  username: string;
  name: string;
  email: string;
  password: string;
};

const initialState: FormState = {
  identifier: "",
  username: "",
  name: "",
  email: "",
  password: "",
};

const deployedBackendHealthUrl = "https://jay-anantkaal.onrender.com/health";

const extractErrorMessage = (error: unknown) => {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return "Something went wrong. Please try again.";
};

export default function AuthPage({ mode }: AuthPageProps) {
  const navigate = useNavigate();
  const { login, register, googleLogin, isAuthenticated, isLoading } = useAuth();
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  const isLogin = mode === "login";
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const heading = useMemo(
    () =>
      isLogin
        ? {
            title: "Welcome back to TaskFlow",
            subtitle: "Pick up where you left off and keep your work moving.",
            submit: "Sign In",
          }
        : {
            title: "Build a sharper workflow",
            subtitle: "Create your account and turn every task into visible progress.",
            submit: "Create Account",
          },
    [isLogin],
  );

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return;
    }

    const controller = new AbortController();

    void fetch(deployedBackendHealthUrl, {
      method: "GET",
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
    }).catch(() => {
      // Warm-up should stay silent because auth still works even if the wake-up request fails.
    });

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) {
      return;
    }

    let cancelled = false;

    const loadGoogleScript = async () => {
      const scriptSelector = 'script[src="https://accounts.google.com/gsi/client"]';
      let script = document.querySelector<HTMLScriptElement>(scriptSelector);

      if (!script) {
        script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }

      if (!window.google?.accounts?.id) {
        await new Promise<void>((resolve, reject) => {
          const handleLoad = () => {
            cleanup();
            resolve();
          };

          const handleError = () => {
            cleanup();
            reject(new Error("Failed to load Google Identity Services"));
          };

          const cleanup = () => {
            script?.removeEventListener("load", handleLoad);
            script?.removeEventListener("error", handleError);
          };

          script?.addEventListener("load", handleLoad);
          script?.addEventListener("error", handleError);
        });
      }

      if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) {
        return;
      }

      googleButtonRef.current.innerHTML = "";

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          if (!response.credential) {
            setErrorMessage("Google sign-in did not return a valid token.");
            return;
          }

          try {
            setSubmitting(true);
            setErrorMessage("");
            await googleLogin(response.credential);
            navigate("/");
          } catch (error) {
            setErrorMessage(extractErrorMessage(error));
          } finally {
            setSubmitting(false);
          }
        },
      });

      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        width: googleButtonRef.current.offsetWidth || 320,
        text: isLogin ? "signin_with" : "signup_with",
      });
    };

    void loadGoogleScript().catch(() => {
      if (!cancelled) {
        setErrorMessage("Google sign-in could not be loaded right now.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [googleClientId, googleLogin, isLogin, navigate]);

  const updateField =
    (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
    };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    try {
      if (isLogin) {
        await login({
          identifier: form.identifier.trim(),
          password: form.password,
        });
      } else {
        await register({
          username: form.username.trim(),
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        });
      }

      navigate("/");
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface px-6 py-10 text-on-surface">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(53,37,205,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(107,56,212,0.2),transparent_30%),linear-gradient(160deg,#f8f9fa_0%,#eef2ff_52%,#f8f9fa_100%)]" />
      <div className="absolute left-[-10rem] top-[-8rem] h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute bottom-[-12rem] right-[-8rem] h-96 w-96 rounded-full bg-secondary/10 blur-3xl" />

      <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-8">

          <div className="max-w-2xl space-y-5">
            <h1 className="font-headline text-5xl font-extrabold tracking-tight text-primary md:text-6xl">
              {heading.title}
            </h1>
            <p className="max-w-xl text-lg leading-8 text-on-surface-variant">
              {heading.subtitle}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <FeatureCard
              title="Live task control"
              description="Create, update, filter, and close work without bouncing across screens."
            />
            <FeatureCard
              title="Secure access"
              description="JWT auth and protected routes keep every workspace scoped to its owner."
            />
            <FeatureCard
              title="AI-ready system"
              description="Task guidance can layer in when you want it, without blocking the main flow."
            />
          </div>
        </section>

        <section className="glass-panel relative rounded-[2rem] p-8 shadow-2xl shadow-primary/10">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-on-surface-variant/60">
                TaskFlow
              </p>
              <h2 className="mt-2 font-headline text-3xl font-extrabold tracking-tight text-on-surface">
                {isLogin ? "Log in" : "Create your account"}
              </h2>
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-primary to-secondary p-3 text-white shadow-lg shadow-primary/20">
              <SparkIcon />
            </div>
          </div>

          <div className="mb-8 grid grid-cols-2 gap-2 rounded-full bg-surface-container-low p-1">
            <Link
              to="/login"
              className={`rounded-full px-4 py-3 text-center text-xs font-bold uppercase tracking-[0.22em] transition ${
                isLogin
                  ? "bg-white text-primary shadow-sm"
                  : "text-on-surface-variant/70 hover:text-primary"
              }`}
            >
              Login
            </Link>
            <Link
              to="/signup"
              className={`rounded-full px-4 py-3 text-center text-xs font-bold uppercase tracking-[0.22em] transition ${
                !isLogin
                  ? "bg-white text-primary shadow-sm"
                  : "text-on-surface-variant/70 hover:text-primary"
              }`}
            >
              Signup
            </Link>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {isLogin ? (
              <Field
                label="Username or Email"
                placeholder="jaytest or jaytest@example.com"
                value={form.identifier}
                onChange={updateField("identifier")}
              />
            ) : (
              <>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="Full Name"
                    placeholder="Jay Pandav"
                    value={form.name}
                    onChange={updateField("name")}
                  />
                  <Field
                    label="Username"
                    placeholder="jaypandav"
                    value={form.username}
                    onChange={updateField("username")}
                  />
                </div>
                <Field
                  label="Email"
                  type="email"
                  placeholder="jay@example.com"
                  value={form.email}
                  onChange={updateField("email")}
                />
              </>
            )}

            <Field
              label="Password"
              type="password"
              placeholder="Enter a strong password"
              value={form.password}
              onChange={updateField("password")}
            />

            {errorMessage ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-gradient-to-r from-primary to-secondary px-5 py-4 text-sm font-bold uppercase tracking-[0.22em] text-white shadow-xl shadow-primary/20 transition hover:shadow-primary/30 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? "Please wait..." : heading.submit}
            </button>
          </form>

          <div className="mt-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/55">
                or continue with
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {googleClientId ? (
              <div
                ref={googleButtonRef}
                className="flex min-h-11 items-center justify-center rounded-full"
              />
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Add <code>VITE_GOOGLE_CLIENT_ID</code> to the frontend env to enable Google OAuth.
              </div>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-on-surface-variant">
            {isLogin ? "Need an account?" : "Already have an account?"}{" "}
            <Link className="font-semibold text-primary hover:underline" to={isLogin ? "/signup" : "/login"}>
              {isLogin ? "Sign up" : "Log in"}
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="glass-panel rounded-[1.5rem] p-5">
      <div className="mb-4 inline-flex rounded-2xl bg-primary/10 p-3 text-primary">
        <SparkIcon />
      </div>
      <h3 className="font-headline text-xl font-extrabold tracking-tight text-on-surface">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-on-surface-variant">{description}</p>
    </div>
  );
}

function Field({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
}: {
  label: string;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="ml-1 text-xs font-bold uppercase tracking-[0.22em] text-on-surface-variant/70">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-white/60 bg-white/80 px-4 py-4 text-sm text-on-surface outline-none transition placeholder:text-on-surface-variant/35 focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
      />
    </label>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M12 2.5L13.9 8.1L19.5 10L13.9 11.9L12 17.5L10.1 11.9L4.5 10L10.1 8.1L12 2.5Z"
        fill="currentColor"
      />
      <path d="M18.5 16L19.4 18.6L22 19.5L19.4 20.4L18.5 23L17.6 20.4L15 19.5L17.6 18.6L18.5 16Z" fill="currentColor" />
    </svg>
  );
}
