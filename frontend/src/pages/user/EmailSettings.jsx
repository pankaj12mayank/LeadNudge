import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import Card from "../../components/Card";
import {
  DEFAULT_FOLLOWUP_AI_BODY_INSTRUCTIONS,
  MIN_FOLLOWUP_AI_INSTRUCTIONS_LEN,
} from "../../constants/followupAiDefaults";
import * as userService from "../../services/userService";

export default function EmailSettings() {
  const [host, setHost] = useState("");
  const [port, setPort] = useState(587);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [outboundSent, setOutboundSent] = useState(0);
  const [smtpReady, setSmtpReady] = useState(false);
  const [hasSavedPassword, setHasSavedPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [followupSubjectTpl, setFollowupSubjectTpl] = useState("");
  const [followupOpening, setFollowupOpening] = useState("");
  const [followupClosing, setFollowupClosing] = useState("");
  const [followupSenderName, setFollowupSenderName] = useState("");
  const [followupAiCustomPrompt, setFollowupAiCustomPrompt] = useState("");
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [portfolioAttached, setPortfolioAttached] = useState(false);
  const [portfolioBusy, setPortfolioBusy] = useState(false);
  const [leadMergeFields, setLeadMergeFields] = useState([]);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const s = await userService.getSettings();
        if (c) return;
        setHost(s.smtp_host || "");
        setPort(s.smtp_port ?? 587);
        setEmail(s.smtp_email || "");
        setPassword("");
        setHasSavedPassword(s.smtp_password === "***");
        setOutboundSent(s.outbound_emails_sent ?? 0);
        setSmtpReady(Boolean(s.smtp_fully_configured));
        setFollowupSubjectTpl(s.followup_subject_template || "");
        setFollowupOpening(s.followup_opening_line || "");
        setFollowupClosing(s.followup_closing_template || "");
        setFollowupSenderName(s.followup_sender_display_name || "");
        const aiPrompt =
          (s.followup_ai_custom_prompt || "").trim() || DEFAULT_FOLLOWUP_AI_BODY_INSTRUCTIONS;
        setFollowupAiCustomPrompt(aiPrompt);
        setPortfolioAttached(Boolean(s.portfolio_attached));
        setLeadMergeFields(Array.isArray(s.lead_merge_fields) ? s.lead_merge_fields : []);
      } catch (e) {
        toast.error(e.message);
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const mergeFieldChips = useMemo(() => {
    if (!leadMergeFields.length) return null;
    return leadMergeFields.map((f, i) => (
      <span key={f.key} title={f.description || f.label} className="inline">
        {i > 0 ? ", " : null}
        <code className="rounded bg-neutral-100 px-1 text-[11px] dark:bg-neutral-800">
          {f.placeholder || `{{${f.key}}}`}
        </code>
        <span className="text-neutral-500"> ({f.label})</span>
      </span>
    ));
  }, [leadMergeFields]);

  async function onSave(e) {
    e.preventDefault();
    const h = host.trim();
    const em = email.trim();
    const p = Number(port);
    if (!h) {
      toast.warning("SMTP host is required.");
      return;
    }
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      toast.warning("Enter a valid sender email address.");
      return;
    }
    if (!Number.isFinite(p) || p < 1 || p > 65535) {
      toast.warning("SMTP port must be between 1 and 65535.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        smtp_host: h,
        smtp_port: p,
        smtp_email: em,
      };
      if (password.trim()) {
        payload.smtp_password = password.trim();
      }
      await userService.updateSettings(payload);
      toast.success("Email settings saved");
      if (password.trim()) {
        setPassword("");
      }
      const s2 = await userService.getSettings();
      setHasSavedPassword(s2.smtp_password === "***");
      setOutboundSent(s2.outbound_emails_sent ?? 0);
      setSmtpReady(Boolean(s2.smtp_fully_configured));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onSaveTemplates(e) {
    e.preventDefault();
    const ai = followupAiCustomPrompt.trim();
    if (ai.length < MIN_FOLLOWUP_AI_INSTRUCTIONS_LEN) {
      toast.warning(
        `AI follow-up body instructions are required (at least ${MIN_FOLLOWUP_AI_INSTRUCTIONS_LEN} characters).`,
      );
      return;
    }
    setSavingTemplates(true);
    try {
      await userService.updateSettings({
        followup_subject_template: followupSubjectTpl.trim(),
        followup_opening_line: followupOpening.trim(),
        followup_closing_template: followupClosing.trim(),
        followup_sender_display_name: followupSenderName.trim(),
        followup_ai_custom_prompt: ai,
      });
      toast.success("Follow-up email layout saved", {
        description:
          "Subject, greeting, signature, and AI body instructions apply to the next scheduled sends.",
      });
      const s2 = await userService.getSettings();
      setFollowupSubjectTpl(s2.followup_subject_template || "");
      setFollowupOpening(s2.followup_opening_line || "");
      setFollowupClosing(s2.followup_closing_template || "");
      setFollowupSenderName(s2.followup_sender_display_name || "");
      setFollowupAiCustomPrompt(
        (s2.followup_ai_custom_prompt || "").trim() || DEFAULT_FOLLOWUP_AI_BODY_INSTRUCTIONS,
      );
      setLeadMergeFields(Array.isArray(s2.lead_merge_fields) ? s2.lead_merge_fields : []);
    } catch (err) {
      toast.error(err.message || "Could not save templates.");
    } finally {
      setSavingTemplates(false);
    }
  }

  async function onTest() {
    setTesting(true);
    try {
      const r = await userService.testSmtp();
      if (r.ok) toast.success(r.message);
      else toast.warning(r.message);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setTesting(false);
    }
  }

  async function onPortfolioFile(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      toast.warning("Please choose a PDF file (max 8 MB).");
      return;
    }
    setPortfolioBusy(true);
    try {
      const s2 = await userService.uploadPortfolioPdf(f);
      setPortfolioAttached(Boolean(s2.portfolio_attached));
      toast.success("Portfolio attached", {
        description: "It is included when automated follow-up emails send via SMTP.",
      });
    } catch (err) {
      toast.error(err.message || "Upload failed");
    } finally {
      setPortfolioBusy(false);
    }
  }

  async function onClearPortfolio() {
    if (!portfolioAttached) return;
    if (!confirm("Remove the portfolio PDF? It will no longer attach to follow-up emails.")) {
      return;
    }
    setPortfolioBusy(true);
    try {
      await userService.deletePortfolioPdf();
      setPortfolioAttached(false);
      toast.success("Portfolio removed");
    } catch (err) {
      toast.error(err.message || "Could not remove");
    } finally {
      setPortfolioBusy(false);
    }
  }

  return (
    <div className="w-full space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="w-full border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Delivery
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Outgoing mail for your workspace
        </h1>
        <p className="mt-2 w-full text-sm text-neutral-600 dark:text-neutral-400">
          When a scheduled follow-up time is reached, the server generates a draft using each
          lead&apos;s <strong className="font-medium text-neutral-800 dark:text-neutral-200">Problem</strong> and{" "}
          <strong className="font-medium text-neutral-800 dark:text-neutral-200">Solution</strong> fields (plus notes). If SMTP is
          complete below, that email is sent automatically and logged under{" "}
          <strong className="font-medium text-neutral-800 dark:text-neutral-200">Sent mail</strong>.
          Without SMTP, copy the draft from Follow-ups. An optional portfolio PDF below attaches only when a send happens.
        </p>
        {!loading ? (
          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
            Status:{" "}
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              {smtpReady ? "SMTP ready — auto-send enabled" : "SMTP incomplete — drafts only"}
            </span>
            {" · "}
            Emails sent from this workspace:{" "}
            <span className="font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
              {outboundSent}
            </span>
          </p>
        ) : null}
      </section>

      <Card title="Outgoing mail">
        {loading ? (
          <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : (
          <form onSubmit={onSave} className="max-w-lg space-y-4">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-neutral-700 dark:text-neutral-300">
              <li>Enter your SMTP host (e.g. smtp.gmail.com).</li>
              <li>Enter the port (587 or 465).</li>
              <li>Enter the sender email (login username for most providers).</li>
              <li>Enter the password (leave blank to keep a saved password).</li>
              <li>Click <strong className="font-medium">Test email</strong> to verify, then Save.</li>
            </ol>
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <strong>Gmail / Google:</strong> use <code className="text-xs">smtp.gmail.com</code>, port{" "}
              <code className="text-xs">587</code>, your full email, and an{" "}
              <strong>App Password</strong> (not your normal password) if 2-Step Verification is on.
              Create one under Google Account → Security → App passwords.
            </p>
            <div>
              <label className="form-label">SMTP host</label>
              <input
                className="form-input"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                disabled={saving}
                placeholder="smtp.example.com"
              />
            </div>
            <div>
              <label className="form-label">SMTP port</label>
              <input
                type="number"
                min={1}
                max={65535}
                className="form-input max-w-xs"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                disabled={saving}
              />
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Common: 587 (STARTTLS), 465 (SSL).
              </p>
            </div>
            <div>
              <label className="form-label">SMTP username / from address</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={saving}
                placeholder="you@company.com"
              />
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <label className="form-label mb-0">SMTP password</label>
                <button
                  type="button"
                  className="text-xs font-medium text-neutral-600 underline dark:text-neutral-400"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {hasSavedPassword && !password.trim() ? (
                <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
                  A password is already saved (stored encrypted on the server). Type a new value only
                  if you want to replace it.
                </p>
              ) : null}
              <input
                type={showPassword ? "text" : "password"}
                className="form-input w-full font-mono text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={saving}
                placeholder={
                  hasSavedPassword && !password.trim()
                    ? "•••••••• (saved — enter new to change)"
                    : "SMTP password"
                }
                autoComplete="new-password"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving || testing}
                className="btn-primary"
              >
                Save
              </button>
              <button
                type="button"
                disabled={saving || testing}
                className="btn-secondary"
                onClick={onTest}
              >
                {testing ? "Testing…" : "Test email"}
              </button>
            </div>
          </form>
        )}
      </Card>

      <Card title="Follow-up email layout">
        {loading ? (
          <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : (
          <form onSubmit={onSaveTemplates} className="max-w-2xl space-y-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              When a scheduled follow-up sends automatically, the server builds the email from: your
              opening line, the <strong>AI-generated middle</strong> (from each lead&apos;s{" "}
              <strong>Problem</strong>, <strong>Solution</strong>, and thread context), then your closing.
              Subject/greeting/closing placeholders:{" "}
              <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-800">
                {"{{lead_name}}"}
              </code>
              ,{" "}
              <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-800">
                {"{{lead_email}}"}
              </code>
              ,{" "}
              <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-800">
                {"{{sender_name}}"}
              </code>
              ,{" "}
              <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-800">
                {"{{sender_email}}"}
              </code>
              .
            </p>
            <div>
              <label className="form-label">Subject line</label>
              <input
                className="form-input"
                value={followupSubjectTpl}
                onChange={(e) => setFollowupSubjectTpl(e.target.value)}
                disabled={savingTemplates}
                placeholder="Following up — {{lead_name}}"
              />
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Leave empty to use the default above.
              </p>
            </div>
            <div>
              <label className="form-label">Opening line (greeting)</label>
              <input
                className="form-input"
                value={followupOpening}
                onChange={(e) => setFollowupOpening(e.target.value)}
                disabled={savingTemplates}
                placeholder="Hi {{lead_name}},"
              />
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Default if empty: Hi {"{{lead_name}}"},
              </p>
            </div>
            <div>
              <label className="form-label">Closing / signature</label>
              <textarea
                className="form-input min-h-[100px] font-mono text-sm"
                value={followupClosing}
                onChange={(e) => setFollowupClosing(e.target.value)}
                disabled={savingTemplates}
                placeholder={"Thank you,\n{{sender_name}}"}
                spellCheck={false}
              />
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Default if empty: Best regards + new line + {"{{sender_name}}"}. Use line breaks for
                multiple lines.
              </p>
            </div>
            <div>
              <label className="form-label">Your name (sign-off)</label>
              <input
                className="form-input max-w-md"
                value={followupSenderName}
                onChange={(e) => setFollowupSenderName(e.target.value)}
                disabled={savingTemplates}
                placeholder="e.g. Alex Kumar"
              />
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Used for the email <strong className="font-medium">From</strong> display name (shown
                next to your SMTP address in the recipient&apos;s inbox), for{" "}
                <code className="rounded bg-neutral-100 px-1 text-[11px] dark:bg-neutral-800">
                  {"{{sender_name}}"}
                </code>{" "}
                in subject/greeting/closing, and appended to the closing if you omit that
                placeholder.
              </p>
            </div>
            <div>
              <label className="form-label">
                AI follow-up body instructions{" "}
                <span className="font-normal text-red-600 dark:text-red-400">(required)</span>
              </label>
              <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
                This block is merged into the AI prompt for <strong>every</strong> scheduled follow-up.
                Without it, the server will not generate a body. Admin can rename lead fields in{" "}
                <strong className="font-medium text-neutral-700 dark:text-neutral-300">
                  Admin → AI settings → Lead column labels
                </strong>
                ; placeholders below stay the same. Minimum {MIN_FOLLOWUP_AI_INSTRUCTIONS_LEN}{" "}
                characters. Default example is pre-filled — edit to match your tone.
              </p>
              <p className="mb-2 text-xs text-neutral-600 dark:text-neutral-300">
                Merge fields (hover for help): {mergeFieldChips || "—"}
              </p>
              <textarea
                className="form-input min-h-[200px] resize-y font-mono text-sm"
                value={followupAiCustomPrompt}
                onChange={(e) => setFollowupAiCustomPrompt(e.target.value)}
                disabled={savingTemplates}
                spellCheck={false}
                required
              />
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Length: {followupAiCustomPrompt.trim().length} / 12000 · minimum required:{" "}
                {MIN_FOLLOWUP_AI_INSTRUCTIONS_LEN}
              </p>
            </div>
            <button type="submit" disabled={savingTemplates} className="btn-primary">
              {savingTemplates ? "Saving…" : "Save email layout"}
            </button>
          </form>
        )}
      </Card>

      <Card title="Optional portfolio (PDF)">
        {loading ? (
          <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : (
          <div className="max-w-2xl space-y-3 text-sm text-neutral-600 dark:text-neutral-400">
            <p>
              If you upload a PDF here, it is <strong className="text-neutral-800 dark:text-neutral-200">automatically attached</strong> when a scheduled follow-up email is sent through SMTP. If
              nothing is uploaded, follow-ups send without an attachment.
            </p>
            <p className="text-xs">
              PDF only, up to 8 MB. Recipients see it as <code className="rounded bg-neutral-100 px-1 text-[11px] dark:bg-neutral-800">Portfolio.pdf</code>.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex">
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  disabled={portfolioBusy || saving}
                  onChange={onPortfolioFile}
                />
                <span className="btn-primary cursor-pointer">
                  {portfolioBusy ? "Working…" : portfolioAttached ? "Replace PDF" : "Upload PDF"}
                </span>
              </label>
              {portfolioAttached ? (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={portfolioBusy}
                  onClick={onClearPortfolio}
                >
                  Remove portfolio
                </button>
              ) : null}
              {portfolioAttached ? (
                <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                  A portfolio is on file for this workspace.
                </span>
              ) : (
                <span className="text-sm text-neutral-500 dark:text-neutral-400">
                  No portfolio on file.
                </span>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
