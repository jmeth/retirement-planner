"""Unit tests for RetirementCalculator."""
import pytest
from app import RetirementCalculator
from tests.conftest import MINIMAL_CONFIG


@pytest.fixture
def calc(config):
    return RetirementCalculator(config)


# ---------------------------------------------------------------------------
# get_return_for_account_and_year
# ---------------------------------------------------------------------------

class TestGetReturn:
    def test_expected_scenario_far_from_retirement(self, calc):
        # 25 years out → hits the >=15 milestone (expected 9%)
        rate = calc.get_return_for_account_and_year("401k", years_to_retirement=25)
        assert rate == pytest.approx(0.09)

    def test_expected_scenario_mid_range(self, calc):
        # 10 years out → hits the >=5 milestone (expected 6%)
        rate = calc.get_return_for_account_and_year("401k", years_to_retirement=10)
        assert rate == pytest.approx(0.06)

    def test_expected_scenario_near_retirement(self, calc):
        # 2 years out → hits the >=0 milestone (expected 4%)
        rate = calc.get_return_for_account_and_year("401k", years_to_retirement=2)
        assert rate == pytest.approx(0.04)

    def test_best_scenario_adds_std_dev(self, calc):
        # 25 years out → 9% + 2% std_dev = 11%
        rate = calc.get_return_for_account_and_year("401k", years_to_retirement=25, scenario="best")
        assert rate == pytest.approx(0.11)

    def test_worst_scenario_subtracts_std_dev(self, calc):
        # 25 years out → 9% - 2% std_dev = 7%
        rate = calc.get_return_for_account_and_year("401k", years_to_retirement=25, scenario="worst")
        assert rate == pytest.approx(0.07)

    def test_account_with_single_milestone(self, calc):
        # Savings has only one milestone (years_before=0); any years_to_retirement should use it
        rate = calc.get_return_for_account_and_year("Savings", years_to_retirement=30)
        assert rate == pytest.approx(0.02)


# ---------------------------------------------------------------------------
# calculate_withdrawal_amount
# ---------------------------------------------------------------------------

class TestWithdrawal:
    def test_no_withdrawal_before_retirement(self, calc):
        amount = calc.calculate_withdrawal_amount(
            age=55, retirement_age=65, accounts_balance={},
            ss_start_age=67, initial_withdrawal=50000, years_retired=0,
        )
        assert amount == 0

    def test_withdrawal_at_retirement(self, calc):
        # years_retired=0 → inflation factor is 1 → returns initial_withdrawal unchanged
        amount = calc.calculate_withdrawal_amount(
            age=65, retirement_age=65, accounts_balance={},
            ss_start_age=67, initial_withdrawal=50000, years_retired=0,
        )
        assert amount == pytest.approx(50000)

    def test_withdrawal_grows_with_inflation(self, calc):
        # inflation_rate is 2.5%; after 10 years the withdrawal should be larger
        amount = calc.calculate_withdrawal_amount(
            age=75, retirement_age=65, accounts_balance={},
            ss_start_age=67, initial_withdrawal=50000, years_retired=10,
        )
        expected = 50000 * (1.025 ** 10)
        assert amount == pytest.approx(expected)


# ---------------------------------------------------------------------------
# project_scenario
# ---------------------------------------------------------------------------

class TestProjectScenario:
    def test_returns_correct_number_of_years(self, calc, config):
        projections = calc.project_scenario(retirement_age=65)
        expected_years = config["life_expectancy"] - config["current_age"] + 1
        assert len(projections) == expected_years

    def test_projection_keys_present(self, calc):
        projections = calc.project_scenario(retirement_age=65)
        required_keys = {"year", "age", "total_portfolio", "balances", "withdrawal", "ss_income"}
        assert required_keys.issubset(projections[0].keys())

    def test_portfolio_grows_before_retirement(self, calc):
        projections = calc.project_scenario(retirement_age=65)
        pre_retirement = [p for p in projections if p["age"] < 65]
        # Portfolio should be strictly larger at the end of accumulation than the start
        assert pre_retirement[-1]["total_portfolio"] > pre_retirement[0]["total_portfolio"]

    def test_no_withdrawal_before_retirement(self, calc):
        projections = calc.project_scenario(retirement_age=65)
        pre_retirement = [p for p in projections if p["age"] < 65]
        assert all(p["withdrawal"] == 0 for p in pre_retirement)

    def test_withdrawal_begins_at_retirement(self, calc):
        projections = calc.project_scenario(retirement_age=65)
        retirement_year = next(p for p in projections if p["age"] == 65)
        assert retirement_year["withdrawal"] > 0

    def test_ss_income_starts_at_ss_age(self, calc, config):
        projections = calc.project_scenario(retirement_age=65)
        ss_age = config["ss_start_age"]
        before_ss = [p for p in projections if p["age"] == ss_age - 1]
        at_ss = [p for p in projections if p["age"] == ss_age]
        if before_ss:
            assert before_ss[0]["ss_income"] == 0
        if at_ss:
            assert at_ss[0]["ss_income"] > 0

    def test_worst_case_lower_than_expected(self, calc):
        expected = calc.project_scenario(retirement_age=65, scenario="expected")
        worst = calc.project_scenario(retirement_age=65, scenario="worst")
        # At end of life the worst-case portfolio should be lower (or equal) to expected
        assert worst[-1]["total_portfolio"] <= expected[-1]["total_portfolio"]

    def test_best_case_higher_than_expected(self, calc):
        expected = calc.project_scenario(retirement_age=65, scenario="expected")
        best = calc.project_scenario(retirement_age=65, scenario="best")
        assert best[-1]["total_portfolio"] >= expected[-1]["total_portfolio"]

    def test_one_time_event_affects_balance(self, config):
        config["events"] = [{"year": 2026, "description": "Bonus", "amount": 50000, "account": "401k"}]
        calc_with_event = RetirementCalculator(config)

        config_no_event = dict(config)
        config_no_event["events"] = []
        calc_without = RetirementCalculator(config_no_event)

        proj_with = calc_with_event.project_scenario(65)
        proj_without = calc_without.project_scenario(65)

        # The event year portfolio should be higher with the bonus
        year_with = next(p for p in proj_with if p["year"] == 2026)
        year_without = next(p for p in proj_without if p["year"] == 2026)
        assert year_with["total_portfolio"] > year_without["total_portfolio"]
