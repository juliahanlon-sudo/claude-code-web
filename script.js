// Configuration
const API_URL = 'http://localhost:3000/api/message';
const AUTH_STATUS_URL = 'http://localhost:3000/api/auth-status';
const SKILLS_URL = 'http://localhost:3000/api/skills';
const AUTH_TRIGGER_URL = 'http://localhost:3000/api/auth-trigger';

// LocalStorage wrapper with error handling
const Storage = {
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            if (item === null) return defaultValue;
            return JSON.parse(item);
        } catch (error) {
            console.error(`Error reading from localStorage (${key}):`, error);
            return defaultValue;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`Error writing to localStorage (${key}):`, error);
            // Check if it's a quota exceeded error
            if (error.name === 'QuotaExceededError') {
                console.warn('LocalStorage quota exceeded. Clearing old data...');
                this.clearOldData();
                try {
                    localStorage.setItem(key, JSON.stringify(value));
                    return true;
                } catch (retryError) {
                    console.error('Failed to save even after clearing:', retryError);
                    return false;
                }
            }
            return false;
        }
    },
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`Error removing from localStorage (${key}):`, error);
            return false;
        }
    },
    clearOldData() {
        try {
            // Remove oldest conversations first
            const conversations = this.get('conversations', []);
            if (conversations.length > 10) {
                this.set('conversations', conversations.slice(0, 10));
            }
        } catch (error) {
            console.error('Error clearing old data:', error);
        }
    }
};

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

    // Remove welcome message if present
    const welcomeMessage = document.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
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

function renderMarkdown(text) {
    // Simple markdown rendering
    let html = text;

    // Code blocks (```code```)
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // Inline code (`code`)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold (**text** or __text__)
    html = html.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

    // Italic (*text* or _text_)
    html = html.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

    // Headers (## Header)
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Lists (- item or * item)
    html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    return html;
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

    // Render markdown for assistant messages
    if (role === 'assistant' && !isThinking) {
        content.innerHTML = renderMarkdown(text);
    } else {
        content.textContent = text;
    }

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);

    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Save to current messages (if not thinking indicator)
    if (!isThinking) {
        // Initialize currentMessages if needed
        if (!Array.isArray(currentMessages)) {
            currentMessages = [];
        }
        currentMessages.push({ text, role, timestamp: new Date().toISOString() });
        saveCurrentConversation();
    }
}

