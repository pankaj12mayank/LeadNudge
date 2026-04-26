from typing import Literal

from pydantic import BaseModel, Field


class LeadMergeFieldOut(BaseModel):
    """Resolved label + help for one merge key (portal + admin)."""

    key: str
    label: str
    description: str = ""
    placeholder: str = ""
    applies_to_leads_table: bool = False
    context_intro: str | None = None


class AdminLeadMergeFieldsOut(BaseModel):
    """Admin editor: global patch, optional workspace override, and effective merge."""

    global_labels: dict[str, dict]
    workspace_override: dict[str, dict] | None
    resolved: list[LeadMergeFieldOut]


class AdminLeadMergeFieldRowIn(BaseModel):
    key: str = Field(max_length=64)
    label: str = Field(max_length=120)
    description: str = Field(default="", max_length=500)
    context_intro: str | None = Field(default=None, max_length=400)


class AdminLeadMergeFieldsPut(BaseModel):
    scope: Literal["global", "workspace"]
    workspace_id: int | None = None
    fields: list[AdminLeadMergeFieldRowIn] = Field(default_factory=list)
    clear_workspace_override: bool = False
