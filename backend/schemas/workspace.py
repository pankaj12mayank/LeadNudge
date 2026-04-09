from pydantic import BaseModel, Field


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    plan_type: str = Field(default="free", pattern="^(free|pro)$")


class WorkspaceOut(BaseModel):
    id: int
    name: str
    plan_type: str

    model_config = {"from_attributes": True}


class WorkspacePlanUpdate(BaseModel):
    plan_type: str = Field(pattern="^(free|pro)$")