// New chat button
document.querySelector('.new-chat-btn').addEventListener('click', function() {
    // Save current conversation before starting new one
    if (currentMessages.length > 0) {
        saveCurrentConversation();
    }

    // Start fresh conversation
    currentConversationId = null;
    currentMessages = [];
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
            <p class="welcome-hint">Select an agent or skill from the sidebar to get started, or just type your question below.</p>
        </div>
    `;
});

// Initialize send button state
sendBtn.disabled = true;

// Load saved model preference
const savedModel = Storage.get('selectedModel', 'sonnet');
document.getElementById('modelSelect').value = savedModel;

// Save model preference when changed
document.getElementById('modelSelect').addEventListener('change', function() {
    Storage.set('selectedModel', this.value);
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

// ========== FAVORITE PROMPTS ==========
let favoritePrompts = Storage.get('favoritePrompts', []);

function displayFavorites() {
    const favoritesList = document.getElementById('favoritesList');
    favoritesList.textContent = '';

    if (favoritePrompts.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'favorites-empty';
        emptyDiv.textContent = 'No favorites yet. Click + to add.';
        favoritesList.appendChild(emptyDiv);
        return;
    }

    favoritePrompts.forEach((fav, index) => {
        const favItem = document.createElement('div');
        favItem.className = 'favorite-item';

        const textBtn = document.createElement('button');
        textBtn.className = 'favorite-text';
        textBtn.textContent = fav.name;
        textBtn.title = fav.prompt;
        textBtn.addEventListener('click', () => {
            messageInput.value = fav.prompt;
            messageInput.focus();
            messageInput.dispatchEvent(new Event('input'));
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Remove favorite';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            favoritePrompts.splice(index, 1);
            Storage.set('favoritePrompts', favoritePrompts);
            displayFavorites();
        });

        favItem.appendChild(textBtn);
        favItem.appendChild(deleteBtn);
        favoritesList.appendChild(favItem);
    });
}

document.getElementById('addFavoriteBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const name = prompt('Enter a name for this favorite:');
    if (!name) return;

    const promptText = prompt('Enter the prompt text:');
    if (!promptText) return;

    favoritePrompts.push({ name, prompt: promptText });
    Storage.set('favoritePrompts', favoritePrompts);
    displayFavorites();
});

// ========== RECENT PROJECTS ==========
let recentProjects = Storage.get('recentProjects', []);

function displayProjects() {
    const projectsList = document.getElementById('projectsList');
    projectsList.textContent = '';

    if (recentProjects.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'projects-empty';
        emptyDiv.textContent = 'No projects yet. Click + to add.';
        projectsList.appendChild(emptyDiv);
        return;
    }

    recentProjects.slice(0, 5).forEach((project, index) => {
        const projectItem = document.createElement('div');
        projectItem.className = 'project-item';

        const projectBtn = document.createElement('button');
        projectBtn.className = 'project-text';

        const projectName = document.createElement('div');
        projectName.className = 'project-name';
        projectName.textContent = project.name;

        const projectMeta = document.createElement('div');
        projectMeta.className = 'project-meta';
        projectMeta.textContent = project.location || 'No location';

        projectBtn.appendChild(projectName);
        projectBtn.appendChild(projectMeta);

        projectBtn.addEventListener('click', () => {
            messageInput.value = `Tell me about the ${project.name} project` +
                (project.location ? ` in ${project.location}` : '');
            messageInput.focus();
            messageInput.dispatchEvent(new Event('input'));
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Remove project';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            recentProjects.splice(index, 1);
            Storage.set('recentProjects', recentProjects);
            displayProjects();
        });

        projectItem.appendChild(projectBtn);
        projectItem.appendChild(deleteBtn);
        projectsList.appendChild(projectItem);
    });
}

document.getElementById('addProjectBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const name = prompt('Enter project name:');
    if (!name) return;

    const location = prompt('Enter location (building/floor):');

    const project = {
        name,
        location: location || '',
        date: new Date().toISOString()
    };

    recentProjects.unshift(project);

    if (recentProjects.length > 10) {
        recentProjects = recentProjects.slice(0, 10);
    }

    Storage.set('recentProjects', recentProjects);
    displayProjects();
});

// Load favorites and projects on page load
displayFavorites();
displayProjects();

// ========== CONVERSATION HISTORY ==========
let conversations = Storage.get('conversations', []);
let currentConversationId = null;
let currentMessages = [];

function saveCurrentConversation() {
    // Validate currentMessages
    if (!Array.isArray(currentMessages) || currentMessages.length === 0) {
        console.log('No messages to save');
        return;
    }

    try {
        // Get the first user message as the title
        const firstUserMsg = currentMessages.find(m => m && m.role === 'user' && m.text);
        const title = firstUserMsg ? firstUserMsg.text.substring(0, 50) : 'New conversation';

        const conversation = {
            id: currentConversationId || Date.now().toString(),
            title: title,
            messages: currentMessages,
            date: new Date().toISOString()
        };

        // Update or add conversation
        const existingIndex = conversations.findIndex(c => c.id === conversation.id);
        if (existingIndex >= 0) {
            conversations[existingIndex] = conversation;
            console.log(`Updated conversation ${conversation.id}`);
        } else {
            conversations.unshift(conversation);
            console.log(`Created new conversation ${conversation.id}`);
        }

        // Keep only last 20 conversations
        if (conversations.length > 20) {
            conversations = conversations.slice(0, 20);
        }

        currentConversationId = conversation.id;
        const saved = Storage.set('conversations', conversations);

        if (saved) {
            console.log(`Saved conversation with ${currentMessages.length} messages`);
        } else {
            console.error('Failed to save conversation to storage');
        }

        displayConversations();
    } catch (error) {
        console.error('Error in saveCurrentConversation:', error);
    }
}

function displayConversations() {
    const historyList = document.getElementById('historyList');
    historyList.textContent = '';

    if (conversations.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'history-empty';
        emptyDiv.textContent = 'No conversations yet';
        historyList.appendChild(emptyDiv);
        return;
    }

    conversations.forEach(conv => {
        const historyItem = document.createElement('button');
        historyItem.className = 'history-item';
        if (conv.id === currentConversationId) {
            historyItem.classList.add('active');
        }

        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('fill', 'none');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z');
        path.setAttribute('stroke', 'currentColor');
        path.setAttribute('stroke-width', '2');
        icon.appendChild(path);

        const span = document.createElement('span');
        span.textContent = conv.title;

        historyItem.appendChild(icon);
        historyItem.appendChild(span);

        historyItem.addEventListener('click', () => {
            loadConversation(conv.id);
        });

        historyList.appendChild(historyItem);
    });
}

function loadConversation(id) {
    try {
        const conversation = conversations.find(c => c.id === id);
        if (!conversation) {
            console.error(`Conversation ${id} not found`);
            return;
        }

        // Validate messages array
        if (!Array.isArray(conversation.messages)) {
            console.error('Invalid messages array in conversation');
            return;
        }

        currentConversationId = id;
        currentMessages = conversation.messages;

        console.log(`Loading conversation ${id} with ${currentMessages.length} messages`);

        // Clear chat and reload messages
        chatContainer.innerHTML = '';
        conversation.messages.forEach(msg => {
            if (msg && msg.text && msg.role) {
                addMessage(msg.text, msg.role, false);
            }
        });

        displayConversations();
    } catch (error) {
        console.error('Error loading conversation:', error);
        addMessage('Error loading conversation. The data may be corrupted.', 'assistant');
    }
}

// Initialize
displayConversations();

// Auto-save conversation every 30 seconds (with logging)
setInterval(() => {
    if (Array.isArray(currentMessages) && currentMessages.length > 0) {
        console.log(`Auto-save triggered with ${currentMessages.length} messages`);
        saveCurrentConversation();
    }
}, 30000);

// Save conversation before page unload
window.addEventListener('beforeunload', () => {
    if (Array.isArray(currentMessages) && currentMessages.length > 0) {
        console.log('Saving conversation before page unload');
        saveCurrentConversation();
    }
});

// ========== TABBED SECTION (AGENTS & SKILLS) ==========
// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const tabName = this.getAttribute('data-tab');

        // Remove active class from all tabs and contents
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        // Add active class to clicked tab and corresponding content
        this.classList.add('active');
        document.getElementById(tabName + 'Tab').classList.add('active');

        // Save preference
        Storage.set('activeTab', tabName);
    });
});

// Restore last active tab
const savedTab = Storage.get('activeTab', 'agents');
const savedTabBtn = document.querySelector(`.tab-btn[data-tab="${savedTab}"]`);
if (savedTabBtn) {
    savedTabBtn.click();
}

// ========== AGENTS SECTION ==========
document.querySelectorAll('.agent-item').forEach(btn => {
    btn.addEventListener('click', function() {
        const agentType = this.getAttribute('data-agent');
        const agentName = this.querySelector('span').textContent;

        // Add a message to the input with agent selection
        messageInput.value = `@${agentType} `;
        messageInput.focus();
        messageInput.dispatchEvent(new Event('input'));

        addMessage(`Selected agent: ${agentName}`, 'assistant');
    });
});

// ========== SETTINGS MODAL ==========
const settingsModal = document.getElementById('settingsModal');
const settingsBtn = document.querySelector('.settings-btn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');

// Open settings modal
document.querySelector('.settings-btn').addEventListener('click', () => {
    settingsModal.style.display = 'flex';
});

// Close settings modal
closeSettingsBtn.addEventListener('click', () => {
    settingsModal.style.display = 'none';
});

// Close modal when clicking outside
settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        settingsModal.style.display = 'none';
    }
});

// Load current default model
const defaultModelSelect = document.getElementById('defaultModelSelect');
defaultModelSelect.value = Storage.get('selectedModel', 'sonnet');

// Save default model
defaultModelSelect.addEventListener('change', () => {
    const model = defaultModelSelect.value;
    Storage.set('selectedModel', model);
    document.getElementById('modelSelect').value = model;
    addMessage(`✓ Default model set to ${defaultModelSelect.options[defaultModelSelect.selectedIndex].text}`, 'assistant');
});

// Export data
document.getElementById('exportDataBtn').addEventListener('click', () => {
    const data = {
        favoritePrompts,
        recentProjects,
        exportDate: new Date().toISOString(),
        version: '1.0.0'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `claude-code-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    addMessage('✓ Exported favorites and projects', 'assistant');
});

