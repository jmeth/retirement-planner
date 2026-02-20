"""Integration tests for Flask routes."""
import json
import pytest
from app import get_default_config
from tests.conftest import MINIMAL_CONFIG


def set_session_config(client, config):
    """Helper: put a config into the Flask session before a request."""
    with client.session_transaction() as sess:
        sess["config"] = config


# ---------------------------------------------------------------------------
# GET /
# ---------------------------------------------------------------------------

class TestIndex:
    def test_returns_200(self, client):
        response = client.get("/")
        assert response.status_code == 200

    def test_loads_default_config_on_first_visit(self, client):
        client.get("/")
        with client.session_transaction() as sess:
            assert "config" in sess


# ---------------------------------------------------------------------------
# GET /results
# ---------------------------------------------------------------------------

class TestResults:
    def test_returns_200(self, client):
        response = client.get("/results")
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# GET /api/config
# ---------------------------------------------------------------------------

class TestGetConfig:
    def test_returns_default_when_no_session(self, client):
        response = client.get("/api/config")
        assert response.status_code == 200
        data = response.get_json()
        assert "accounts" in data
        assert "retirement_ages" in data

    def test_returns_saved_config(self, client):
        set_session_config(client, MINIMAL_CONFIG)
        response = client.get("/api/config")
        assert response.status_code == 200
        data = response.get_json()
        assert data["current_age"] == MINIMAL_CONFIG["current_age"]


# ---------------------------------------------------------------------------
# POST /api/config
# ---------------------------------------------------------------------------

class TestPostConfig:
    def test_saves_config(self, client):
        response = client.post(
            "/api/config",
            data=json.dumps(MINIMAL_CONFIG),
            content_type="application/json",
        )
        assert response.status_code == 200
        assert response.get_json()["status"] == "success"

    def test_saved_config_is_retrievable(self, client):
        client.post(
            "/api/config",
            data=json.dumps(MINIMAL_CONFIG),
            content_type="application/json",
        )
        response = client.get("/api/config")
        assert response.get_json()["current_age"] == MINIMAL_CONFIG["current_age"]


# ---------------------------------------------------------------------------
# POST /api/reset
# ---------------------------------------------------------------------------

class TestResetConfig:
    def test_resets_to_defaults(self, client):
        # Start with a custom config
        set_session_config(client, MINIMAL_CONFIG)

        response = client.post("/api/reset")
        assert response.status_code == 200
        data = response.get_json()
        assert data["status"] == "success"
        # The returned config should match the application defaults
        default = get_default_config()
        assert data["config"]["current_age"] == default["current_age"]
        assert len(data["config"]["accounts"]) == len(default["accounts"])


# ---------------------------------------------------------------------------
# POST /api/calculate
# ---------------------------------------------------------------------------

class TestCalculate:
    def test_returns_projections_and_summary(self, client):
        set_session_config(client, MINIMAL_CONFIG)
        response = client.post("/api/calculate")
        assert response.status_code == 200
        data = response.get_json()
        assert "projections" in data
        assert "summary" in data

    def test_projections_keyed_by_retirement_age(self, client):
        set_session_config(client, MINIMAL_CONFIG)
        data = client.post("/api/calculate").get_json()
        # MINIMAL_CONFIG has retirement_ages = [65]; JSON keys are always strings
        assert "65" in data["projections"]

    def test_projections_contain_all_scenarios(self, client):
        set_session_config(client, MINIMAL_CONFIG)
        data = client.post("/api/calculate").get_json()
        scenarios = data["projections"]["65"]
        assert set(scenarios.keys()) == {"expected", "best", "worst"}

    def test_summary_contains_expected_fields(self, client):
        set_session_config(client, MINIMAL_CONFIG)
        data = client.post("/api/calculate").get_json()
        first = data["summary"][0]
        expected_fields = {
            "retirement_age", "scenario", "portfolio_at_retirement",
            "avg_annual_income", "portfolio_at_85", "portfolio_lasts_until_age",
        }
        assert expected_fields.issubset(first.keys())

    def test_uses_default_config_when_no_session(self, client):
        # No session config set — should fall back to defaults and still succeed
        response = client.post("/api/calculate")
        assert response.status_code == 200
        data = response.get_json()
        assert "projections" in data
