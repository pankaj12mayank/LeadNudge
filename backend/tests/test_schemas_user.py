"""User API schemas — validation and forward compatibility."""

from schemas.user import UserProfileUpdate


def test_profile_update_ignores_unknown_fields():
    u = UserProfileUpdate.model_validate(
        {"display_name": "  Ada  ", "unexpected": "x"},
    )
    assert u.display_name == "  Ada  "
    assert not hasattr(u, "unexpected")
