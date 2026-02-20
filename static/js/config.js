// Configuration page JavaScript

let config = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    setupTabs();
    setupEventListeners();
    renderForm();
    renderProfileSelect();
});

async function loadConfig() {
    // Try localStorage first, fall back to server default
    const saved = localStorage.getItem('retirement_config');
    if (saved) {
        config = JSON.parse(saved);
    } else {
        const response = await fetch('/api/config');
        config = await response.json();
    }
}

function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            
            // Update active states
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');
        });
    });
}

function setupEventListeners() {
    document.getElementById('add-account').addEventListener('click', addAccount);
    document.getElementById('add-event').addEventListener('click', addEvent);
    document.getElementById('save-btn').addEventListener('click', saveConfig);
    document.getElementById('calculate-btn').addEventListener('click', calculateResults);
    document.getElementById('reset-btn').addEventListener('click', resetConfig);
    document.getElementById('save-profile-btn').addEventListener('click', saveProfile);
    document.getElementById('load-profile-btn').addEventListener('click', loadProfile);
    document.getElementById('delete-profile-btn').addEventListener('click', deleteProfile);
}

// --- Profile management ---

function getProfiles() {
    return JSON.parse(localStorage.getItem('retirement_profiles') || '{}');
}

function saveProfiles(profiles) {
    localStorage.setItem('retirement_profiles', JSON.stringify(profiles));
}

function renderProfileSelect() {
    const select = document.getElementById('profile-select');
    const current = select.value;
    const profiles = getProfiles();
    select.innerHTML = '<option value="">-- saved profiles --</option>';
    Object.keys(profiles).sort().forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        if (name === current) opt.selected = true;
        select.appendChild(opt);
    });
}

function saveProfile() {
    const name = document.getElementById('profile-name').value.trim();
    if (!name) { alert('Enter a profile name first.'); return; }

    // Snapshot current form state into config before saving
    collectFormIntoConfig();

    const profiles = getProfiles();
    const isNew = !profiles[name];
    profiles[name] = JSON.parse(JSON.stringify(config));
    saveProfiles(profiles);
    renderProfileSelect();
    document.getElementById('profile-select').value = name;
    document.getElementById('profile-name').value = '';
    alert(isNew ? `Profile "${name}" saved.` : `Profile "${name}" updated.`);
}

function loadProfile() {
    const name = document.getElementById('profile-select').value;
    if (!name) { alert('Select a profile to load.'); return; }
    const profiles = getProfiles();
    if (!profiles[name]) { alert('Profile not found.'); return; }
    config = JSON.parse(JSON.stringify(profiles[name]));
    localStorage.setItem('retirement_config', JSON.stringify(config));
    renderForm();
    alert(`Profile "${name}" loaded.`);
}

function deleteProfile() {
    const name = document.getElementById('profile-select').value;
    if (!name) { alert('Select a profile to delete.'); return; }
    if (!confirm(`Delete profile "${name}"?`)) return;
    const profiles = getProfiles();
    delete profiles[name];
    saveProfiles(profiles);
    renderProfileSelect();
}

// Pull personal-info fields from the DOM into config (same logic as saveConfig, minus the server call)
function collectFormIntoConfig() {
    config.current_age = parseInt(document.getElementById('current_age').value);
    config.life_expectancy = parseInt(document.getElementById('life_expectancy').value);
    config.ss_start_age = parseInt(document.getElementById('ss_start_age').value);
    config.ss_annual = parseFloat(document.getElementById('ss_annual').value);
    config.salary = parseFloat(document.getElementById('salary').value);
    config.inflation_rate = parseFloat(document.getElementById('inflation_rate').value);
    config.target_retirement_income = parseFloat(document.getElementById('target_retirement_income').value) || 0;
    config.retirement_ages = document.getElementById('retirement_ages').value
        .split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
}

