from pydantic import BaseModel, Field


class PaginationParams:
    """Defaults for query: page>=1, limit 1..100."""

    @staticmethod
    def clamp_page(page: int) -> int:
        return max(1, page)

    @staticmethod
    def clamp_limit(limit: int) -> int:
        return max(1, min(100, limit))


class PaginatedMeta(BaseModel):
    total: int
    page: int
    limit: int
    pages: int = Field(description="Total pages (ceil)")