// Import data
document.getElementById('importDataBtn').addEventListener('click', () => {
    document.getElementById('importFileInput').click();
});

document.getElementById('importFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);

            if (data.favoritePrompts) {
                favoritePrompts = data.favoritePrompts;
                Storage.set('favoritePrompts', favoritePrompts);
                displayFavorites();
            }

            if (data.recentProjects) {
                recentProjects = data.recentProjects;
                Storage.set('recentProjects', recentProjects);
                displayProjects();
            }

            addMessage(`✓ Imported ${data.favoritePrompts?.length || 0} favorites and ${data.recentProjects?.length || 0} projects`, 'assistant');
            settingsModal.style.display = 'none';
        } catch (error) {
            addMessage('✗ Failed to import data: Invalid file format', 'assistant');
        }
    };
    reader.readAsText(file);

    // Reset input
    e.target.value = '';
});

// ========== HEADER BUTTONS ==========

// Clear chat
document.getElementById('clearChatBtn').addEventListener('click', () => {
    // Save current conversation before clearing
    if (currentMessages.length > 0) {
        saveCurrentConversation();
    }

    if (confirm('Clear the current conversation? (It will be saved to Recent Conversations)')) {
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
                <p class="welcome-hint">Select an agent or skill from the sidebar to get started, or just type your question below.</p>
            </div>
        `;

        // Start new conversation
        currentConversationId = null;
        currentMessages = [];
    }
});

// Export conversation
document.getElementById('exportChatBtn').addEventListener('click', () => {
    const messages = Array.from(chatContainer.querySelectorAll('.message')).map(msg => {
        const role = msg.classList.contains('message-user') ? 'User' : 'Assistant';
        const content = msg.querySelector('.message-content').textContent;
        return `${role}: ${content}`;
    }).join('\n\n');

    if (!messages || messages.trim() === '') {
        addMessage('No conversation to export', 'assistant');
        return;
    }

    const blob = new Blob([messages], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `claude-conversation-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    addMessage('✓ Conversation exported', 'assistant');
});

// More options menu
const moreOptionsBtn = document.getElementById('moreOptionsBtn');
const moreMenu = document.getElementById('moreMenu');

moreOptionsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    moreMenu.classList.toggle('show');
});

