#!/usr/bin/env python3
"""
Retirement Planner - Flask Web Application
"""

from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from collections import defaultdict
from functools import wraps
import os
import secrets

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', secrets.token_hex(16))

# Auth is only enabled when both env vars are provided
AUTH_USER = os.environ.get('ADMIN_USER', '')
AUTH_PASS = os.environ.get('ADMIN_PASS', '')
AUTH_ENABLED = bool(AUTH_USER and AUTH_PASS)

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if AUTH_ENABLED and not session.get('logged_in'):
            if request.path.startswith('/api/'):
                return jsonify({'error': 'Unauthorized'}), 401
            return redirect(url_for('login', next=request.path))
        return f(*args, **kwargs)
    return decorated

class RetirementCalculator:
    def __init__(self, config_data):
        self.config = config_data
        self.current_year = 2025
        self.inflation_rate = config_data.get('inflation_rate', 2.5) / 100.0

    def get_return_for_account_and_year(self, account_name, years_to_retirement, scenario='expected'):
        """Get the appropriate return rate for an account based on years to retirement"""
        milestones = self.config['milestones'].get(account_name, [])

        # Sort milestones by years_before_retirement (descending)
        sorted_milestones = sorted(milestones, key=lambda x: x['years_before'], reverse=True)

        # Find the applicable milestone
        applicable_milestone = None
        for milestone in sorted_milestones:
            if years_to_retirement >= milestone['years_before']:
                applicable_milestone = milestone
                break

        if not applicable_milestone:
            # Use the most conservative (closest to retirement)
            applicable_milestone = sorted_milestones[-1] if sorted_milestones else {'expected': 5.0, 'std_dev': 1.0}

        expected_return = applicable_milestone['expected'] / 100.0
        std_dev = applicable_milestone['std_dev'] / 100.0

        if scenario == 'best':
            return expected_return + std_dev
        elif scenario == 'worst':
            return expected_return - std_dev
        else:
            return expected_return

    def _get_accessible_balances(self, age, accounts_balance, ss_start_age):
        """Get account balances accessible at a given age, grouped by access phase"""
        # Identify account types by looking up config
        account_types = {}
        for account in self.config['accounts']:
            account_types[account['name']] = account['type']

        accessible = {}
        for name, balance in accounts_balance.items():
            acct_type = account_types.get(name, '')
            if acct_type == 'Real Estate':
                continue  # Real estate is not withdrawable
            if age < 59.5:
                # Before 59.5: taxable + Roth IRA contributions (simplified: full Roth balance)
                if acct_type in ('Taxable', 'Savings', 'Roth IRA'):
                    accessible[name] = balance
            elif age < ss_start_age:
                # Before SS: taxable + retirement accounts (401k, IRA, Roth)
                if acct_type in ('Taxable', 'Savings', '401k', 'IRA', 'Roth IRA'):
                    accessible[name] = balance
            else:
                # After SS: all accounts
                accessible[name] = balance

        return accessible

    def calculate_withdrawal_amount(self, age, retirement_age, accounts_balance,
                                     ss_start_age, initial_withdrawal, years_retired):
        """Calculate withdrawal amount adjusted for inflation each year.
        Uses target_retirement_income if configured, otherwise the 4% rule."""
        if age < retirement_age:
            return 0

        return initial_withdrawal * ((1 + self.inflation_rate) ** years_retired)

    def distribute_withdrawal(self, age, total_withdrawal, accounts_balance, ss_start_age):
        """Distribute withdrawal across accessible accounts proportionally"""
        withdrawals = defaultdict(float)
        remaining = total_withdrawal

        accessible = self._get_accessible_balances(age, accounts_balance, ss_start_age)
        total_accessible = sum(accessible.values())

        if total_accessible > 0:
            for name, balance in accessible.items():
                if balance > 0:
                    withdrawals[name] = min((balance / total_accessible) * remaining, balance)

        return withdrawals

    def project_scenario(self, retirement_age, scenario='expected'):
        """Project portfolio for a given retirement age and scenario"""
        current_age = self.config['current_age']
        life_expectancy = self.config['life_expectancy']
        ss_start_age = self.config['ss_start_age']
        ss_annual = self.config['ss_annual']
        salary = self.config.get('salary', 100000)

        # Initialize account balances
        balances = {}
        re_state = {}  # Track mutable real estate state per account
        for account in self.config['accounts']:
            if account['type'] == 'Real Estate':
                balances[account['name']] = account.get('property_value', 0) - account.get('mortgage_balance', 0)
                re_state[account['name']] = {
                    'property_value': account.get('property_value', 0),
                    'mortgage_balance': account.get('mortgage_balance', 0),
                }
            else:
                balances[account['name']] = account['current_balance']

        # Track year-by-year results
        projections = []
        initial_withdrawal = 0  # Set at retirement

        for year_offset in range(life_expectancy - current_age + 1):
            year = self.current_year + year_offset
            age = current_age + year_offset
            years_to_retirement = retirement_age - age
            years_retired = max(0, age - retirement_age)

            # Inflation factor from today
            inflation_factor = (1 + self.inflation_rate) ** year_offset

            # Process one-time events for this year
            events_this_year = [e for e in self.config['events'] if e['year'] == year]

            # Calculate returns and contributions
            new_balances = {}
            contributions = {}
            employer_match = {}
            real_estate_income = 0

            for account in self.config['accounts']:
                account_name = account['name']
                balance = balances[account_name]

                # Real estate accounts use dedicated logic
                if account['type'] == 'Real Estate':
                    state = re_state[account_name]
                    prop_value = state['property_value']
                    mort_balance = state['mortgage_balance']
                    mort_rate = account.get('mortgage_rate', 0) / 100.0
                    mort_payment = account.get('mortgage_payment', 0)
                    prop_tax = account.get('property_tax', 0)
                    monthly_rent = account.get('monthly_rent', 0)

                    # Appreciate property value
                    appreciation_rate = account.get('appreciation_rate', 0) / 100.0
                    prop_value *= (1 + appreciation_rate)

                    # Amortize mortgage month by month
                    monthly_rate = mort_rate / 12
                    total_payments_made = 0
                    for _ in range(12):
                        if mort_balance <= 0:
                            break
                        interest = mort_balance * monthly_rate
                        principal = min(mort_payment - interest, mort_balance)
                        if principal < 0:
                            principal = 0
                        mort_balance -= principal
                        total_payments_made += interest + principal

                    mort_balance = max(0, mort_balance)

                    # Net annual income (only for income properties)
                    re_mode = account.get('real_estate_mode', 'asset')
                    if re_mode == 'income':
                        annual_rent = monthly_rent * 12
                        net_income = annual_rent - total_payments_made - prop_tax
                        real_estate_income += net_income

                    # Persist updated state for next year
                    state['property_value'] = prop_value
                    state['mortgage_balance'] = mort_balance

                    # Equity = property value - mortgage balance
                    new_balances[account_name] = prop_value - mort_balance
                    continue

                # Get return rate
                return_rate = self.get_return_for_account_and_year(
                    account_name, years_to_retirement, scenario
                )

                # Add contributions (only before retirement)
                contribution = 0
                match = 0
                if age < retirement_age:
                    # Contributions grow with inflation over time
                    base_contribution = min(account['annual_contribution'],
                                           account['contribution_limit'])
                    contribution = base_contribution * inflation_factor
                    contributions[account_name] = contribution

                    # Employer match: employer matches dollar-for-dollar up to X% of salary
                    if account['type'] == '401k' and account['employer_match'] > 0:
                        max_match = salary * inflation_factor * (account['employer_match'] / 100.0)
                        match = min(contribution, max_match)
                        employer_match[account_name] = match

                # Apply returns to beginning balance, plus half-year return on contributions
                investment_return = balance * return_rate
                contribution_return = (contribution + match) * return_rate * 0.5

                new_balances[account_name] = balance + investment_return + contribution + match + contribution_return

            # Process one-time events
            for event in events_this_year:
                target_account = event['account']
                amount = event['amount']
                if target_account in new_balances:
                    new_balances[target_account] += amount

            # Calculate withdrawals (if retired)
            total_withdrawal = 0
            withdrawal_by_account = defaultdict(float)
            ss_income = 0

            if age >= retirement_age:
                # Set initial desired income at retirement
                if age == retirement_age:
                    target_income = self.config.get('target_retirement_income', 0)
                    if target_income > 0:
                        initial_withdrawal = target_income
                    else:
                        # Exclude real estate equity from 4% rule (not withdrawable)
                        re_names = {a['name'] for a in self.config['accounts'] if a['type'] == 'Real Estate'}
                        investable = sum(v for k, v in new_balances.items() if k not in re_names)
                        initial_withdrawal = investable * 0.04

                desired_income = self.calculate_withdrawal_amount(
                    age, retirement_age, new_balances, ss_start_age,
                    initial_withdrawal, years_retired
                )

                # Social Security covers part of desired income
                # SS value is in today's dollars; adjust for inflation only from SS start
                if age >= ss_start_age:
                    years_on_ss = age - ss_start_age
                    ss_income = ss_annual * ((1 + self.inflation_rate) ** years_on_ss)

                # Only withdraw the remainder from portfolio
                total_withdrawal = max(0, desired_income - ss_income)

                # Cap withdrawal at accessible balance (not all accounts)
                accessible = self._get_accessible_balances(age, new_balances, ss_start_age)
                total_accessible = sum(accessible.values())
                total_withdrawal = min(total_withdrawal, total_accessible)

                withdrawal_by_account = self.distribute_withdrawal(
                    age, total_withdrawal, new_balances, ss_start_age
                )

                # Apply withdrawals
                for account_name, withdrawal in withdrawal_by_account.items():
                    new_balances[account_name] -= withdrawal
                    new_balances[account_name] = max(0, new_balances[account_name])

            # Compute total portfolio, excluding RE accounts flagged as excluded
            excluded_names = {a['name'] for a in self.config['accounts']
                              if a['type'] == 'Real Estate' and a.get('exclude_from_portfolio')}
            total_portfolio = sum(v for k, v in new_balances.items() if k not in excluded_names)

            # Store projection
            projection = {
                'year': year,
                'age': age,
                'years_to_retirement': years_to_retirement,
                'balances': dict(new_balances),
                'total_portfolio': total_portfolio,
                'contributions': contributions,
                'employer_match': employer_match,
                'withdrawal': total_withdrawal,
                'withdrawal_by_account': dict(withdrawal_by_account),
                'ss_income': ss_income,
                'real_estate_income': real_estate_income,
                'total_income': total_withdrawal + ss_income + real_estate_income,
                'events': [e['description'] for e in events_this_year]
            }

            projections.append(projection)
            balances = new_balances

        return projections

