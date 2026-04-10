import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as authService from "../services/authService";
import { STORAGE_KEYS } from "../utils/constants";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() =>
    localStorage.getItem(STORAGE_KEYS.token),
  );
  const [role, setRole] = useState(() =>
    localStorage.getItem(STORAGE_KEYS.role),
  );
  const [email, setEmail] = useState(() =>
    localStorage.getItem(STORAGE_KEYS.email),
  );
  const [displayName, setDisplayName] = useState(() =>
    localStorage.getItem(STORAGE_KEYS.displayName),
  );
  const [loading, setLoading] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  useEffect(() => {
    if (token) localStorage.setItem(STORAGE_KEYS.token, token);
    else localStorage.removeItem(STORAGE_KEYS.token);
  }, [token]);

  useEffect(() => {
    if (role) localStorage.setItem(STORAGE_KEYS.role, role);
    else localStorage.removeItem(STORAGE_KEYS.role);
  }, [role]);

  useEffect(() => {
    if (email) localStorage.setItem(STORAGE_KEYS.email, email);
    else localStorage.removeItem(STORAGE_KEYS.email);
  }, [email]);

  useEffect(() => {
    if (displayName)
      localStorage.setItem(STORAGE_KEYS.displayName, displayName);
    else localStorage.removeItem(STORAGE_KEYS.displayName);
  }, [displayName]);

  const refreshProfile = useCallback(async () => {
    if (!localStorage.getItem(STORAGE_KEYS.token)) return;
    try {
      const me = await authService.getMe();
      setEmail(me.email);
      setDisplayName(me.display_name || "");
    } catch {
      /* 401 handled by api interceptor */
    }
  }, []);

  useEffect(() => {
    if (token) refreshProfile();
  }, [token, refreshProfile]);

  const login = useCallback(async (creds) => {
    setLoading(true);
    try {
      const data = await authService.login(creds.email, creds.password);
      setToken(data.access_token);
      setRole(data.role);
      setEmail(creds.email.trim());
      setDisplayName(data.display_name || "");
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setRole(null);
    setEmail(null);
    setDisplayName(null);
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.role);
    localStorage.removeItem(STORAGE_KEYS.email);
    localStorage.removeItem(STORAGE_KEYS.displayName);
  }, []);

  const requestLogout = useCallback(() => setLogoutModalOpen(true), []);
  const cancelLogout = useCallback(() => setLogoutModalOpen(false), []);
  const confirmLogout = useCallback(() => {
    logout();
    setLogoutModalOpen(false);
    window.location.assign("/login");
  }, [logout]);

  const setSessionEmail = useCallback((e) => {
    setEmail(e);
  }, []);

  const value = useMemo(
    () => ({
      token,
      role,
      email,
      displayName,
      isAuthenticated: Boolean(token),
      loading,
      login,
      logout,
      requestLogout,
      cancelLogout,
      confirmLogout,
      logoutModalOpen,
      refreshProfile,
      setSessionEmail,
    }),
    [
      token,
      role,
      email,
      displayName,
      loading,
      login,
      logout,
      requestLogout,
      cancelLogout,
      confirmLogout,
      logoutModalOpen,
      refreshProfile,
      setSessionEmail,
    ],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return ctx;
}