function renderForm() {
    // Personal info
    document.getElementById('current_age').value = config.current_age;
    document.getElementById('life_expectancy').value = config.life_expectancy;
    document.getElementById('ss_start_age').value = config.ss_start_age;
    document.getElementById('ss_annual').value = config.ss_annual;
    document.getElementById('salary').value = config.salary || 100000;
    document.getElementById('inflation_rate').value = config.inflation_rate || 2.5;
    document.getElementById('target_retirement_income').value = config.target_retirement_income || 0;
    document.getElementById('retirement_ages').value = config.retirement_ages.join(', ');
    
    // Accounts
    renderAccounts();
    
    // Milestones
    renderMilestones();
    
    // Events
    renderEvents();
}

function renderAccounts() {
    const container = document.getElementById('accounts-container');
    container.innerHTML = '';
    
    config.accounts.forEach((account, index) => {
        const isRealEstate = account.type === 'Real Estate';
        const isIncomeProperty = isRealEstate && account.real_estate_mode === 'income';
        const card = document.createElement('div');
        card.className = 'account-card';
        card.innerHTML = `
            <div class="card-header">
                <div class="card-title">${account.name}</div>
                <button type="button" class="remove-btn" onclick="removeAccount(${index})">Remove</button>
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label>Account Name</label>
                    <input type="text" value="${account.name}" onchange="updateAccount(${index}, 'name', this.value)">
                </div>
                <div class="form-group">
                    <label>Account Type</label>
                    <select onchange="updateAccount(${index}, 'type', this.value)">
                        <option value="401k" ${account.type === '401k' ? 'selected' : ''}>401k</option>
                        <option value="IRA" ${account.type === 'IRA' ? 'selected' : ''}>Traditional IRA</option>
                        <option value="Roth IRA" ${account.type === 'Roth IRA' ? 'selected' : ''}>Roth IRA</option>
                        <option value="Taxable" ${account.type === 'Taxable' ? 'selected' : ''}>Taxable Brokerage</option>
                        <option value="Savings" ${account.type === 'Savings' ? 'selected' : ''}>Savings</option>
                        <option value="Real Estate" ${account.type === 'Real Estate' ? 'selected' : ''}>Real Estate</option>
                    </select>
                </div>
                ${isRealEstate ? `
                <div class="form-group">
                    <label>Usage</label>
                    <select onchange="updateAccount(${index}, 'real_estate_mode', this.value)">
                        <option value="asset" ${account.real_estate_mode !== 'income' ? 'selected' : ''}>Asset Only (e.g. primary residence)</option>
                        <option value="income" ${account.real_estate_mode === 'income' ? 'selected' : ''}>Income Property (rental)</option>
                    </select>
                </div>
                ${!isIncomeProperty ? `
                <div class="form-group">
                    <label>
                        <input type="checkbox" ${account.exclude_from_portfolio ? 'checked' : ''} onchange="updateAccount(${index}, 'exclude_from_portfolio', this.checked)">
                        Exclude equity from portfolio total
                    </label>
                </div>
                ` : ''}
                <div class="form-group">
                    <label>Property Value ($)</label>
                    <input type="number" value="${account.property_value || 0}" onchange="updateAccount(${index}, 'property_value', parseFloat(this.value))">
                </div>
                <div class="form-group">
                    <label>Appreciation Rate (%)</label>
                    <input type="number" step="0.1" value="${account.appreciation_rate || 0}" onchange="updateAccount(${index}, 'appreciation_rate', parseFloat(this.value))">
                </div>
                <div class="form-group">
                    <label>Mortgage Rate (%)</label>
                    <input type="number" step="0.1" value="${account.mortgage_rate || 0}" onchange="updateAccount(${index}, 'mortgage_rate', parseFloat(this.value))">
                </div>
                <div class="form-group">
                    <label>Monthly Payment ($)</label>
                    <input type="number" value="${account.mortgage_payment || 0}" onchange="updateAccount(${index}, 'mortgage_payment', parseFloat(this.value))">
                </div>
                <div class="form-group">
                    <label>Mortgage Balance ($)</label>
                    <input type="number" value="${account.mortgage_balance || 0}" onchange="updateAccount(${index}, 'mortgage_balance', parseFloat(this.value))">
                </div>
                ${isIncomeProperty ? `
                <div class="form-group">
                    <label>Annual Property Tax ($)</label>
                    <input type="number" value="${account.property_tax || 0}" onchange="updateAccount(${index}, 'property_tax', parseFloat(this.value))">
                </div>
                <div class="form-group">
                    <label>Monthly Rent ($)</label>
                    <input type="number" value="${account.monthly_rent || 0}" onchange="updateAccount(${index}, 'monthly_rent', parseFloat(this.value))">
                </div>
                ` : ''}
                ` : `
                <div class="form-group">
                    <label>Current Balance ($)</label>
                    <input type="number" value="${account.current_balance}" onchange="updateAccount(${index}, 'current_balance', parseFloat(this.value))">
                </div>
                <div class="form-group">
                    <label>Annual Contribution ($)</label>
                    <input type="number" value="${account.annual_contribution}" onchange="updateAccount(${index}, 'annual_contribution', parseFloat(this.value))">
                </div>
                <div class="form-group">
                    <label>Employer Match (%)</label>
                    <input type="number" value="${account.employer_match}" onchange="updateAccount(${index}, 'employer_match', parseFloat(this.value))">
                </div>
                <div class="form-group">
                    <label>Contribution Limit ($)</label>
                    <input type="number" value="${account.contribution_limit}" onchange="updateAccount(${index}, 'contribution_limit', parseFloat(this.value))">
                </div>
                `}
            </div>
        `;
        container.appendChild(card);
    });
}