def get_default_config():
    """Return default configuration"""
    return {
        'current_age': 35,
        'life_expectancy': 90,
        'ss_start_age': 67,
        'ss_annual': 30000,
        'salary': 100000,
        'inflation_rate': 2.5,
        'target_retirement_income': 0,
        'retirement_ages': [55, 60, 62, 65, 67],
        'accounts': [
            {
                'name': '401k',
                'type': '401k',
                'current_balance': 100000,
                'annual_contribution': 23000,
                'employer_match': 5,
                'contribution_limit': 23000
            },
            {
                'name': 'Traditional IRA',
                'type': 'IRA',
                'current_balance': 50000,
                'annual_contribution': 7000,
                'employer_match': 0,
                'contribution_limit': 7000
            },
            {
                'name': 'Roth IRA',
                'type': 'Roth IRA',
                'current_balance': 30000,
                'annual_contribution': 7000,
                'employer_match': 0,
                'contribution_limit': 7000
            },
            {
                'name': 'Taxable Brokerage',
                'type': 'Taxable',
                'current_balance': 75000,
                'annual_contribution': 10000,
                'employer_match': 0,
                'contribution_limit': 999999
            },
            {
                'name': 'Savings',
                'type': 'Savings',
                'current_balance': 20000,
                'annual_contribution': 5000,
                'employer_match': 0,
                'contribution_limit': 999999
            }
        ],
        'milestones': {
            '401k': [
                {'years_before': 15, 'expected': 9.0, 'std_dev': 2.5},
                {'years_before': 10, 'expected': 8.0, 'std_dev': 2.0},
                {'years_before': 5, 'expected': 6.0, 'std_dev': 1.5},
                {'years_before': 0, 'expected': 4.0, 'std_dev': 1.0}
            ],
            'Traditional IRA': [
                {'years_before': 15, 'expected': 8.5, 'std_dev': 2.5},
                {'years_before': 10, 'expected': 7.5, 'std_dev': 2.0},
                {'years_before': 5, 'expected': 5.5, 'std_dev': 1.5},
                {'years_before': 0, 'expected': 3.5, 'std_dev': 1.0}
            ],
            'Roth IRA': [
                {'years_before': 15, 'expected': 10.0, 'std_dev': 3.0},
                {'years_before': 10, 'expected': 9.0, 'std_dev': 2.5},
                {'years_before': 5, 'expected': 7.0, 'std_dev': 2.0},
                {'years_before': 0, 'expected': 5.0, 'std_dev': 1.5}
            ],
            'Taxable Brokerage': [
                {'years_before': 15, 'expected': 7.0, 'std_dev': 2.0},
                {'years_before': 10, 'expected': 6.5, 'std_dev': 1.8},
                {'years_before': 5, 'expected': 5.0, 'std_dev': 1.5},
                {'years_before': 0, 'expected': 3.5, 'std_dev': 1.0}
            ],
            'Savings': [
                {'years_before': 15, 'expected': 2.0, 'std_dev': 0.5},
                {'years_before': 0, 'expected': 2.0, 'std_dev': 0.5}
            ]
        },
        'events': [
            {'year': 2026, 'description': 'Performance Bonus', 'amount': 25000, 'account': 'Taxable Brokerage'},
            {'year': 2030, 'description': 'College Tuition Year 1', 'amount': -30000, 'account': 'Taxable Brokerage'},
            {'year': 2031, 'description': 'College Tuition Year 2', 'amount': -30000, 'account': 'Taxable Brokerage'},
            {'year': 2032, 'description': 'College Tuition Year 3', 'amount': -30000, 'account': 'Taxable Brokerage'},
            {'year': 2033, 'description': 'College Tuition Year 4', 'amount': -30000, 'account': 'Taxable Brokerage'}
        ]
    }

