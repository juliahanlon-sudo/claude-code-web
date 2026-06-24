// Configuration
const API_URL = 'http://localhost:3000/api/message';
const AUTH_STATUS_URL = 'http://localhost:3000/api/auth-status';
const SKILLS_URL = 'http://localhost:3000/api/skills';
const AUTH_TRIGGER_URL = 'http://localhost:3000/api/auth-trigger';

// Auto-resize textarea
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const chatContainer = document.getElementById('chatContainer');

messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = this.scrollHeight + 'px';

    // Update send button state
    sendBtn.disabled = this.value.trim() === '';
});

// Handle Enter key
messageInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Send button click
sendBtn.addEventListener('click', sendMessage);

function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    // Hide welcome message if present
    const welcomeMessage = document.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.style.display = 'none';
    }

    // Add user message
    addMessage(message, 'user');

    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendBtn.disabled = true;

    // Get selected model
    const selectedModel = document.getElementById('modelSelect').value;

    // Send to Claude Code via local server
    addMessage('Thinking...', 'assistant', true);

    fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message,
            model: selectedModel
        })
    })
    .then(response => response.json())
    .then(data => {
        // Remove "Thinking..." message
        const thinkingMsg = chatContainer.querySelector('.message-thinking');
        if (thinkingMsg) {
            thinkingMsg.remove();
        }

        if (data.error) {
            addMessage('Error: ' + data.error, 'assistant');
        } else {
            addMessage(data.response, 'assistant');
        }
    })
    .catch(error => {
        // Remove "Thinking..." message
        const thinkingMsg = chatContainer.querySelector('.message-thinking');
        if (thinkingMsg) {
            thinkingMsg.remove();
        }
        addMessage('Connection error. Make sure the server is running with: node server.js', 'assistant');
        console.error('Error:', error);
    });
}

function addMessage(text, role, isThinking = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${role}`;
    if (isThinking) {
        messageDiv.classList.add('message-thinking');
    }

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';

    if (role === 'user') {
        avatar.textContent = 'JH';
        avatar.style.background = 'linear-gradient(135deg, #0176D3, #1B96FF)';
    } else {
        avatar.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" stroke="currentColor" stroke-width="2"/>
            </svg>
        `;
        avatar.style.background = '#F3F3F3';
        avatar.style.color = '#0176D3';
    }

    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = text;

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);

    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Quick action buttons
document.querySelectorAll('.quick-action-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const actionText = this.querySelector('strong').textContent;
        messageInput.value = `Help me with: ${actionText}`;
        messageInput.focus();
        messageInput.dispatchEvent(new Event('input'));
    });
});

// History items
document.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', function() {
        document.querySelectorAll('.history-item').forEach(i => i.classList.remove('active'));
        this.classList.add('active');
    });
});

// New chat button
document.querySelector('.new-chat-btn').addEventListener('click', function() {
    chatContainer.innerHTML = `
        <div class="welcome-message">
            <div class="welcome-icon">
                <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" fill="url(#gradient)" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                    <path d="M12 12L2 7M12 12L22 7M12 12V22" stroke="currentColor" stroke-width="2"/>
                    <defs>
                        <linearGradient id="gradient" x1="2" y1="2" x2="22" y2="22">
                            <stop offset="0%" stop-color="#0176D3"/>
                            <stop offset="100%" stop-color="#1B96FF"/>
                        </linearGradient>
                    </defs>
                </svg>
            </div>
            <h3>Welcome to Claude Code</h3>
            <p>Your AI-powered coding assistant with Salesforce integration</p>
            <div class="quick-actions">
                <button class="quick-action-btn">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" stroke="currentColor" stroke-width="2"/>
                        <path d="M13 2v7h7" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <div>
                        <strong>Create Component</strong>
                        <span>Build Lightning Web Components</span>
                    </div>
                </button>
                <button class="quick-action-btn">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M9 11l3 3L22 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <div>
                        <strong>Review Code</strong>
                        <span>Get AI code review feedback</span>
                    </div>
                </button>
                <button class="quick-action-btn">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <div>
                        <strong>Debug Issue</strong>
                        <span>Troubleshoot errors and bugs</span>
                    </div>
                </button>
                <button class="quick-action-btn">
                    <svg viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                        <path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <div>
                        <strong>Explain Code</strong>
                        <span>Understand complex code sections</span>
                    </div>
                </button>
            </div>
        </div>
    `;

    // Re-attach quick action listeners
    document.querySelectorAll('.quick-action-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const actionText = this.querySelector('strong').textContent;
            messageInput.value = `Help me with: ${actionText}`;
            messageInput.focus();
            messageInput.dispatchEvent(new Event('input'));
        });
    });
});

// Initialize send button state
sendBtn.disabled = true;

// Load saved model preference
const savedModel = localStorage.getItem('selectedModel') || 'sonnet';
document.getElementById('modelSelect').value = savedModel;

// Save model preference when changed
document.getElementById('modelSelect').addEventListener('change', function() {
    localStorage.setItem('selectedModel', this.value);
});