function renderMilestones() {
    const container = document.getElementById('milestones-container');
    container.innerHTML = '';
    
    const accountNames = [...new Set(config.accounts.filter(a => a.type !== 'Real Estate').map(a => a.name))];
    
    accountNames.forEach(accountName => {
        const milestones = config.milestones[accountName] || [];
        
        const group = document.createElement('div');
        group.className = 'milestone-group';
        group.innerHTML = `
            <div class="card-header">
                <div class="card-title">${accountName}</div>
                <button type="button" class="btn btn-secondary" onclick="addMilestone('${accountName}')">+ Add Milestone</button>
            </div>
            <div id="milestones-${accountName.replace(/\s/g, '-')}"></div>
        `;
        container.appendChild(group);
        
        const milestonesDiv = group.querySelector(`#milestones-${accountName.replace(/\s/g, '-')}`);
        
        milestones.forEach((milestone, idx) => {
            const item = document.createElement('div');
            item.className = 'milestone-item';
            item.innerHTML = `
                <div class="form-grid">
                    <div class="form-group">
                        <label>Years Before Retirement</label>
                        <input type="number" value="${milestone.years_before}" onchange="updateMilestone('${accountName}', ${idx}, 'years_before', parseFloat(this.value))">
                    </div>
                    <div class="form-group">
                        <label>Expected Return (%)</label>
                        <input type="number" step="0.1" value="${milestone.expected}" onchange="updateMilestone('${accountName}', ${idx}, 'expected', parseFloat(this.value))">
                    </div>
                    <div class="form-group">
                        <label>Std Deviation (%)</label>
                        <input type="number" step="0.1" value="${milestone.std_dev}" onchange="updateMilestone('${accountName}', ${idx}, 'std_dev', parseFloat(this.value))">
                    </div>
                    <div class="form-group">
                        <button type="button" class="remove-btn" onclick="removeMilestone('${accountName}', ${idx})">Remove</button>
                    </div>
                </div>
            `;
            milestonesDiv.appendChild(item);
        });
    });
}

