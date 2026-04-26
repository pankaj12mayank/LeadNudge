"""Global + per-workspace labels for lead columns and AI context section headers."""

from __future__ import annotations

import json
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.branding import AppBranding
from models.settings import WorkspaceSettings
from schemas.merge_field_labels import AdminLeadMergeFieldsOut, LeadMergeFieldOut

# Keys users can reference in followup_ai_custom_prompt (placeholders stay fixed).
MERGE_FIELD_KEYS: tuple[str, ...] = (
    "problem_seen",
    "thread_message",
    "solution",
    "context",
    "lead_name",
    "lead_email",
    "lead_status",
    "tag",
    "company",
    "role_title",
)

# Built-in defaults (used when DB JSON is null or missing a key).
_DEFAULT_ROWS: dict[str, dict[str, Any]] = {
    "problem_seen": {
        "label": "Problem seen",
        "description": "What the lead shared (problem / situation).",
        "applies_to_leads_table": True,
        "context_intro": "Problem / opportunity noted (context only):",
    },
    "thread_message": {
        "label": "Last message",
        "description": "Latest saved thread message (used inside bundled context, not a CSV column).",
        "applies_to_leads_table": False,
        "context_intro": "Latest saved thread message (additional context):",
    },
    "solution": {
        "label": "Solution",
        "description": "How you can help / pitch brief for the AI.",
        "applies_to_leads_table": True,
        "context_intro": (
            "What we can offer / how we usually help (internal brief — weave naturally; "
            "do not paste as marketing copy or a feature list):"
        ),
    },
    "context": {
        "label": "Full context",
        "description": "Bundled problem + thread text passed as {{context}}.",
        "applies_to_leads_table": False,
        "context_intro": None,
    },
    "lead_name": {
        "label": "Lead name",
        "description": "Contact name.",
        "applies_to_leads_table": False,
        "context_intro": None,
    },
    "lead_email": {
        "label": "Lead email",
        "description": "Contact email (do not paste into body by the model).",
        "applies_to_leads_table": False,
        "context_intro": None,
    },
    "lead_status": {
        "label": "Pipeline status",
        "description": "CRM stage / status.",
        "applies_to_leads_table": False,
        "context_intro": None,
    },
    "tag": {
        "label": "Tag",
        "description": "Lead tag.",
        "applies_to_leads_table": False,
        "context_intro": None,
    },
    "company": {
        "label": "Company",
        "description": "Organization name.",
        "applies_to_leads_table": True,
        "context_intro": None,
    },
    "role_title": {
        "label": "Role",
        "description": "Job title / role.",
        "applies_to_leads_table": True,
        "context_intro": None,
    },
}


def _parse_labels_json(raw: str | None) -> dict[str, dict[str, Any]]:
    if not raw or not str(raw).strip():
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    if not isinstance(data, dict):
        return {}
    out: dict[str, dict[str, Any]] = {}
    for k, v in data.items():
        if k not in MERGE_FIELD_KEYS or not isinstance(v, dict):
            continue
        out[k] = {kk: vv for kk, vv in v.items() if kk in ("label", "description", "context_intro")}
    return out