@app.route('/login', methods=['GET', 'POST'])
def login():
    if not AUTH_ENABLED:
        return redirect(url_for('index'))
    if session.get('logged_in'):
        return redirect(url_for('index'))
    error = None
    if request.method == 'POST':
        if (request.form.get('username') == AUTH_USER and
                request.form.get('password') == AUTH_PASS):
            session['logged_in'] = True
            next_page = request.args.get('next') or url_for('index')
            return redirect(next_page)
        error = 'Invalid username or password.'
    return render_template('login.html', error=error)

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    return redirect(url_for('login' if AUTH_ENABLED else 'index'))

@app.route('/')
@login_required
def index():
    """Main page - configuration form"""
    if 'config' not in session:
        session['config'] = get_default_config()
    return render_template('index.html', config=session['config'], auth_enabled=AUTH_ENABLED)

@app.route('/api/config', methods=['GET', 'POST'])
@login_required
def config_api():
    """Get or update configuration"""
    if request.method == 'POST':
        session['config'] = request.json
        return jsonify({'status': 'success', 'message': 'Configuration saved'})
    else:
        if 'config' not in session:
            session['config'] = get_default_config()
        return jsonify(session['config'])

@app.route('/api/reset', methods=['POST'])
@login_required
def reset_config():
    """Reset to default configuration"""
    session['config'] = get_default_config()
    return jsonify({'status': 'success', 'config': session['config']})

