import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Terminal, Key } from "@phosphor-icons/react";
import { forgotPassword, resetPassword } from "@/lib/api";
import { AUTH } from "@/constants/testIds";

export default function ForgotPassword() {
  const nav = useNavigate();
  const [step, setStep] = useState("request"); // "request" | "reset"
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const requestOtp = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await forgotPassword(email);
      toast.success("If that email is registered, a code was sent.");
      setStep("reset");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await resetPassword(email, otp, newPassword);
      toast.success("Password reset. Sign in with your new password.");
      nav("/login", { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Invalid or expired code");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid={AUTH.forgotPasswordRoot} className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <Link to="/" className="flex items-center gap-2 mb-8 justify-center">
          <Terminal size={18} weight="bold" className="text-primary" />
          <span className="mono text-sm font-semibold tracking-tight">
            ALPHA<span className="text-brand">SCRIBE</span>
          </span>
        </Link>
        <div className="cell p-6 overflow-hidden">
          <div className="label-mono mb-4">Reset password</div>
          <AnimatePresence mode="wait">
          {step === "request" ? (
            <motion.form
              key="request"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              onSubmit={requestOtp} className="flex flex-col gap-3">
              <div>
                <label className="label-mono block mb-1">Email</label>
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
              <button
                type="submit"
                data-testid={AUTH.requestOtpSubmit}
                disabled={busy}
                className="mt-2 mono text-xs uppercase tracking-widest h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Key size={14} />
                {busy ? "Sending…" : "Send reset code"}
              </button>
            </motion.form>
          ) : (
            <motion.form
              key="reset"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              onSubmit={submitReset} className="flex flex-col gap-3">
              <p className="mono text-[11px] text-muted-foreground">
                Enter the 6-digit code sent to <span className="text-primary">{email}</span> and a new password.
              </p>
              <div>
                <label className="label-mono block mb-1">Code</label>
                <input
                  data-testid={AUTH.otpField}
                  type="text"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  className="w-full input-bg border border-border text-primary text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="label-mono block mb-1">New password</label>
                <input
                  data-testid={AUTH.newPasswordField}
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full input-bg border border-border text-primary text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                type="submit"
                data-testid={AUTH.resetPasswordSubmit}
                disabled={busy}
                className="mt-2 mono text-xs uppercase tracking-widest h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Key size={14} />
                {busy ? "Resetting…" : "Reset password"}
              </button>
            </motion.form>
          )}
          </AnimatePresence>
        </div>
        <p className="mono text-[11px] text-muted-foreground text-center mt-4">
          <Link to="/login" className="text-primary hover:underline">Back to sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
