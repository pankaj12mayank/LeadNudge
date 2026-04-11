"""Unit tests for Ollama JSON parsing helpers."""

import json

from utils.ai_parser import (
    clean_text,
    extract_ollama_completion,
    parse_ollama_response_body,
)


def test_clean_text_strips_nul() -> None:
    assert clean_text("a\x00b") == "ab"
    assert clean_text("  x  ") == "x"


def test_extract_generate_response() -> None:
    assert extract_ollama_completion({"response": " Hello "}) == "Hello"


def test_extract_chat_message_content() -> None:
    data = {
        "model": "x",
        "message": {"role": "assistant", "content": "Hi there"},
        "done": True,
    }
    assert extract_ollama_completion(data) == "Hi there"


def test_extract_prefers_response_over_message() -> None:
    data = {"response": "from generate", "message": {"content": "ignored"}}
    assert extract_ollama_completion(data) == "from generate"


def test_extract_empty_on_error_key() -> None:
    assert extract_ollama_completion({"error": "load failed"}) is None


def test_parse_ndjson_merges_lines() -> None:
    raw = b'{"response":""}\n{"response":"final"}\n'
    out = parse_ollama_response_body(raw)
    assert isinstance(out, list)
    assert extract_ollama_completion(out) == "final"


def test_parse_single_json_object() -> None:
    raw = json.dumps({"response": "ok"}).encode()
    out = parse_ollama_response_body(raw)
    assert out == {"response": "ok"}