@app.route('/api/calculate', methods=['POST'])
@login_required
def calculate():
    """Run calculations and return results"""
    config = session.get('config', get_default_config())
    
    calculator = RetirementCalculator(config)
    
    results = {}
    
    for retirement_age in config['retirement_ages']:
        results[retirement_age] = {
            'expected': calculator.project_scenario(retirement_age, 'expected'),
            'best': calculator.project_scenario(retirement_age, 'best'),
            'worst': calculator.project_scenario(retirement_age, 'worst')
        }
    
    # Calculate summary statistics
    summary = []
    for retirement_age in config['retirement_ages']:
        for scenario in ['expected', 'best', 'worst']:
            projections = results[retirement_age][scenario]
            
            # Find retirement year
            retirement_proj = next((p for p in projections if p['age'] == retirement_age), None)
            portfolio_at_retirement = retirement_proj['total_portfolio'] if retirement_proj else 0
            
            # Find age 85
            age_85_proj = next((p for p in projections if p['age'] == 85), None)
            portfolio_at_85 = age_85_proj['total_portfolio'] if age_85_proj else 0
            
            # Calculate average income from retirement to 85
            retirement_to_85 = [p for p in projections if retirement_age <= p['age'] <= 85]
            avg_income = sum(p['total_income'] for p in retirement_to_85) / len(retirement_to_85) if retirement_to_85 else 0
            
            # Find the last age where portfolio is still above $1000
            last_positive = next((p for p in reversed(projections) if p['total_portfolio'] > 1000), None)
            portfolio_lasts_until_age = last_positive['age'] if last_positive else 'N/A'

            summary.append({
                'retirement_age': retirement_age,
                'scenario': scenario,
                'portfolio_at_retirement': portfolio_at_retirement,
                'avg_annual_income': avg_income,
                'portfolio_at_85': portfolio_at_85,
                'portfolio_lasts_until_age': portfolio_lasts_until_age
            })
    
    return jsonify({
        'projections': results,
        'summary': summary
    })

@app.route('/results')
@login_required
def results():
    """Results page"""
    return render_template('results.html', auth_enabled=AUTH_ENABLED)

if __name__ == '__main__':
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    host = os.environ.get('FLASK_HOST', '127.0.0.1')
    app.run(debug=debug, host=host, port=5005)
