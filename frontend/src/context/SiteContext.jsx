import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as publicService from "../services/publicService";
import { mediaUrl } from "../utils/mediaUrl";

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
        favicon_url: null,
        support_email: null,
        ollama_model: "llama3.2",
        openai_chat_model: "gpt-4o-mini",
      });
    }
  }, []);

  useEffect(() => {
    refreshSite();
  }, [refreshSite]);

  useEffect(() => {
    if (!site) return;
    const name = site.project_name || "Sales Follow-up Console";
    document.title = name;
    let link = document.querySelector("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    const href = site.favicon_url ? mediaUrl(site.favicon_url) : null;
    if (href) {
      link.href = href;
    }
  }, [site]);

  const value = useMemo(
    () => ({ site, refreshSite, siteError: error }),
    [site, refreshSite, error],
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
