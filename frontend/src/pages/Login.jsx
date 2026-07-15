import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeSlash } from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth";
import { AUTH } from "@/constants/testIds";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password, remember);
      // Dashboard is the signed-in home. `from` still wins so a deep link the
      // guard bounced (e.g. /compare) resumes where the user was headed.
      nav(location.state?.from?.pathname || "/dashboard", { replace: true });
    } catch (err) {
      setError(err?.response?.data?.detail || "Invalid email or password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid={AUTH.loginRoot} className="min-h-screen grid-lines flex items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <Link to="/" className="flex items-center gap-2 mb-1 justify-center">
          <span className="mono text-base text-primary">&gt;</span>
          <span className="mono text-sm font-semibold tracking-tight">
            ALPHA<span className="text-brand">SCRIBE</span>
          </span>
        </Link>
        <div className="label-mono text-center !text-[9px] !tracking-[0.28em] mb-8">
          Equity Intel · v0.1
        </div>
        <div className="cell p-7">
          <div className="label-mono mb-5">Sign in</div>
          <form onSubmit={submit} className="flex flex-col gap-3.5">
            <div>
              <label className="label-mono block mb-1.5">Email</label>
              <input
                data-testid={AUTH.emailField}
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full input-bg border border-border text-primary text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="label-mono block mb-1.5">Password</label>
              <div className="relative">
                <input
                  data-testid={AUTH.passwordField}
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full input-bg border text-primary text-sm px-3 py-2 pr-10 focus:outline-none focus:ring-1 ${
                    error ? "border-bearish focus:ring-bearish" : "border-border focus:ring-primary"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-primary"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeSlash size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {error && <p className="mono text-[11px] text-bearish mt-1.5">{error}</p>}
            </div>
            <div className="flex items-center justify-between -mt-1">
              <label className="flex items-center gap-2 mono text-[11px] text-muted-foreground cursor-pointer">
                <input
                  data-testid={AUTH.rememberField}
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Remember me
              </label>
              <Link
                to="/forgot-password"
                data-testid={AUTH.forgotPasswordLink}
                className="mono text-[11px] text-brand hover:text-primary"
              >
                Forgot password?
              </Link>
            </div>
            <button
              type="submit"
              data-testid={AUTH.submitButton}
              disabled={busy}
              className="mt-2 mono text-xs uppercase tracking-widest h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {busy ? "Signing in…" : "Sign in"}
              {!busy && <ArrowRight size={14} />}
            </button>
          </form>
        </div>
        <p className="mono text-[11px] text-muted-foreground text-center mt-5">
          No account? <Link to="/signup" className="text-brand hover:text-primary">Sign up →</Link>
        </p>
      </motion.div>
    </div>
  );
}
