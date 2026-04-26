import pytest

from agents.followup_agent import generate_followup


def test_generate_followup_requires_custom_template():
    with pytest.raises(ValueError, match="followup_ai_instructions_required"):
        generate_followup(
            lead_name="A",
            lead_email="a@b.co",
            lead_status="new",
            lead_tag=None,
            custom_prompt_template=None,
            ai_mode="local",
            api_key=None,
        )
