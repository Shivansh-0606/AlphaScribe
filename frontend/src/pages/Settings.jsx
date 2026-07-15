import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Gear, ShieldWarning, SignOut, UserCircle, Key, Lock, Devices,
} from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth";
import { useLlm } from "@/lib/llmSettings";
import { changePassword } from "@/lib/api";
import { SETTINGS } from "@/constants/testIds";

// Secondary button: a subtle filled surface + a border that actually reads
// against the panel (a plain hairline border can vanish on the warm cell) +
// strong ink text, so these look like buttons, not dim labels.
const SECONDARY_BTN =
  "mono text-[11px] uppercase tracking-widest px-3 h-9 inline-flex items-center gap-2 " +
  "bg-surface-hover border border-muted-foreground/40 text-primary " +
  "hover:border-primary hover:bg-secondary disabled:opacity-40";

/**
 * Account & settings. Structure follows the Claude Design account mockup:
 * label→value rows for the profile, understated bordered controls for actions,
 * and a bearish-outlined danger zone gated on typing your own email.
 */
export default function Settings() {
  const { user, logout, logoutEverywhere, deleteAccount } = useAuth();
  const { cfg: llmCfg, openSettings } = useLlm();
  const nav = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [delBusy, setDelBusy] = useState(false);

  if (!user) return null;

  const submitPassword = async (e) => {
    e.preventDefault();
    setPwBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success("Password changed. Other devices were signed out.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Password change failed");
    } finally {
      setPwBusy(false);
    }
  };

  const onSignOut = async () => {
    // Navigate off the RequireAuth-protected route BEFORE clearing the user.
    // Otherwise setUser(null) inside logout() makes RequireAuth's own
    // <Navigate to="/login"> fire while we're still on /settings, racing
    // this nav("/") call — and /login sometimes wins.
    nav("/", { replace: true });
    await logout();
    toast.success("Signed out");
  };

  const onLogoutEverywhere = async () => {
    await logoutEverywhere();
    toast.success("Signed out everywhere");
    nav("/login");
  };

  const onDelete = async () => {
    if (confirmEmail.trim().toLowerCase() !== user.email) return;
    setDelBusy(true);
    try {
      await deleteAccount(confirmEmail.trim());
      toast.success("Account deleted");
      nav("/");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Delete failed");
      setDelBusy(false);
    }
  };

  return (
    <div data-testid={SETTINGS.root} className="min-h-screen flex flex-col">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="h-14 px-6 flex items-center gap-3">
          <Gear size={16} className="text-primary" />
          <span className="mono text-[10px] text-muted-foreground uppercase tracking-widest">
            /settings
          </span>
          <span className="mono text-xs text-brand">account &amp; preferences</span>
          <span className="mono text-[11px] text-muted-foreground ml-auto truncate">
            {user.email}
          </span>
        </div>
      </div>

      <div className="flex-1 p-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="flex flex-col gap-px bg-border"
        >
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-px bg-border">
            <section className="cell p-5">
              <Head icon={UserCircle} title="Profile" />
              <div className="flex flex-col gap-2 mono text-xs mt-3">
                <Row label="Email" value={user.email} />
                <Row label="Member since" value={new Date(user.created_at).toLocaleDateString()} />
                <Row label="Credits" value={`${user.credits} · free / BYO-key`} muted />
              </div>
            </section>

            <section className="cell p-5">
              <Head icon={Key} title="LLM provider & key" />
              <div className="mt-3 flex items-center justify-between gap-4">
                <p className="mono text-[11px] text-muted-foreground leading-relaxed min-w-0">
                  {llmCfg.api_key
                    ? "Running on your own key — stored in this browser only, never on the server."
                    : "Running on the server's shared default key. Add your own to use your quota."}
                </p>
                <button
                  onClick={openSettings}
                  data-testid={SETTINGS.llmConfigureButton}
                  className={`${SECONDARY_BTN} shrink-0`}
                >
                  Configure
                </button>
              </div>
            </section>

            <section className="cell p-5">
              <Head icon={Lock} title="Change password" />
              <form onSubmit={submitPassword} className="flex flex-col gap-3 max-w-sm mt-3">
                <div>
                  <label className="label-mono block mb-1">Current password</label>
                  <input
                    data-testid={SETTINGS.currentPasswordField}
                    type="password"
                    required
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full input-bg border border-border text-primary text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="label-mono block mb-1">New password</label>
                  <input
                    data-testid={SETTINGS.newPasswordField}
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
                  data-testid={SETTINGS.changePasswordSubmit}
                  disabled={pwBusy}
                  className="mono text-xs uppercase tracking-widest h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 self-start"
                >
                  {pwBusy ? "Updating…" : "Update password"}
                </button>
              </form>
            </section>

            <section className="cell p-5">
              <Head icon={Devices} title="Sessions" />
              <p className="mono text-[11px] text-muted-foreground leading-relaxed mt-3 mb-3">
                Sign out on this device, or end every session everywhere.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={onSignOut}
                  data-testid={SETTINGS.signOutButton}
                  className={SECONDARY_BTN}
                >
                  <SignOut size={13} /> Sign out
                </button>
                <button
                  onClick={onLogoutEverywhere}
                  data-testid={SETTINGS.logoutEverywhereButton}
                  className={SECONDARY_BTN}
                >
                  <Devices size={13} /> Log out everywhere
                </button>
              </div>
            </section>
          </div>

          <section className="cell p-5 border-bearish/40">
            <div className="label-mono mb-3 text-bearish flex items-center gap-1.5">
              <ShieldWarning size={13} /> Danger zone
            </div>
            <p className="mono text-[11px] text-muted-foreground mb-3 leading-relaxed">
              Deleting your account permanently removes it and all your reports. Type your
              email (<span className="text-primary">{user.email}</span>) to confirm.
            </p>
            <div className="flex items-center gap-2 max-w-sm">
              <input
                data-testid={SETTINGS.deleteConfirmField}
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={user.email}
                className="flex-1 input-bg border border-border text-primary text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-bearish"
              />
              <button
                onClick={onDelete}
                data-testid={SETTINGS.deleteAccountButton}
                disabled={delBusy || confirmEmail.trim().toLowerCase() !== user.email}
                className="mono text-[11px] uppercase tracking-widest px-3 h-9 border border-bearish bg-bearish/5 text-bearish hover:bg-bearish/15 disabled:opacity-40 shrink-0"
              >
                Delete account
              </button>
            </div>
          </section>
        </motion.div>
      </div>
    </div>
  );
}

function Head({ icon: Icon, title }) {
  return (
    <div className="label-mono flex items-center gap-1.5">
      <Icon size={13} /> {title}
    </div>
  );
}

function Row({ label, value, muted }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={muted ? "text-muted-foreground/70" : "text-primary"}>{value}</span>
    </div>
  );
}
