# Retirement Planner Web App - Visual Guide

## 🎨 Design Overview

The app features a modern, professional design with:
- Purple gradient background
- Clean white card-based interface
- Blue primary color (#4472C4) for headers and buttons
- Responsive layout that works on desktop and mobile

## 📱 Page Layouts

### Configuration Page (/)

**Header Section**
```
┌──────────────────────────────────────────────┐
│  💰 Retirement Planner                       │
│  Plan your financial future with confidence  │
└──────────────────────────────────────────────┘
```

**Tab Navigation**
```
┌──────────┬──────────┬──────────────────┬─────────────┐
│ Personal │ Accounts │ Investment       │ Life Events │
│ Info     │          │ Strategy         │             │
└──────────┴──────────┴──────────────────┴─────────────┘
```

**Personal Info Tab**
- Current Age (number input)
- Life Expectancy (number input)
- Social Security Start Age (number input)
- Annual Social Security Amount (currency input)
- Retirement Ages to Model (comma-separated text)

**Accounts Tab**
- Shows cards for each account
- Each card has:
  - Account name and type
  - Current balance
  - Annual contribution
  - Employer match %
  - Contribution limit
  - Remove button
- "+ Add Account" button at bottom

**Investment Strategy Tab**
- Grouped by account name
- Each group shows milestones:
  - Years before retirement
  - Expected return %
  - Standard deviation %
  - Remove button
- "+ Add Milestone" button for each account

**Life Events Tab**
- Shows cards for each event
- Each card has:
  - Year
  - Description
  - Amount (positive or negative)
  - Target account
  - Remove button
- "+ Add Event" button at bottom

**Action Bar (bottom)**
```
┌─────────────────────────────────────────────────────┐
│ [Reset to Defaults]    [Save] [Calculate Results] │
└─────────────────────────────────────────────────────┘
```

### Results Page (/results)

**Header Section**
```
┌──────────────────────────────────────────────┐
│  💰 Retirement Planner Results               │
│  [← Back to Configuration]                   │
└──────────────────────────────────────────────┘
```

**Scenario Comparison Dashboard**
- Dropdown to select Expected/Best/Worst case
- Cards for each retirement age showing:
  - Portfolio at Retirement
  - Average Annual Income
  - Portfolio at Age 85
  - Portfolio Lasts Until (age)

**Detailed Projections Section**
- Dropdowns to select:
  - Retirement age
  - Scenario (Expected/Best/Worst)
  
**Charts:**
1. **Portfolio Balance Chart** (Stacked Area Chart)
   - X-axis: Years
   - Y-axis: Account balances
   - One colored area for each account type
   - Shows growth during accumulation and drawdown in retirement

2. **Annual Income Chart** (Stacked Bar Chart)
   - X-axis: Retirement years
   - Y-axis: Income amount
   - Blue bars: Portfolio withdrawals
   - Green bars: Social Security
   - Shows total retirement income composition

**Projection Table**
- Shows every 5th year (to keep manageable)
- Columns:
  - Year
  - Age
  - Total Portfolio
  - Annual Withdrawal
  - SS Income
  - Total Income
- Highlights rows where portfolio is depleted

**Key Insights Section**
- Automatically generated cards:
  - 💡 Recommended Strategy (green border)
  - ⚠️ Risk Assessment (yellow border)
  - 📊 Income Range (blue border)

## 🎯 Color Scheme

Primary Colors:
- Primary Blue: #4472C4 (headers, buttons)
- Primary Dark: #2e5296 (hover states)
- Success Green: #28a745
- Warning Yellow: #ffc107
- Danger Red: #dc3545

Background:
- Page background: Purple gradient (#667eea to #764ba2)
- Card background: White (#ffffff)
- Light background: #f8f9fa

Text:
- Primary text: #333333
- Secondary text: #6c757d

## 📊 Chart Colors

Account type colors (for portfolio chart):
1. 401k: #4472C4 (Blue)
2. Traditional IRA: #ED7D31 (Orange)
3. Roth IRA: #A5A5A5 (Gray)
4. Taxable: #FFC000 (Yellow)
5. Savings: #5B9BD5 (Light Blue)

Income chart:
- Portfolio Withdrawal: #4472C4 (Blue)
- Social Security: #70AD47 (Green)

## 💫 Interactive Elements

**Hover Effects:**
- Buttons lift up with shadow
- Table rows highlight
- Tab buttons show background color

**Loading State:**
- Full-screen overlay with spinner
- "Calculating your retirement scenarios..." message

**Form Validation:**
- Required fields marked
- Input types enforce correct data (numbers for currency, etc.)

## 📱 Responsive Design

- Desktop: Full multi-column layout
- Tablet: 2-column layout where applicable
- Mobile: Single column, stacked layout
- All touch-friendly button sizes
