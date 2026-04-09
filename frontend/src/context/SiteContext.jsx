import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as publicService from "../services/publicService";

const SiteContext = createContext(null);

export function SiteProvider({ children }) {
  const [site, setSite] = useState(null);
  const [error, setError] = useState(null);

  const refreshSite = useCallback(async () => {
    try {
      setError(null);
      const data = await publicService.getPublicSite();
      setSite(data);
    } catch (e) {
      setError(e.message);
      setSite({
        project_name: "Sales Follow-up Console",
        logo_url: null,
        ollama_model: "llama3.2",
        openai_chat_model: "gpt-4o-mini",
      });
    }
  }, []);

  useEffect(() => {
    refreshSite();
  }, [refreshSite]);

  const value = useMemo(
    () => ({ site, refreshSite, siteError: error }),
    [site, refreshSite, error]
  );

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite() {
  const ctx = useContext(SiteContext);
  if (!ctx) {
    throw new Error("useSite must be used within SiteProvider");
  }
  return ctx;
}
