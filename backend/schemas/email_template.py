from pydantic import BaseModel, Field


class EmailTemplateOut(BaseModel):
    id: int
    name: str
    subject: str
    body: str

    model_config = {"from_attributes": True}


class EmailTemplateUpdate(BaseModel):
    subject: str = Field(min_length=1, max_length=512)
    body: str = Field(min_length=1)


class EmailTemplateCreate(BaseModel):
    """Create a row for a trigger that does not already have a template (e.g. after delete)."""

    trigger_key: str = Field(min_length=1, max_length=64)
    subject: str = Field(min_length=1, max_length=512)
    body: str = Field(min_length=1)


class EmailTriggerOut(BaseModel):
    key: str
    label: str
    description: str
    has_template: bool