// Check authentication status
function checkAuthStatus() {
    fetch(AUTH_STATUS_URL)
        .then(response => response.json())
        .then(data => {
            data.status.forEach(auth => {
                const element = document.getElementById(auth.service + 'Auth');
                const indicator = element.querySelector('.auth-indicator');

                if (auth.authenticated) {
                    element.classList.remove('auth-pending', 'auth-error');
                    element.classList.add('auth-success');
                    indicator.style.background = '#4CAF50';
                    element.title = `${auth.service === 'salesforce' ? 'Salesforce' : 'Google Workspace'} - Authenticated`;
                } else {
                    element.classList.remove('auth-pending', 'auth-success');
                    element.classList.add('auth-error');
                    indicator.style.background = '#F44336';
                    element.title = `${auth.service === 'salesforce' ? 'Salesforce' : 'Google Workspace'} - Not Authenticated`;
                }
            });
        })
        .catch(error => {
            console.error('Error checking auth status:', error);
            ['salesforceAuth', 'googleAuth'].forEach(id => {
                const element = document.getElementById(id);
                element.classList.add('auth-error');
                element.querySelector('.auth-indicator').style.background = '#9E9E9E';
            });
        });
}

// Check auth status on load and every 30 seconds
checkAuthStatus();
setInterval(checkAuthStatus, 30000);

// Handle authentication button clicks
document.getElementById('salesforceAuth').addEventListener('click', function(e) {
    e.preventDefault();
    startAuthentication('salesforce');
});

document.getElementById('googleAuth').addEventListener('click', function(e) {
    e.preventDefault();
    startAuthentication('google');
});

function startAuthentication(service) {
    const element = document.getElementById(service + 'Auth');
    const indicator = element.querySelector('.auth-indicator');
    const textElement = element.querySelector('.auth-text');
    const originalText = textElement.textContent;

    // Show loading state
    element.classList.remove('auth-success', 'auth-error');
    element.classList.add('auth-pending');
    textElement.textContent = 'Authenticating...';

    fetch(AUTH_TRIGGER_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ service })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            element.classList.remove('auth-pending', 'auth-error');
            element.classList.add('auth-success');
            indicator.style.background = '#4CAF50';
            textElement.textContent = originalText;

            // Show success message
            addMessage(`✓ ${service === 'salesforce' ? 'Salesforce' : 'Google Workspace'} authentication started. Complete the process in your browser.`, 'assistant');

            // Recheck status after a delay
            setTimeout(checkAuthStatus, 3000);
        } else {
            element.classList.remove('auth-pending', 'auth-success');
            element.classList.add('auth-error');
            indicator.style.background = '#F44336';
            textElement.textContent = originalText;

            addMessage(`✗ Failed to start ${service === 'salesforce' ? 'Salesforce' : 'Google Workspace'} authentication: ${data.error}`, 'assistant');
        }
    })
    .catch(error => {
        console.error('Auth trigger error:', error);
        element.classList.remove('auth-pending', 'auth-success');
        element.classList.add('auth-error');
        textElement.textContent = originalText;

        addMessage(`✗ Failed to start authentication: ${error.message}`, 'assistant');
    });
}

// Load and display skills
let allSkills = [];

function loadSkills() {
    fetch(SKILLS_URL)
        .then(response => response.json())
        .then(data => {
            allSkills = data.skills || [];
            displaySkills(allSkills);
        })
        .catch(error => {
            console.error('Error loading skills:', error);
            const skillsList = document.getElementById('skillsList');
            skillsList.textContent = '';
            const errorDiv = document.createElement('div');
            errorDiv.className = 'skills-error';
            errorDiv.textContent = 'Failed to load skills';
            skillsList.appendChild(errorDiv);
        });
}

function displaySkills(skills) {
    const skillsList = document.getElementById('skillsList');
    skillsList.textContent = '';

    if (skills.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'skills-empty';
        emptyDiv.textContent = 'No skills found';
        skillsList.appendChild(emptyDiv);
        return;
    }

    // Group skills by category
    const grouped = skills.reduce((acc, skill) => {
        const category = skill.category || 'general';
        if (!acc[category]) acc[category] = [];
        acc[category].push(skill);
        return acc;
    }, {});

    // Build DOM elements safely
    Object.entries(grouped).forEach(([category, categorySkills]) => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'skill-category';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'skill-category-header';

        // Special styling for custom skills
        if (category === 'my-skills') {
            headerDiv.textContent = '⭐ My Skills';
            headerDiv.style.background = 'linear-gradient(135deg, #0176D3, #1B96FF)';
            headerDiv.style.color = 'white';
        } else {
            headerDiv.textContent = category;
        }

        categoryDiv.appendChild(headerDiv);

        categorySkills.forEach(skill => {
            const btn = document.createElement('button');
            btn.className = 'skill-item';
            btn.setAttribute('data-skill', skill.name);
            btn.title = 'Click to use ' + skill.name;

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('fill', 'none');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M13 2L3 14h9l-1 8 10-12h-9l1-8z');
            path.setAttribute('stroke', 'currentColor');
            path.setAttribute('stroke-width', '2');
            path.setAttribute('stroke-linejoin', 'round');
            svg.appendChild(path);

            const span = document.createElement('span');
            span.textContent = skill.displayName;

            btn.appendChild(svg);
            btn.appendChild(span);

            btn.addEventListener('click', function() {
                const skillName = this.getAttribute('data-skill');
                messageInput.value = '/' + skillName + ' ';
                messageInput.focus();
                messageInput.dispatchEvent(new Event('input'));
            });

            categoryDiv.appendChild(btn);
        });

        skillsList.appendChild(categoryDiv);
    });
}

// Skills search
const skillsSearch = document.getElementById('skillsSearch');
skillsSearch.addEventListener('input', function() {
    const query = this.value.toLowerCase();
    if (!query) {
        displaySkills(allSkills);
        return;
    }

    const filtered = allSkills.filter(skill =>
        skill.name.toLowerCase().includes(query) ||
        skill.displayName.toLowerCase().includes(query) ||
        (skill.category && skill.category.toLowerCase().includes(query))
    );
    displaySkills(filtered);
});

// Load skills on page load
loadSkills();
