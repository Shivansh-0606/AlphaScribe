import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  deleteAccount as deleteAccountRequest,
  getMe,
  loginUser,
  logoutAllSessions,
  logoutUser,
  registerUser,
} from "@/lib/api";

/**
 * Session lives in an httpOnly cookie (set by the backend) — this context
 * just mirrors who that cookie belongs to, hydrated once from /auth/me.
 */
const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password, remember) => {
    const u = await loginUser(email, password, remember);
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (email, password) => {
    const u = await registerUser(email, password);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await logoutUser().catch(() => {});
    setUser(null);
  }, []);

  const logoutEverywhere = useCallback(async () => {
    await logoutAllSessions().catch(() => {});
    setUser(null);
  }, []);

  const deleteAccount = useCallback(async (email) => {
    await deleteAccountRequest(email);
    setUser(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout, logoutEverywhere, deleteAccount }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () =>
  useContext(AuthCtx) || {
    user: null, loading: false,
    login: async () => {}, register: async () => {}, logout: async () => {},
    logoutEverywhere: async () => {}, deleteAccount: async () => {},
  };

// Wired onto every /app-layout route (Phase 4 login-wall cutover).
export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}
