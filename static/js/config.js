// Configuration page JavaScript

const DEFAULT_PROFILE = 'default';

let config = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    setupTabs();
    setupEventListeners();
    renderForm();
    renderProfilesMenu();
});

async function loadConfig() {
    const profiles = getProfiles();
    const active = getActiveProfile();

    if (profiles[active]) {
        config = JSON.parse(JSON.stringify(profiles[active]));
    } else {
        // Migrate legacy localStorage or fall back to server default
        const legacy = localStorage.getItem('retirement_config');
        config = legacy ? JSON.parse(legacy) : await (await fetch('/api/config')).json();
        // Seed the default profile
        profiles[DEFAULT_PROFILE] = JSON.parse(JSON.stringify(config));
        saveProfiles(profiles);
        setActiveProfile(DEFAULT_PROFILE);
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
    document.getElementById('calculate-btn').addEventListener('click', calculateResults);
    document.getElementById('reset-btn').addEventListener('click', resetConfig);
    document.getElementById('profiles-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleProfilesMenu();
    });
    document.getElementById('save-profile-btn').addEventListener('click', saveCurrentProfile);
    document.getElementById('saveas-profile-btn').addEventListener('click', saveAsNewProfile);
    document.getElementById('delete-profile-btn').addEventListener('click', deleteCurrentProfile);
    document.addEventListener('click', (e) => {
        if (!document.getElementById('profiles-menu').contains(e.target)) {
            closeProfilesMenu();
        }
    });
}

// --- Profile management ---

function getProfiles() {
    return JSON.parse(localStorage.getItem('retirement_profiles') || '{}');
}

function saveProfiles(profiles) {
    localStorage.setItem('retirement_profiles', JSON.stringify(profiles));
}

function getActiveProfile() {
    return localStorage.getItem('retirement_active_profile') || DEFAULT_PROFILE;
}

function setActiveProfile(name) {
    localStorage.setItem('retirement_active_profile', name);
}

function toggleProfilesMenu() {
    const dropdown = document.getElementById('profiles-dropdown');
    if (dropdown.style.display === 'none') {
        renderProfilesMenu();
        dropdown.style.display = 'block';
    } else {
        closeProfilesMenu();
    }
}

function closeProfilesMenu() {
    document.getElementById('profiles-dropdown').style.display = 'none';
}

function renderProfilesMenu() {
    const profiles = getProfiles();
    const active = getActiveProfile();
    const list = document.getElementById('profiles-list');
    list.innerHTML = '';

    Object.keys(profiles).sort((a, b) => {
        if (a === DEFAULT_PROFILE) return -1;
        if (b === DEFAULT_PROFILE) return 1;
        return a.localeCompare(b);
    }).forEach(name => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'dropdown-item' + (name === active ? ' active' : '');
        item.textContent = name === DEFAULT_PROFILE ? 'Default' : name;
        item.addEventListener('click', () => switchProfile(name));
        list.appendChild(item);
    });

    document.getElementById('active-profile-label').textContent =
        active === DEFAULT_PROFILE ? 'Default' : active;

    // Can't delete the default profile
    document.getElementById('delete-profile-btn').style.display =
        active === DEFAULT_PROFILE ? 'none' : 'block';
}

function switchProfile(name) {
    const profiles = getProfiles();
    if (!profiles[name]) return;
    config = JSON.parse(JSON.stringify(profiles[name]));
    setActiveProfile(name);
    renderForm();
    renderProfilesMenu();
    closeProfilesMenu();
}

function saveCurrentProfile() {
    collectFormIntoConfig();
    const active = getActiveProfile();
    const profiles = getProfiles();
    profiles[active] = JSON.parse(JSON.stringify(config));
    saveProfiles(profiles);
    closeProfilesMenu();
}

function saveAsNewProfile() {
    const name = prompt('Profile name:');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (trimmed.toLowerCase() === DEFAULT_PROFILE) {
        alert('"default" is a reserved profile name.');
        return;
    }
    collectFormIntoConfig();
    const profiles = getProfiles();
    profiles[trimmed] = JSON.parse(JSON.stringify(config));
    saveProfiles(profiles);
    setActiveProfile(trimmed);
    renderProfilesMenu();
    closeProfilesMenu();
}

function deleteCurrentProfile() {
    const active = getActiveProfile();
    if (!confirm(`Delete profile "${active}"?`)) return;
    const profiles = getProfiles();
    delete profiles[active];
    saveProfiles(profiles);
    setActiveProfile(DEFAULT_PROFILE);
    config = JSON.parse(JSON.stringify(profiles[DEFAULT_PROFILE]));
    renderForm();
    renderProfilesMenu();
    closeProfilesMenu();
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

    // Persist to active profile
    const active = getActiveProfile();
    const profiles = getProfiles();
    profiles[active] = JSON.parse(JSON.stringify(config));
    saveProfiles(profiles);

    const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
    });

    if (!response.ok) {
        alert('Error saving configuration. Please try again.');
        return false;
    }
    return true;
}

async function calculateResults() {
    const saved = await saveConfig();
    if (!saved) return;

    document.getElementById('loading').style.display = 'flex';

    const response = await fetch('/api/calculate', { method: 'POST' });
    const results = await response.json();

    sessionStorage.setItem('results', JSON.stringify(results));
    window.location.href = '/results';
}

async function resetConfig() {
    if (!confirm('Restore factory defaults? Your saved profiles will not be affected.')) return;
    closeProfilesMenu();
    const response = await fetch('/api/reset', { method: 'POST' });
    const result = await response.json();
    config = result.config;
    renderForm();
}