// Close menu when clicking outside
document.addEventListener('click', () => {
    moreMenu.classList.remove('show');
});

// Copy last response
document.getElementById('copyLastResponseBtn').addEventListener('click', () => {
    const messages = chatContainer.querySelectorAll('.message-assistant');
    if (messages.length === 0) {
        addMessage('No assistant responses to copy', 'assistant');
        return;
    }

    const lastMessage = messages[messages.length - 1];
    const content = lastMessage.querySelector('.message-content').textContent;

    navigator.clipboard.writeText(content).then(() => {
        addMessage('✓ Copied last response to clipboard', 'assistant');
    }).catch(() => {
        addMessage('✗ Failed to copy to clipboard', 'assistant');
    });
});

// Open in new window
document.getElementById('newWindowBtn').addEventListener('click', () => {
    window.open(window.location.href, '_blank', 'width=1200,height=800');
});

// ========== DEBUG PANEL ==========
document.getElementById('viewDebugBtn').addEventListener('click', () => {
    const debugInfo = document.getElementById('debugInfo');
    const isVisible = debugInfo.style.display !== 'none';

    if (isVisible) {
        debugInfo.style.display = 'none';
        return;
    }

    try {
        const info = {
            'Conversations Count': conversations.length,
            'Current Conversation ID': currentConversationId || 'None',
            'Current Messages Count': currentMessages.length,
            'Favorite Prompts Count': favoritePrompts.length,
            'Recent Projects Count': recentProjects.length,
            'LocalStorage Used': (() => {
                let total = 0;
                for (let key in localStorage) {
                    if (localStorage.hasOwnProperty(key)) {
                        total += localStorage[key].length + key.length;
                    }
                }
                return `${(total / 1024).toFixed(2)} KB`;
            })(),
            'LocalStorage Keys': Object.keys(localStorage).join(', ')
        };

        let html = '<strong>Storage Debug Info:</strong><br><br>';
        for (let [key, value] of Object.entries(info)) {
            html += `<strong>${key}:</strong> ${value}<br>`;
        }

        // Add conversation titles
        if (conversations.length > 0) {
            html += '<br><strong>Conversations:</strong><br>';
            conversations.slice(0, 5).forEach(conv => {
                html += `- ${conv.title} (${conv.messages.length} msgs, ${new Date(conv.date).toLocaleString()})<br>`;
            });
            if (conversations.length > 5) {
                html += `... and ${conversations.length - 5} more<br>`;
            }
        }

        debugInfo.innerHTML = html;
        debugInfo.style.display = 'block';
    } catch (error) {
        debugInfo.innerHTML = `<strong>Error:</strong> ${error.message}`;
        debugInfo.style.display = 'block';
    }
});

document.getElementById('clearAllDataBtn').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear ALL data? This cannot be undone.')) {
        try {
            localStorage.clear();
            conversations = [];
            currentConversationId = null;
            currentMessages = [];
            favoritePrompts = [];
            recentProjects = [];

            displayConversations();
            displayFavorites();
            displayProjects();

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
                </div>
            `;

            addMessage('✓ All data cleared successfully', 'assistant');
            console.log('All data cleared');
        } catch (error) {
            addMessage('✗ Error clearing data: ' + error.message, 'assistant');
            console.error('Error clearing data:', error);
        }
    }
});
