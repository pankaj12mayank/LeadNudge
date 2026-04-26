/** Canonical API `status` values -> UI labels (snake_case in DB). */
/** Statuses shown in dashboard / analytics filters (excludes terminal stages). */
export const LEAD_STATUS_FILTER_OPTIONS = [
  { value: "request_sent", label: "Request Sent" },
  { value: "message_sent", label: "Message Sent" },
  { value: "replied_got", label: "Replied got" },
  { value: "on_discussion", label: "On Discussion" },
  { value: "just_lead", label: "Just lead" },
  { value: "new", label: "New" },
  { value: "old", label: "Old" },
  { value: "deal", label: "Deal" },
  { value: "contacted", label: "Contacted" },
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not interested" },
  { value: "closed", label: "Closed" },
];

export const LEAD_STATUS_OPTIONS = [
  { value: "request_sent", label: "Request Sent" },
  { value: "message_sent", label: "Message Sent" },
  { value: "replied_got", label: "Replied got" },
  { value: "on_discussion", label: "On Discussion" },
  { value: "just_lead", label: "Just lead" },
  { value: "new", label: "New" },
  { value: "old", label: "Old" },
  { value: "deal", label: "Deal" },
  { value: "close", label: "Close" },
  { value: "fail", label: "Fail" },
  { value: "contacted", label: "Contacted" },
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not interested" },
  { value: "closed", label: "Closed" },
];

export const LEAD_TYPE_SELECT_OPTIONS = [
  { value: "", label: "—" },
  { value: "A+", label: "A+" },
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
];

export function leadStatusLabel(status) {
  const s = (status || "").trim();
  const hit = LEAD_STATUS_OPTIONS.find((o) => o.value === s);
  return hit ? hit.label : s || "—";
}

/** Maps API status to Badge `variant` (extend Badge.jsx when adding keys). */
export function leadStatusBadgeVariant(status) {
  const m = {
    request_sent: "pipelinePurple",
    message_sent: "pipelineBlue",
    replied_got: "pipelineBrown",
    on_discussion: "pipelineRose",
    just_lead: "pipelineSlate",
    new: "pipelineNew",
    old: "pipelineOld",
    deal: "pipelineTeal",
    close: "pipelineEmerald",
    closed: "pipelineEmerald",
    fail: "pipelineFail",
    contacted: "pipelineBlueSoft",
    interested: "pipelineAmber",
    not_interested: "muted",
  };
  return m[status] || "muted";
}
