"""Plan portal notice and workspace calendar gating."""

from unittest.mock import MagicMock

import pytest

from services import plan_access_service as pa


@pytest.fixture
def db() -> MagicMock:
    return MagicMock()


def test_portal_false_when_calendar_ok(db: MagicMock) -> None:
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(pa, "workspace_plan_expired", lambda _d, _w: False)
        assert pa.portal_shows_plan_expired_notice(db, 1, user_id=1) is False


def test_portal_false_when_quota_exhausted_even_if_calendar(db: MagicMock) -> None:
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(pa, "workspace_plan_expired", lambda _d, _w: True)
        mp.setattr(pa, "user_ai_quota_exhausted", lambda _d, _u: True)
        mp.setattr(pa, "user_calendar_blocks_ai", lambda _d, _u: True)
        assert pa.portal_shows_plan_expired_notice(db, 1, user_id=1) is False


def test_ai_features_blocked_false_when_plan_expired_but_workspace_headroom(
    db: MagicMock,
) -> None:
    with pytest.MonkeyPatch.context() as mp:

        def _ex(_d, _w):
            return False

        def _pe(_d, _w):
            return True

        def _lim(_d, _w):
            return 100

        def _used(_d, _w):
            return 5

        mp.setattr(pa, "workspace_ai_quota_exhausted", _ex)
        mp.setattr(pa, "workspace_plan_expired", _pe)
        mp.setattr(pa, "workspace_usage_limit", _lim)
        mp.setattr(pa, "count_workspace_ai_messages", _used)

        assert pa.ai_features_blocked(db, 1) is False