function renderEvents() {
    const container = document.getElementById('events-container');
    container.innerHTML = '';
    
    config.events.forEach((event, index) => {
        const card = document.createElement('div');
        card.className = 'event-card';
        card.innerHTML = `
            <div class="card-header">
                <div class="card-title">${event.description}</div>
                <button type="button" class="remove-btn" onclick="removeEvent(${index})">Remove</button>
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label>Year</label>
                    <input type="number" value="${event.year}" onchange="updateEvent(${index}, 'year', parseInt(this.value))">
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <input type="text" value="${event.description}" onchange="updateEvent(${index}, 'description', this.value)">
                </div>
                <div class="form-group">
                    <label>Amount ($)</label>
                    <input type="number" value="${event.amount}" onchange="updateEvent(${index}, 'amount', parseFloat(this.value))">
                    <small>Positive = income, Negative = expense</small>
                </div>
                <div class="form-group">
                    <label>Account</label>
                    <select onchange="updateEvent(${index}, 'account', this.value)">
                        ${config.accounts.map(a => `<option value="${a.name}" ${event.account === a.name ? 'selected' : ''}>${a.name}</option>`).join('')}
                    </select>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Update functions
function updateAccount(index, field, value) {
    config.accounts[index][field] = value;
    if (field === 'name') {
        renderMilestones();
        renderEvents();
    }
    if (field === 'type') {
        const acct = config.accounts[index];
        if (value === 'Real Estate') {
            acct.real_estate_mode = acct.real_estate_mode || 'asset';
            acct.property_value = acct.property_value || 0;
            acct.appreciation_rate = acct.appreciation_rate || 3;
            acct.mortgage_rate = acct.mortgage_rate || 0;
            acct.mortgage_payment = acct.mortgage_payment || 0;
            acct.mortgage_balance = acct.mortgage_balance || 0;
            acct.property_tax = acct.property_tax || 0;
            acct.monthly_rent = acct.monthly_rent || 0;
        } else {
            acct.current_balance = acct.current_balance || 0;
            acct.annual_contribution = acct.annual_contribution || 0;
            acct.employer_match = acct.employer_match || 0;
            acct.contribution_limit = acct.contribution_limit || 999999;
        }
        renderAccounts();
        renderMilestones();
    }
    if (field === 'real_estate_mode') {
        renderAccounts();
    }
}

function removeAccount(index) {
    if (confirm('Are you sure you want to remove this account?')) {
        config.accounts.splice(index, 1);
        renderAccounts();
        renderMilestones();
        renderEvents();
    }
}

function addAccount() {
    config.accounts.push({
        name: 'New Account',
        type: 'Taxable',
        current_balance: 0,
        annual_contribution: 0,
        employer_match: 0,
        contribution_limit: 999999
    });
    renderAccounts();
    renderMilestones();
}

function updateMilestone(accountName, index, field, value) {
    config.milestones[accountName][index][field] = value;
}

function removeMilestone(accountName, index) {
    config.milestones[accountName].splice(index, 1);
    renderMilestones();
}

function addMilestone(accountName) {
    if (!config.milestones[accountName]) {
        config.milestones[accountName] = [];
    }
    config.milestones[accountName].push({
        years_before: 0,
        expected: 5.0,
        std_dev: 1.0
    });
    renderMilestones();
}

function updateEvent(index, field, value) {
    config.events[index][field] = value;
}

function removeEvent(index) {
    if (confirm('Are you sure you want to remove this event?')) {
        config.events.splice(index, 1);
        renderEvents();
    }
}

function addEvent() {
    config.events.push({
        year: new Date().getFullYear(),
        description: 'New Event',
        amount: 0,
        account: config.accounts[0].name
    });
    renderEvents();
}

async function saveConfig() {
    collectFormIntoConfig();
    
    // Save to localStorage for persistence across sessions
    localStorage.setItem('retirement_config', JSON.stringify(config));

    // Also save to server session for calculations
    const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
    });

    const result = await response.json();
    alert('Configuration saved successfully!');
}

async function calculateResults() {
    await saveConfig();
    
    document.getElementById('loading').style.display = 'flex';
    
    const response = await fetch('/api/calculate', {
        method: 'POST'
    });
    
    const results = await response.json();
    
    // Store results in sessionStorage
    sessionStorage.setItem('results', JSON.stringify(results));
    
    // Redirect to results page
    window.location.href = '/results';
}

async function resetConfig() {
    if (confirm('Are you sure you want to reset to default configuration? This will erase all your changes.')) {
        localStorage.removeItem('retirement_config');
        const response = await fetch('/api/reset', { method: 'POST' });
        const result = await response.json();
        config = result.config;
        renderForm();
        alert('Configuration reset to defaults');
    }
}
