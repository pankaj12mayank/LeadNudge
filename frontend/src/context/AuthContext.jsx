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
    localStorage.getItem(STORAGE_KEYS.token)
  );
  const [role, setRole] = useState(() =>
    localStorage.getItem(STORAGE_KEYS.role)
  );
  const [email, setEmail] = useState(() =>
    localStorage.getItem(STORAGE_KEYS.email)
  );
  const [loading, setLoading] = useState(false);

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

  const login = useCallback(async (creds) => {
    setLoading(true);
    try {
      const data = await authService.login(creds.email, creds.password);
      setToken(data.access_token);
      setRole(data.role);
      setEmail(creds.email);
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setRole(null);
    setEmail(null);
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.role);
    localStorage.removeItem(STORAGE_KEYS.email);
  }, []);

  const setSessionEmail = useCallback((e) => {
    setEmail(e);
  }, []);

  const value = useMemo(
    () => ({
      token,
      role,
      email,
      isAuthenticated: Boolean(token),
      loading,
      login,
      logout,
      setSessionEmail,
    }),
    [token, role, email, loading, login, logout, setSessionEmail]
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
