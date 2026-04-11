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
