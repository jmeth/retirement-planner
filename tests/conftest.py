import pytest
from app import app as flask_app


MINIMAL_CONFIG = {
    "current_age": 40,
    "life_expectancy": 75,
    "ss_start_age": 67,
    "ss_annual": 24000,
    "salary": 100000,
    "inflation_rate": 2.5,
    "target_retirement_income": 0,
    "retirement_ages": [65],
    "accounts": [
        {
            "name": "401k",
            "type": "401k",
            "current_balance": 200000,
            "annual_contribution": 20000,
            "employer_match": 5,
            "contribution_limit": 23000,
        },
        {
            "name": "Savings",
            "type": "Savings",
            "current_balance": 10000,
            "annual_contribution": 5000,
            "employer_match": 0,
            "contribution_limit": 999999,
        },
    ],
    "milestones": {
        "401k": [
            {"years_before": 15, "expected": 9.0, "std_dev": 2.0},
            {"years_before": 5, "expected": 6.0, "std_dev": 1.5},
            {"years_before": 0, "expected": 4.0, "std_dev": 1.0},
        ],
        "Savings": [
            {"years_before": 0, "expected": 2.0, "std_dev": 0.5},
        ],
    },
    "events": [],
}


@pytest.fixture
def config():
    return dict(MINIMAL_CONFIG)


@pytest.fixture
def client():
    flask_app.config["TESTING"] = True
    flask_app.config["SECRET_KEY"] = "test-secret"  # nosec B105
    with flask_app.test_client() as c:
        yield c
