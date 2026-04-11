"""Workspace plan gating for OpenAI vs Ollama (ai_router)."""

from unittest.mock import patch


@patch("agents.ai_router.run_ollama", return_value="ollama-out")
@patch("agents.ai_router._run_openai", return_value="openai-out")
@patch("agents.ai_router.settings")
def test_free_workspace_never_calls_openai(mock_settings, mock_openai, mock_ollama):
    mock_settings.mode = "api"
    mock_settings.openai_api_key = "sk-env"
    from agents.ai_router import ai_router

    out = ai_router(
        "prompt",
        ai_mode="api",
        api_key="sk-ws",
        workspace_plan="free",
    )
    assert out == "ollama-out"
    mock_openai.assert_not_called()


@patch("agents.ai_router.run_ollama", return_value="ollama-out")
@patch("agents.ai_router._run_openai", return_value="openai-out")
@patch("agents.ai_router.settings")
def test_pro_workspace_uses_openai_when_key_and_api_mode(
    mock_settings, mock_openai, mock_ollama,
):
    mock_settings.mode = "api"
    mock_settings.openai_api_key = ""
    from agents.ai_router import ai_router

    out = ai_router(
        "prompt",
        ai_mode="api",
        api_key="sk-ws",
        workspace_plan="pro",
    )
    assert out == "openai-out"
    mock_openai.assert_called_once()


@patch("agents.ai_router.run_ollama", return_value="ollama-out")
@patch("agents.ai_router.settings")
def test_global_mode_local_forces_ollama_even_for_pro(mock_settings, mock_ollama):
    mock_settings.mode = "local"
    from agents.ai_router import ai_router

    with patch("agents.ai_router._run_openai") as mock_openai:
        out = ai_router(
            "prompt",
            ai_mode="api",
            api_key="sk-ws",
            workspace_plan="pro",
        )
        assert out == "ollama-out"
        mock_openai.assert_not_called()
