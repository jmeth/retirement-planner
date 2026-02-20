// Results page JavaScript

let results = null;
let portfolioChart = null;
let incomeChart = null;

document.addEventListener('DOMContentLoaded', () => {
    loadResults();
    setupEventListeners();
    renderDashboard();
    renderProjections();
});

function loadResults() {
    const stored = sessionStorage.getItem('results');
    if (!stored) {
        alert('No results found. Please run calculations first.');
        window.location.href = '/';
        return;
    }
    results = JSON.parse(stored);
}

function setupEventListeners() {
    document.getElementById('scenario-select').addEventListener('change', renderDashboard);
    document.getElementById('retirement-age-select').addEventListener('change', renderProjections);
    document.getElementById('scenario-detail-select').addEventListener('change', renderProjections);
    
    // Populate retirement age dropdown
    const retirementAges = Object.keys(results.projections).map(Number).sort((a, b) => a - b);
    const select = document.getElementById('retirement-age-select');
    retirementAges.forEach(age => {
        const option = document.createElement('option');
        option.value = age;
        option.textContent = `Retire at ${age}`;
        select.appendChild(option);
    });
}

function renderDashboard() {
    const scenario = document.getElementById('scenario-select').value;
    const container = document.getElementById('summary-table');
    
    // Filter summary for selected scenario
    const summaryData = results.summary.filter(s => s.scenario === scenario);
    
    container.innerHTML = '';
    
    summaryData.forEach(item => {
        const card = document.createElement('div');
        card.className = 'summary-card';
        card.innerHTML = `
            <h3>Retire at Age ${item.retirement_age}</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="label">Portfolio at Retirement</div>
                    <div class="value">${formatCurrency(item.portfolio_at_retirement)}</div>
                </div>
                <div class="summary-item">
                    <div class="label">Avg Annual Income</div>
                    <div class="value">${formatCurrency(item.avg_annual_income)}</div>
                </div>
                <div class="summary-item">
                    <div class="label">Portfolio at 85</div>
                    <div class="value">${formatCurrency(item.portfolio_at_85)}</div>
                </div>
                <div class="summary-item">
                    <div class="label">Portfolio Lasts Until</div>
                    <div class="value">Age ${item.portfolio_lasts_until_age}</div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
    
    renderInsights();
}

function renderProjections() {
    const retirementAge = parseInt(document.getElementById('retirement-age-select').value);
    const scenario = document.getElementById('scenario-detail-select').value;
    
    const projections = results.projections[retirementAge][scenario];
    
    // Update charts
    updatePortfolioChart(projections);
    updateIncomeChart(projections);
    
    // Update table
    updateProjectionTable(projections);
}

function updatePortfolioChart(projections) {
    const ctx = document.getElementById('portfolio-chart').getContext('2d');
    
    if (portfolioChart) {
        portfolioChart.destroy();
    }
    
    // Get account names from first projection
    const accountNames = Object.keys(projections[0].balances);
    
    // Prepare datasets for each account
    const datasets = accountNames.map((name, index) => {
        const colors = [
            '#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5',
            '#70AD47', '#264478', '#9E480E', '#636363', '#997300'
        ];
        
        return {
            label: name,
            data: projections.map(p => p.balances[name]),
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length] + '33',
            fill: false
        };
    });
    
    portfolioChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: projections.map(p => p.year),
            datasets: datasets
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Portfolio Balance by Account Over Time',
                    font: { size: 16 }
                },
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    stacked: false,
                    ticks: {
                        callback: function(value) {
                            return '$' + (value / 1000) + 'k';
                        }
                    }
                },
                x: {
                    ticks: {
                        maxTicksLimit: 20
                    }
                }
            }
        }
    });
}

function updateIncomeChart(projections) {
    const ctx = document.getElementById('income-chart').getContext('2d');
    
    if (incomeChart) {
        incomeChart.destroy();
    }
    
    // Show all years from retirement onward
    const retirementProjections = projections.filter(p => p.years_to_retirement <= 0);
    
    incomeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: retirementProjections.map(p => p.year),
            datasets: [
                {
                    label: 'Portfolio Withdrawal',
                    data: retirementProjections.map(p => p.withdrawal),
                    backgroundColor: '#4472C4'
                },
                {
                    label: 'Social Security',
                    data: retirementProjections.map(p => p.ss_income),
                    backgroundColor: '#70AD47'
                },
                {
                    label: 'Real Estate Income',
                    data: retirementProjections.map(p => p.real_estate_income || 0),
                    backgroundColor: '#ED7D31'
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Annual Retirement Income',
                    font: { size: 16 }
                },
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    stacked: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + (value / 1000) + 'k';
                        }
                    }
                },
                x: {
                    stacked: true,
                    ticks: {
                        maxTicksLimit: 20
                    }
                }
            }
        }
    });
}

function updateProjectionTable(projections) {
    const tbody = document.getElementById('projection-table-body');
    tbody.innerHTML = '';
    
    projections.forEach(proj => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${proj.year}</td>
            <td>${proj.age}</td>
            <td>${formatCurrency(proj.total_portfolio)}</td>
            <td>${formatCurrency(proj.withdrawal)}</td>
            <td>${formatCurrency(proj.ss_income)}</td>
            <td>${formatCurrency(proj.real_estate_income || 0)}</td>
            <td><strong>${formatCurrency(proj.total_income)}</strong></td>
        `;
        
        // Highlight when portfolio is depleted
        if (proj.total_portfolio < 1000 && proj.withdrawal > 0) {
            row.style.background = '#fff3cd';
            row.style.fontWeight = 'bold';
        }
        
        tbody.appendChild(row);
    });
}

