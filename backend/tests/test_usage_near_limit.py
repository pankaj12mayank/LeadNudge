"""Mirror of usage_near_limit logic in settings_service.get_settings_out."""


def usage_near_limit(used: int, lim: int) -> bool:
    lim = max(0, int(lim or 0))
    return lim > 0 and used >= int(lim * 0.9 + 0.9999) and used < lim


def test_at_90_percent_triggers() -> None:
    assert usage_near_limit(90, 100) is True
    assert usage_near_limit(180, 200) is True


def test_below_90_or_at_cap() -> None:
    assert usage_near_limit(89, 100) is False
    assert usage_near_limit(100, 100) is False
    assert usage_near_limit(0, 0) is False
