# Retirement Planner Web App

A comprehensive web-based retirement planning tool that helps you model different retirement scenarios and understand your future income potential.

## Features

- **Interactive Configuration**: Easy-to-use web interface for entering your financial information
- **Multiple Account Support**: Track 401k, IRA, Roth IRA, taxable accounts, and savings separately
- **Dynamic Return Modeling**: Configure how investment returns change as you approach retirement
- **Scenario Analysis**: Compare best/expected/worst case outcomes
- **Life Events**: Model one-time income and expense events (bonuses, college tuition, etc.)
- **Beautiful Visualizations**: Charts showing portfolio growth and retirement income over time
- **Smart Insights**: Automated recommendations based on your data

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Run the Application

```bash
python app.py
```

### 3. Open in Browser

Navigate to: `http://localhost:5000`

## How to Use

### Configuration Page

The app has four main sections:

1. **Personal Info**
   - Enter your age, life expectancy, Social Security details
   - Specify which retirement ages you want to compare

2. **Accounts**
   - Add your investment accounts with current balances
   - Set annual contribution amounts
   - Configure employer matching (for 401k)

3. **Investment Strategy**
   - Define return milestones for each account
   - Specify how returns change as you approach retirement
   - Example: "15 years before retirement: 9% return, 5 years before: 6% return"

4. **Life Events**
   - Add one-time income events (bonuses, inheritance, stock vesting)
   - Add one-time expenses (college tuition, home purchase)
   - Specify which account each event affects

### Running Calculations

1. Fill out all configuration sections
2. Click "Save Configuration" to save your inputs
3. Click "Calculate Results" to run the projections
4. View results on the Results page

### Results Page

The results page shows:

1. **Scenario Comparison Dashboard**
   - Compare different retirement ages side-by-side
   - Switch between expected/best/worst case scenarios
   - See key metrics: portfolio value, annual income, longevity

2. **Detailed Projections**
   - Interactive charts showing portfolio growth over time
   - Year-by-year breakdown of account balances
   - Retirement income visualization

3. **Smart Insights**
   - Recommended retirement age based on your goals
   - Risk warnings for scenarios where portfolio may run out
   - Income range comparison

## Withdrawal Strategy

The calculator uses an age-based withdrawal strategy:

- **Before age 59.5**: Withdraw only from taxable accounts (avoid early withdrawal penalties)
- **Age 59.5 to Social Security age**: Split withdrawals between taxable and tax-deferred accounts
- **After Social Security age**: Withdraw proportionally from all accounts

All withdrawals use a 4% annual rate.

## Data Storage

- Configuration is stored in Flask session (server-side)
- Results are stored in browser sessionStorage (client-side)
- No database required - perfect for privacy-conscious users
- Data resets when you close the browser

## Customization

### Changing the Withdrawal Rate

Edit `app.py`, find the `calculate_withdrawal_amount` method:
```python
withdrawal = total * 0.04  # Change 0.04 to your desired rate
```

### Adding New Account Types

Edit `app.py` and add to the account type dropdown in `templates/index.html`

### Modifying Return Calculation

Edit the `get_return_for_account_and_year` method in `app.py`

## Technical Details

**Backend**: Flask (Python)
**Frontend**: Vanilla JavaScript, Chart.js for visualizations
**Styling**: Custom CSS with gradient design

No frameworks like React/Vue - keeps it simple and fast!

## Limitations & Future Enhancements

Current version does NOT include:
- Inflation modeling
- Detailed tax calculations
- Required Minimum Distributions (RMDs)
- Healthcare cost modeling
- Part-time retirement work income

These can be added as enhancements.

## File Structure

```
.
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── templates/
│   ├── index.html        # Configuration page
│   └── results.html      # Results page
└── static/
    ├── css/
    │   └── style.css     # Styles
    └── js/
        ├── config.js     # Configuration page logic
        └── results.js    # Results page logic
```

## Security Note

This app uses Flask sessions to store configuration. In production:
- Use a strong secret key (not the auto-generated one)
- Consider adding authentication if hosting publicly
- Use HTTPS in production
- Add CSRF protection for forms

## License

Free to use and modify for personal or commercial purposes.

## Support

For questions or issues, modify the code directly - it's designed to be hackable!