def _deep_merge_row(base: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    m = dict(base)
    for kk, vv in patch.items():
        if kk == "applies_to_leads_table":
            continue
        if vv is None:
            continue
        if kk in ("label", "description", "context_intro") and isinstance(vv, str):
            m[kk] = vv
    return m


def merged_label_map(
    *,
    global_patch: dict[str, dict[str, Any]],
    workspace_patch: dict[str, dict[str, Any]] | None,
) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for key in MERGE_FIELD_KEYS:
        base = dict(_DEFAULT_ROWS[key])
        g = global_patch.get(key) or {}
        w = (workspace_patch or {}).get(key) or {}
        row = _deep_merge_row(_deep_merge_row(base, g), w)
        row["applies_to_leads_table"] = bool(_DEFAULT_ROWS[key].get("applies_to_leads_table"))
        out[key] = row
    return out


def _branding_global_patch(db: Session) -> dict[str, dict[str, Any]]:
    b = db.get(AppBranding, 1)
    if not b:
        return {}
    return _parse_labels_json(getattr(b, "lead_merge_field_labels_json", None))


def _workspace_override_patch(db: Session, workspace_id: int) -> dict[str, dict[str, Any]] | None:
    row = (
        db.query(WorkspaceSettings)
        .filter(WorkspaceSettings.workspace_id == int(workspace_id))
        .first()
    )
    if not row:
        return None
    raw = getattr(row, "lead_merge_field_labels_override_json", None)
    if raw is None or not str(raw).strip():
        return None
    return _parse_labels_json(str(raw))


def resolve_merged_map(db: Session, workspace_id: int | None) -> dict[str, dict[str, Any]]:
    gp = _branding_global_patch(db)
    if workspace_id is None:
        return merged_label_map(global_patch=gp, workspace_patch=None)
    wp = _workspace_override_patch(db, workspace_id)
    return merged_label_map(global_patch=gp, workspace_patch=wp)


def merged_map_global_only(db: Session) -> dict[str, dict[str, Any]]:
    return merged_label_map(global_patch=_branding_global_patch(db), workspace_patch=None)


def to_lead_merge_field_out_list(merged: dict[str, dict[str, Any]]) -> list[LeadMergeFieldOut]:
    items: list[LeadMergeFieldOut] = []
    for key in MERGE_FIELD_KEYS:
        row = merged[key]
        items.append(
            LeadMergeFieldOut(
                key=key,
                label=str(row.get("label") or key),
                description=str(row.get("description") or ""),
                placeholder="{{" + key + "}}",
                applies_to_leads_table=bool(row.get("applies_to_leads_table")),
                context_intro=(
                    str(row["context_intro"]).strip()
                    if row.get("context_intro") is not None
                    and str(row.get("context_intro") or "").strip()
                    else None
                ),
            )
        )
    return items


def admin_lead_merge_fields_out(db: Session, workspace_id: int | None) -> AdminLeadMergeFieldsOut:
    b = db.get(AppBranding, 1)
    global_raw = getattr(b, "lead_merge_field_labels_json", None) if b else None
    global_labels = _parse_labels_json(str(global_raw) if global_raw else None)

    workspace_override: dict[str, dict] | None = None
    if workspace_id is not None:
        wp = _workspace_override_patch(db, workspace_id)
        workspace_override = wp if wp else None

    resolved_map = merged_label_map(
        global_patch=global_labels, workspace_patch=workspace_override
    )
    return AdminLeadMergeFieldsOut(
        global_labels=global_labels,
        workspace_override=workspace_override,
        resolved=to_lead_merge_field_out_list(resolved_map),
    )


def save_global_labels(db: Session, fields: list[Any]) -> None:
    from services.branding_service import get_or_create_branding

    by_key = _rows_to_patch_dict(fields)
    if set(by_key.keys()) != set(MERGE_FIELD_KEYS):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="All merge field keys must be present when saving global labels.",
        )
    b = get_or_create_branding(db)
    merged = merged_label_map(global_patch=by_key, workspace_patch=None)
    # Persist only overrides from defaults (keeps JSON small); store per-key if any field differs.
    to_store: dict[str, dict[str, Any]] = {}
    for key in MERGE_FIELD_KEYS:
        base = dict(_DEFAULT_ROWS[key])
        final_row = merged[key]
        diff: dict[str, Any] = {}
        for fld in ("label", "description", "context_intro"):
            if fld not in base and final_row.get(fld):
                diff[fld] = final_row.get(fld)
            elif base.get(fld) != final_row.get(fld):
                diff[fld] = final_row.get(fld)
        if diff:
            to_store[key] = diff
    b.lead_merge_field_labels_json = json.dumps(to_store) if to_store else None
    db.commit()


def save_workspace_override(db: Session, workspace_id: int, fields: list[Any]) -> None:
    by_key = _rows_to_patch_dict(fields)
    if set(by_key.keys()) != set(MERGE_FIELD_KEYS):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="All merge field keys must be present when saving a workspace override.",
        )
    row = (
        db.query(WorkspaceSettings)
        .filter(WorkspaceSettings.workspace_id == int(workspace_id))
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Workspace settings not found")
    gp = _branding_global_patch(db)
    effective = merged_label_map(global_patch=gp, workspace_patch=by_key)
    global_full = merged_label_map(global_patch=gp, workspace_patch=None)
    to_store: dict[str, dict[str, Any]] = {}
    for key in MERGE_FIELD_KEYS:
        eff = effective[key]
        glo = global_full[key]
        diff: dict[str, Any] = {}
        for fld in ("label", "description", "context_intro"):
            if (eff.get(fld) or "") != (glo.get(fld) or ""):
                diff[fld] = eff.get(fld)
        if diff:
            to_store[key] = diff
    row.lead_merge_field_labels_override_json = json.dumps(to_store) if to_store else None
    db.commit()


def clear_workspace_override(db: Session, workspace_id: int) -> None:
    row = (
        db.query(WorkspaceSettings)
        .filter(WorkspaceSettings.workspace_id == int(workspace_id))
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Workspace settings not found")
    row.lead_merge_field_labels_override_json = None
    db.commit()


def _rows_to_patch_dict(fields: list[Any]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for f in fields:
        key = str(f.key).strip()
        if key not in MERGE_FIELD_KEYS:
            continue
        out[key] = {
            "label": (f.label or "").strip() or _DEFAULT_ROWS[key]["label"],
            "description": (f.description or "").strip(),
            "context_intro": (
                (f.context_intro or "").strip() or None
                if getattr(f, "context_intro", None) is not None
                else None
            ),
        }
    return out


class AiContextHeadings:
    __slots__ = ("problem_chunk", "thread_chunk", "solution_internal_preface")

    def __init__(
        self,
        *,
        problem_chunk: str,
        thread_chunk: str,
        solution_internal_preface: str,
    ) -> None:
        self.problem_chunk = problem_chunk
        self.thread_chunk = thread_chunk
        self.solution_internal_preface = solution_internal_preface


def ai_context_headings_for_workspace(db: Session, workspace_id: int) -> AiContextHeadings:
    m = resolve_merged_map(db, workspace_id)
    ps = m["problem_seen"].get("context_intro") or _DEFAULT_ROWS["problem_seen"]["context_intro"]
    tm = (
        m["thread_message"].get("context_intro")
        or _DEFAULT_ROWS["thread_message"]["context_intro"]
    )
    sol = m["solution"].get("context_intro") or _DEFAULT_ROWS["solution"]["context_intro"]
    return AiContextHeadings(
        problem_chunk=str(ps),
        thread_chunk=str(tm),
        solution_internal_preface=str(sol),
    )
