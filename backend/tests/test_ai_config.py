import json

import httpx
import pytest
from pydantic import ValidationError

from app.config import Settings, settings
from app.worker import ask_ai


@pytest.mark.parametrize("provider", ["openai", "azure"])
def test_provider_request(client, monkeypatch, provider):
    monkeypatch.setenv("AI_PROVIDER", provider)
    monkeypatch.setenv("AZURE_OPENAI_API_KEY", "azure-test-key")
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://portfolio.openai.azure.com/openai/v1/")
    monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT", "portfolio-drafts")
    settings.cache_clear()

    def post(self, url, **kwargs):
        if provider == "azure":
            assert url == "https://portfolio.openai.azure.com/openai/v1/chat/completions"
            assert kwargs["headers"] == {"api-key": "azure-test-key"}
            assert kwargs["json"]["model"] == "portfolio-drafts"
        else:
            assert url == "https://api.openai.com/v1/chat/completions"
            assert kwargs["headers"] == {"Authorization": "Bearer test-key"}
            assert kwargs["json"]["model"] == "test-model"
        assert not self.follow_redirects
        assert kwargs["json"]["response_format"]["json_schema"]["strict"] is True
        assert kwargs["json"]["max_completion_tokens"] == 2000
        proposal = {
            "title": "Update",
            "body": "Added retry handling.",
            "evidence_ids": ["real"],
            "questions": [],
        }
        return httpx.Response(
            200,
            request=httpx.Request("POST", url),
            json={"choices": [{"finish_reason": "stop", "message": {"content": json.dumps(proposal)}}]},
        )

    monkeypatch.setattr(httpx.Client, "post", post)
    result = ask_ai(
        [{"id": "real", "title": "Change", "description": "Added retries"}],
        settings().ai_model,
        provider=provider,
    )
    assert result.evidence_ids == ["real"]


@pytest.mark.parametrize(
    "endpoint",
    [
        "http://portfolio.openai.azure.com",
        "https://evil.example",
        "https://portfolio.openai.azure.com.evil.example",
        "https://user:pass@portfolio.openai.azure.com",
        "https://portfolio.openai.azure.com:443",
        "https://portfolio.openai.azure.com?key=x",
        "https://portfolio.openai.azure.com#fragment",
        "https://portfolio.openai.azure.com/openai/deployments/test",
    ],
)
def test_reject_invalid_azure_endpoint(endpoint):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, azure_openai_endpoint=endpoint)


def test_missing_azure_config_and_changed_provider_never_send(client, monkeypatch):
    def unexpected(*args, **kwargs):
        pytest.fail("Incomplete or changed provider configuration must not send evidence")

    monkeypatch.setattr(httpx.Client, "post", unexpected)
    monkeypatch.setenv("AI_PROVIDER", "azure")
    monkeypatch.setenv("AZURE_OPENAI_API_KEY", "")
    settings.cache_clear()
    with pytest.raises(ValueError, match="not configured"):
        ask_ai([], "portfolio-drafts", provider="azure")
    with pytest.raises(ValueError, match="provider changed"):
        ask_ai([], "old-model", provider="openai")


def test_azure_api_requires_complete_configuration(client, monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "azure")
    monkeypatch.setenv("AZURE_OPENAI_API_KEY", "")
    settings.cache_clear()
    response = client.post(
        "/api/v1/studio/projects/test/generations",
        json={"base_version": 1, "evidence_ids": ["some-evidence"]},
    )
    assert response.status_code == 503