function renderInsights() {
    const container = document.getElementById('insights-content');
    const scenario = document.getElementById('scenario-select').value;
    
    // Get expected case summary
    const expectedSummary = results.summary.filter(s => s.scenario === 'expected');
    
    container.innerHTML = '';
    
    // Find optimal retirement age (highest avg income with portfolio lasting to 90+)
    const viable = expectedSummary.filter(s => 
        typeof s.portfolio_lasts_until_age === 'number' && s.portfolio_lasts_until_age >= 90
    );
    
    if (viable.length > 0) {
        const optimal = viable.reduce((best, current) => 
            current.avg_annual_income > best.avg_annual_income ? current : best
        );
        
        const card = document.createElement('div');
        card.className = 'insight-card success';
        card.innerHTML = `
            <h3>💡 Recommended Strategy</h3>
            <p>Based on the expected case, retiring at age <strong>${optimal.retirement_age}</strong> provides the best balance:</p>
            <ul>
                <li>Average annual income: <strong>${formatCurrency(optimal.avg_annual_income)}</strong></li>
                <li>Portfolio lasts beyond age 90</li>
                <li>Portfolio at retirement: <strong>${formatCurrency(optimal.portfolio_at_retirement)}</strong></li>
            </ul>
        `;
        container.appendChild(card);
    }
    
    // Check for risky scenarios
    const worstCase = results.summary.filter(s => s.scenario === 'worst');
    const riskyAges = worstCase.filter(s => 
        typeof s.portfolio_lasts_until_age === 'number' && s.portfolio_lasts_until_age < 85
    );
    
    if (riskyAges.length > 0) {
        const card = document.createElement('div');
        card.className = 'insight-card warning';
        card.innerHTML = `
            <h3>⚠️ Risk Assessment</h3>
            <p>In the worst-case scenario, the following retirement ages may be risky:</p>
            <ul>
                ${riskyAges.map(s => `
                    <li>Age ${s.retirement_age}: Portfolio depletes by age ${s.portfolio_lasts_until_age}</li>
                `).join('')}
            </ul>
            <p>Consider working longer or reducing planned expenses for these scenarios.</p>
        `;
        container.appendChild(card);
    }
    
    // Income comparison
    const incomeRange = expectedSummary.map(s => s.avg_annual_income);
    const minIncome = Math.min(...incomeRange);
    const maxIncome = Math.max(...incomeRange);
    
    const card = document.createElement('div');
    card.className = 'insight-card';
    card.innerHTML = `
        <h3>📊 Income Range</h3>
        <p>Across all retirement ages (expected case):</p>
        <ul>
            <li>Lowest avg income: <strong>${formatCurrency(minIncome)}</strong></li>
            <li>Highest avg income: <strong>${formatCurrency(maxIncome)}</strong></li>
            <li>Difference: <strong>${formatCurrency(maxIncome - minIncome)}</strong> per year</li>
        </ul>
        <p>Working longer significantly increases your retirement income potential.</p>
    `;
    container.appendChild(card);
}

function formatCurrency(value) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}
