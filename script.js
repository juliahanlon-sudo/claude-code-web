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

    // Maintain one Claude Code session per conversation so it remembers
    // context across messages. First message of a conversation starts a new
    // session; later messages resume it.
    const isNewSession = !currentSessionId;
    if (isNewSession) {
        currentSessionId = crypto.randomUUID();
    }

    // Show an animated thinking indicator so it's clear work is happening
    const thinking = startThinkingIndicator();

    fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message,
            model: selectedModel,
            sessionId: currentSessionId,
            resume: !isNewSession
        })
    })
    .then(response => response.json())
    .then(data => {
        thinking.stop();

        if (data.error) {
            addMessage('Error: ' + data.error, 'assistant');
        } else {
            addMessage(data.response, 'assistant');
        }
    })
    .catch(error => {
        thinking.stop();
        addMessage('Connection error. Make sure the server is running with: node server.js', 'assistant');
        console.error('Error:', error);
    });
}

// Animated "thinking" indicator: a spinner with a status line that cycles
// through what's happening and shows elapsed time, so the user never wonders
// whether it's stuck. Returns a handle with stop() to remove it.
function startThinkingIndicator() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message message-assistant message-thinking';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" stroke="currentColor" stroke-width="2"/>
        </svg>
    `;
    avatar.style.background = '#F3F3F3';
    avatar.style.color = '#0176D3';

    const content = document.createElement('div');
    content.className = 'message-content thinking-content';
    content.innerHTML = `
        <span class="thinking-spinner" aria-hidden="true"></span>
        <span class="thinking-status">Thinking</span>
        <span class="thinking-elapsed"></span>
    `;

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    const statusEl = content.querySelector('.thinking-status');
    const elapsedEl = content.querySelector('.thinking-elapsed');

    // Status messages escalate over time so it stays reassuring on long runs
    const stages = [
        { after: 0,  text: 'Sending to Claude Code' },
        { after: 3,  text: 'Claude is thinking' },
        { after: 10, text: 'Working on your request' },
        { after: 25, text: 'Still working — complex requests can take a bit' },
        { after: 60, text: 'Hang tight, this is a long one' }
    ];

    const startTime = Date.now();
    const tick = () => {
        const seconds = Math.floor((Date.now() - startTime) / 1000);
        let label = stages[0].text;
        for (const stage of stages) {
            if (seconds >= stage.after) label = stage.text;
        }
        statusEl.textContent = label;
        elapsedEl.textContent = seconds > 0 ? ` · ${seconds}s` : '';
    };
    tick();
    const timer = setInterval(tick, 1000);

    return {
        stop() {
            clearInterval(timer);
            messageDiv.remove();
        }
    };
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

    // Start fresh conversation (new Claude Code session too)
    currentConversationId = null;
    currentMessages = [];
    currentSessionId = null;
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

// ========== VIEW SWITCHING ==========
document.querySelectorAll('.view-tab').forEach(tab => {
    tab.addEventListener('click', function() {
        const viewName = this.getAttribute('data-view');

        // Update tab states
        document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');

        // Update view visibility
        document.querySelectorAll('.view-content').forEach(v => v.classList.remove('active'));
        document.getElementById(viewName + 'View').classList.add('active');

        // Render content based on view
        if (viewName === 'agents') {
            renderAgentsGrid();
        } else if (viewName === 'skills') {
            // Check if skills are loaded
            if (allSkills && allSkills.length > 0) {
                renderSkillsPage();
            } else {
                // Show loading and fetch skills
                const grid = document.getElementById('skillsPageGrid');
                grid.innerHTML = '<p style="text-align: center; color: var(--sf-gray-6); padding: var(--spacing-2xl);">Loading skills...</p>';
                loadSkills();
            }
        }
    });
});

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
    console.log('Loading skills from API...');
    fetch(SKILLS_URL)
        .then(response => response.json())
        .then(data => {
            allSkills = data.skills || [];
            console.log(`Loaded ${allSkills.length} skills`);
            // Always render if Skills page is active
            const skillsView = document.getElementById('skillsView');
            if (skillsView && skillsView.classList.contains('active')) {
                console.log('Rendering skills page...');
                renderSkillsPage();
            }
        })
        .catch(error => {
            console.error('Error loading skills:', error);
            const grid = document.getElementById('skillsPageGrid');
            if (grid) {
                grid.innerHTML = '<p style="text-align: center; color: var(--sf-error); padding: var(--spacing-2xl);">Failed to load skills: ' + error.message + '</p>';
            }
        });
}

// Old sidebar skills code removed - now using full Skills page

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
// Claude Code session id for the active conversation (enables context memory)
let currentSessionId = null;

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
            sessionId: currentSessionId,
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
        // Restore the Claude Code session so resuming keeps its memory
        currentSessionId = conversation.sessionId || null;

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

// ========== AGENTS SECTION ==========
let customAgents = Storage.get('customAgents', []);
let editingAgentId = null;
let agentSchedules = {}; // Store active setInterval IDs
let currentAgentIcon = '🤖';
let currentAgentServices = [];

// Helper function to generate agent type from name
function generateAgentType(name) {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

// Icon picker functionality
document.getElementById('currentIcon').addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = document.getElementById('iconPickerDropdown');
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
});

document.querySelectorAll('.icon-option').forEach(btn => {
    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const icon = this.getAttribute('data-icon');
        currentAgentIcon = icon;
        document.getElementById('currentIcon').textContent = icon;
        document.getElementById('iconPickerDropdown').style.display = 'none';
    });
});

// Close icon picker when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.icon-picker')) {
        document.getElementById('iconPickerDropdown').style.display = 'none';
    }
});

// Service connection management
const serviceTemplates = {
    airtable: {
        name: 'Airtable',
        icon: '🗂️',
        fields: [
            { id: 'apiKey', label: 'API Key', type: 'password', placeholder: 'pat...', required: true },
            { id: 'baseId', label: 'Base ID', type: 'text', placeholder: 'app...', required: true },
            { id: 'tables', label: 'Table Names', type: 'text', placeholder: 'Table1, Table2' }
        ]
    },
    salesforce: {
        name: 'Salesforce',
        icon: '☁️',
        fields: [
            { id: 'instanceUrl', label: 'Instance URL', type: 'text', placeholder: 'https://yourinstance.salesforce.com', required: true },
            { id: 'accessToken', label: 'Access Token', type: 'password', required: true }
        ]
    },
    github: {
        name: 'GitHub',
        icon: '🐙',
        fields: [
            { id: 'token', label: 'Personal Access Token', type: 'password', placeholder: 'ghp_...', required: true },
            { id: 'repo', label: 'Repository', type: 'text', placeholder: 'owner/repo' }
        ]
    },
    slack: {
        name: 'Slack',
        icon: '💬',
        fields: [
            { id: 'webhookUrl', label: 'Webhook URL', type: 'password', placeholder: 'https://hooks.slack.com/...', required: true },
            { id: 'channel', label: 'Channel', type: 'text', placeholder: '#general' }
        ]
    },
    custom: {
        name: 'Custom API',
        icon: '🔧',
        fields: [
            { id: 'url', label: 'API URL', type: 'text', placeholder: 'https://api.example.com', required: true },
            { id: 'apiKey', label: 'API Key', type: 'password' },
            { id: 'headers', label: 'Custom Headers (JSON)', type: 'textarea', placeholder: '{"Authorization": "Bearer ..."}' }
        ]
    }
};

// Add service connection button
document.getElementById('addServiceBtn').addEventListener('click', () => {
    document.getElementById('serviceModal').style.display = 'flex';
    document.querySelector('.service-templates').style.display = 'block';
    document.getElementById('serviceForm').style.display = 'none';
});

// Service template selection
document.querySelectorAll('.service-template').forEach(btn => {
    btn.addEventListener('click', function() {
        const serviceType = this.getAttribute('data-service');
        const template = serviceTemplates[serviceType];

        // Hide templates, show form
        document.querySelector('.service-templates').style.display = 'none';
        document.getElementById('serviceForm').style.display = 'block';
        document.getElementById('serviceType').value = serviceType;

        // Populate form fields
        const fieldsContainer = document.getElementById('serviceFields');
        fieldsContainer.innerHTML = '';

        template.fields.forEach(field => {
            const formGroup = document.createElement('div');
            formGroup.className = 'form-group';

            const label = document.createElement('label');
            label.setAttribute('for', 'service_' + field.id);
            label.textContent = field.label + (field.required ? ' *' : '');

            let input;
            if (field.type === 'textarea') {
                input = document.createElement('textarea');
                input.rows = 3;
            } else {
                input = document.createElement('input');
                input.type = field.type;
            }

            input.id = 'service_' + field.id;
            input.placeholder = field.placeholder || '';
            if (field.required) input.required = true;

            formGroup.appendChild(label);
            formGroup.appendChild(input);
            fieldsContainer.appendChild(formGroup);
        });
    });
});

// Save service connection
document.getElementById('saveServiceBtn').addEventListener('click', () => {
    const serviceType = document.getElementById('serviceType').value;
    const template = serviceTemplates[serviceType];
    const serviceName = document.getElementById('serviceName').value.trim();

    if (!serviceName) {
        alert('Please enter a connection name');
        return;
    }

    // Collect field values
    const config = {};
    let hasError = false;

    template.fields.forEach(field => {
        const input = document.getElementById('service_' + field.id);
        const value = input.value.trim();

        if (field.required && !value) {
            alert(`${field.label} is required`);
            hasError = true;
            return;
        }

        if (value) {
            config[field.id] = value;
        }
    });

    if (hasError) return;

    // Add to current agent services
    currentAgentServices.push({
        id: Date.now().toString(),
        type: serviceType,
        name: serviceName,
        icon: template.icon,
        config: config
    });

    // Update UI
    renderAgentServices();

    // Close modal
    document.getElementById('serviceModal').style.display = 'none';
    document.getElementById('serviceForm').reset();
});

// Cancel service connection
document.getElementById('cancelServiceBtn').addEventListener('click', () => {
    document.getElementById('serviceModal').style.display = 'none';
    document.getElementById('serviceForm').reset();
});

document.getElementById('closeServiceModalBtn').addEventListener('click', () => {
    document.getElementById('serviceModal').style.display = 'none';
});

// Render agent services in the form
function renderAgentServices() {
    const container = document.getElementById('serviceConnections');

    // Clear and re-add the add button
    container.innerHTML = '';

    // Add existing services
    currentAgentServices.forEach(service => {
        const item = document.createElement('div');
        item.className = 'service-connection-item';
        item.innerHTML = `
            <div class="service-connection-info">
                <div class="service-connection-icon">${service.icon}</div>
                <div class="service-connection-details">
                    <h4>${service.name}</h4>
                    <p>${serviceTemplates[service.type].name}</p>
                </div>
            </div>
            <button type="button" class="service-connection-remove" onclick="removeService('${service.id}')">Remove</button>
        `;
        container.appendChild(item);
    });

    // Add the "Add Service" button
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-add-service';
    addBtn.id = 'addServiceBtn';
    addBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14m7-7H5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        Add Service Connection
    `;
    addBtn.addEventListener('click', () => {
        document.getElementById('serviceModal').style.display = 'flex';
        document.querySelector('.service-templates').style.display = 'block';
        document.getElementById('serviceForm').style.display = 'none';
    });
    container.appendChild(addBtn);
}

// Remove service (global function for onclick)
window.removeService = function(serviceId) {
    currentAgentServices = currentAgentServices.filter(s => s.id !== serviceId);
    renderAgentServices();
};

// Open agent modal
function openAgentModal(agent = null) {
    const modal = document.getElementById('agentModal');
    const title = document.getElementById('agentModalTitle');
    const form = document.getElementById('agentForm');

    if (agent) {
        // Edit mode
        title.textContent = 'Edit Custom Agent';
        document.getElementById('agentName').value = agent.name;
        document.getElementById('agentDescription').value = agent.description || '';
        document.getElementById('agentPrompt').value = agent.prompt;
        document.getElementById('agentModel').value = agent.model || '';

        // Icon
        currentAgentIcon = agent.icon || '🤖';
        document.getElementById('currentIcon').textContent = currentAgentIcon;

        // Services
        currentAgentServices = agent.services || [];
        renderAgentServices();

        // Schedule options
        if (agent.schedule && agent.schedule.enabled) {
            document.getElementById('agentScheduleEnabled').checked = true;
            document.getElementById('agentScheduleValue').value = agent.schedule.value;
            document.getElementById('agentScheduleUnit').value = agent.schedule.unit;
            document.getElementById('agentScheduleInput').value = agent.schedule.input || '';
            document.getElementById('scheduleOptions').style.display = 'block';
        } else {
            document.getElementById('agentScheduleEnabled').checked = false;
            document.getElementById('scheduleOptions').style.display = 'none';
        }
    } else {
        // Create mode
        title.textContent = 'Create Custom Agent';
        form.reset();
        editingAgentId = null;
        currentAgentIcon = '🤖';
        document.getElementById('currentIcon').textContent = currentAgentIcon;
        currentAgentServices = [];
        renderAgentServices();
        document.getElementById('scheduleOptions').style.display = 'none';
    }

    modal.style.display = 'flex';
}

// Close agent modal
function closeAgentModal() {
    document.getElementById('agentModal').style.display = 'none';
    document.getElementById('agentForm').reset();
    editingAgentId = null;
}

// Toggle schedule options
document.getElementById('agentScheduleEnabled').addEventListener('change', function() {
    document.getElementById('scheduleOptions').style.display = this.checked ? 'block' : 'none';
});

// Close modal buttons
document.getElementById('closeAgentModalBtn').addEventListener('click', closeAgentModal);
document.getElementById('cancelAgentBtn').addEventListener('click', closeAgentModal);

// Close modal when clicking outside
document.getElementById('agentModal').addEventListener('click', (e) => {
    if (e.target.id === 'agentModal') {
        closeAgentModal();
    }
});

// Save agent form
document.getElementById('agentForm').addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('agentName').value.trim();
    const description = document.getElementById('agentDescription').value.trim();
    const prompt = document.getElementById('agentPrompt').value.trim();
    const model = document.getElementById('agentModel').value;

    if (!name || !prompt) {
        addMessage('✗ Please fill in all required fields', 'assistant');
        return;
    }

    // Auto-generate type from name
    const type = generateAgentType(name);

    if (!type) {
        addMessage('✗ Agent name must contain at least one letter or number', 'assistant');
        return;
    }

    // Schedule settings
    const scheduleEnabled = document.getElementById('agentScheduleEnabled').checked;
    let schedule = null;

    if (scheduleEnabled) {
        const scheduleValue = parseInt(document.getElementById('agentScheduleValue').value);
        const scheduleUnit = document.getElementById('agentScheduleUnit').value;
        const scheduleInput = document.getElementById('agentScheduleInput').value.trim();

        if (!scheduleValue || scheduleValue < 1) {
            addMessage('✗ Schedule interval must be at least 1', 'assistant');
            return;
        }

        schedule = {
            enabled: true,
            value: scheduleValue,
            unit: scheduleUnit,
            input: scheduleInput
        };
    }

    const agent = {
        id: editingAgentId || Date.now().toString(),
        name,
        type,
        description,
        prompt,
        model,
        icon: currentAgentIcon,
        services: currentAgentServices,
        schedule,
        created: editingAgentId ? customAgents.find(a => a.id === editingAgentId).created : new Date().toISOString(),
        modified: new Date().toISOString()
    };

    if (editingAgentId) {
        // Update existing
        const index = customAgents.findIndex(a => a.id === editingAgentId);
        customAgents[index] = agent;
        addMessage(`✓ Updated agent: ${name}`, 'assistant');
    } else {
        // Check for duplicate type (only for new agents, not when editing)
        if (customAgents.some(a => a.type === type)) {
            addMessage(`✗ An agent with a similar name already exists`, 'assistant');
            return;
        }
        // Add new
        customAgents.push(agent);
        addMessage(`✓ Created agent: ${name}${schedule ? ' with schedule' : ''}`, 'assistant');
    }

    Storage.set('customAgents', customAgents);
    renderAgentsGrid();
    closeAgentModal();
});

// Setup agent schedules
function setupAgentSchedules() {
    // Clear all existing schedules
    Object.values(agentSchedules).forEach(intervalId => clearInterval(intervalId));
    agentSchedules = {};

    // Setup schedules for agents with scheduling enabled
    customAgents.forEach(agent => {
        if (agent.schedule && agent.schedule.enabled) {
            // Convert to milliseconds
            let intervalMs;
            switch (agent.schedule.unit) {
                case 'minutes':
                    intervalMs = agent.schedule.value * 60 * 1000;
                    break;
                case 'hours':
                    intervalMs = agent.schedule.value * 60 * 60 * 1000;
                    break;
                case 'days':
                    intervalMs = agent.schedule.value * 24 * 60 * 60 * 1000;
                    break;
                default:
                    intervalMs = agent.schedule.value * 60 * 1000; // Default to minutes
            }

            // Don't allow intervals less than 1 minute for safety
            if (intervalMs < 60000) {
                console.warn(`Agent ${agent.name} schedule too frequent, minimum is 1 minute`);
                intervalMs = 60000;
            }

            // Create the scheduled task
            const intervalId = setInterval(() => {
                console.log(`Running scheduled agent: ${agent.name}`);

                // Construct the message to send
                const message = agent.schedule.input || agent.prompt || `Run agent: ${agent.name}`;

                // Add a system message
                addMessage(`🤖 Scheduled: "${agent.name}" - ${message}`, 'assistant');

                // Note: Scheduled agents are just for notifications now
                // The actual agent execution would happen via the Claude Code CLI
                // which this web interface doesn't directly control

                console.log(`Scheduled agent ${agent.name} executed with message: ${message}`);

            }, intervalMs);

            agentSchedules[agent.id] = intervalId;
            console.log(`Scheduled agent "${agent.name}" to run every ${agent.schedule.value} ${agent.schedule.unit}`);
        }
    });

    // Update the schedule alert
    updatePageScheduleAlert();
}


// Render agents in grid view
function renderAgentsGrid() {
    const grid = document.getElementById('agentsGridView');
    grid.innerHTML = '';

    // Built-in agents
    const builtInAgents = [
        { name: 'General Purpose', type: 'general-purpose', description: 'Multi-step tasks and research', builtin: true },
        { name: 'Code Explorer', type: 'Explore', description: 'Fast read-only code search', builtin: true },
        { name: 'Code Reviewer', type: 'code-reviewer', description: 'Thorough code review', builtin: true },
        { name: 'Researcher', type: 'aisuite:researcher', description: 'Internal Salesforce data research', builtin: true }
    ];

    // Render all agents
    [...builtInAgents, ...customAgents].forEach(agent => {
        const card = document.createElement('div');
        card.className = 'agent-card';
        if (!agent.builtin) card.classList.add('custom');
        if (agent.schedule && agent.schedule.enabled) card.classList.add('scheduled');

        const badges = [];
        if (!agent.builtin) badges.push('<span class="agent-badge custom">⭐ Custom</span>');
        if (agent.schedule && agent.schedule.enabled) {
            badges.push(`<span class="agent-badge scheduled">⏱️ Scheduled</span>`);
        }

        const scheduleInfo = agent.schedule && agent.schedule.enabled
            ? `<div class="agent-info-item">
                <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                Runs every ${agent.schedule.value} ${agent.schedule.unit}
               </div>`
            : '';

        const modelInfo = agent.model
            ? `<div class="agent-info-item">
                <svg viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" stroke="currentColor" stroke-width="2"/></svg>
                ${agent.model.charAt(0).toUpperCase() + agent.model.slice(1)}
               </div>`
            : '';

        const actions = agent.builtin
            ? `<button class="agent-card-btn primary" onclick="useAgent('${agent.type}', '${agent.name}')">
                <svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Use Agent
               </button>`
            : `<button class="agent-card-btn primary" onclick="useAgent('${agent.type}', '${agent.name}', '${agent.id}')">
                <svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Use
               </button>
               <button class="agent-card-btn" onclick="editAgentFromGrid('${agent.id}')">
                <svg viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/></svg>
                Edit
               </button>
               <button class="agent-card-btn danger" onclick="deleteAgentFromGrid('${agent.id}', '${agent.name}')">
                <svg viewBox="0 0 24 24" fill="none"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2"/></svg>
                Delete
               </button>`;

        const serviceInfo = agent.services && agent.services.length > 0
            ? `<div class="agent-info-item" style="color: var(--sf-success);">
                <svg viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                ${agent.services.length} service${agent.services.length > 1 ? 's' : ''} connected
               </div>`
            : '';

        card.innerHTML = `
            <div class="agent-card-header">
                <div class="agent-card-title">
                    <div class="agent-card-icon" style="font-size: 24px;">
                        ${agent.icon || '🤖'}
                    </div>
                    <div class="agent-card-name">
                        <h3>${agent.name}</h3>
                        <div class="agent-card-type">@${agent.type}</div>
                    </div>
                </div>
                <div class="agent-card-badges">
                    ${badges.join('')}
                </div>
            </div>
            <div class="agent-card-body">
                <div class="agent-card-description">
                    ${agent.description || agent.prompt || 'No description'}
                </div>
                <div class="agent-card-info">
                    ${serviceInfo}
                    ${scheduleInfo}
                    ${modelInfo}
                </div>
            </div>
            <div class="agent-card-footer">
                ${actions}
            </div>
        `;

        grid.appendChild(card);
    });

    // Update schedule alert
    updatePageScheduleAlert();
}

// Global functions for onclick handlers
window.useAgent = function(type, name, id) {
    // Switch to chat view
    document.querySelector('.view-tab[data-view="chat"]').click();

    // Find agent and use its prompt
    const agent = customAgents.find(a => a.id === id);
    if (agent && agent.prompt) {
        messageInput.value = agent.prompt;
    } else {
        messageInput.value = `@${type} `;
    }
    messageInput.focus();
    messageInput.dispatchEvent(new Event('input'));
    addMessage(`Using agent: ${name}`, 'assistant');
};

window.editAgentFromGrid = function(id) {
    const agent = customAgents.find(a => a.id === id);
    if (agent) {
        editingAgentId = id;
        openAgentModal(agent);
    }
};

window.deleteAgentFromGrid = function(id, name) {
    if (confirm(`Delete agent "${name}"?`)) {
        customAgents = customAgents.filter(a => a.id !== id);
        Storage.set('customAgents', customAgents);
        renderAgentsGrid();
        addMessage(`✓ Deleted agent: ${name}`, 'assistant');
    }
};

// Update page schedule alert
function updatePageScheduleAlert() {
    const activeCount = Object.keys(agentSchedules).length;
    const alert = document.getElementById('activeSchedulesPageAlert');
    const countSpan = document.getElementById('activeSchedulesPageCount');

    if (activeCount > 0) {
        alert.style.display = 'block';
        countSpan.textContent = activeCount;
    } else {
        alert.style.display = 'none';
    }
}

// Connect create agent button in page view
document.getElementById('createAgentPageBtn').addEventListener('click', () => {
    openAgentModal();
});

// Connect stop all button in page view
document.getElementById('stopAllSchedulesPageBtn').addEventListener('click', () => {
    if (confirm('Stop all scheduled agents? This will disable their schedules permanently.')) {
        // Clear the intervals
        Object.values(agentSchedules).forEach(intervalId => clearInterval(intervalId));
        agentSchedules = {};

        // Disable schedules in all agents
        customAgents.forEach(agent => {
            if (agent.schedule && agent.schedule.enabled) {
                agent.schedule.enabled = false;
            }
        });

        // Save the updated agents
        Storage.set('customAgents', customAgents);

        // Update the UI
        updatePageScheduleAlert();
        renderAgentsGrid();

        addMessage('✓ All scheduled agents stopped and disabled', 'assistant');
        console.log('All agent schedules stopped and disabled');
    }
});

// Setup schedules on page load
setupAgentSchedules();

// Stop all schedules when page unloads
window.addEventListener('beforeunload', () => {
    Object.values(agentSchedules).forEach(intervalId => clearInterval(intervalId));
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

// ========== SKILLS PAGE ==========
function renderSkillsPage() {
    console.log('renderSkillsPage called, allSkills:', allSkills ? allSkills.length : 'undefined');
    const grid = document.getElementById('skillsPageGrid');
    console.log('Grid element:', grid);

    if (!grid) {
        console.error('Could not find skillsPageGrid element!');
        return;
    }

    grid.innerHTML = '';

    if (!allSkills || allSkills.length === 0) {
        console.log('No skills to display');
        grid.innerHTML = '<p style="text-align: center; color: var(--sf-gray-6); padding: var(--spacing-2xl);">No skills loaded yet...</p>';
        return;
    }

    console.log('Grouping and rendering skills...');

    // Group skills by category
    const grouped = allSkills.reduce((acc, skill) => {
        const category = skill.category || 'general';
        if (!acc[category]) acc[category] = [];
        acc[category].push(skill);
        return acc;
    }, {});

    // Render each category
    Object.entries(grouped).sort(([a], [b]) => {
        if (a === 'my-skills') return -1;
        if (b === 'my-skills') return 1;
        return a.localeCompare(b);
    }).forEach(([category, skills]) => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'skill-category-page';

        const header = document.createElement('div');
        header.className = 'skill-category-page-header';
        if (category === 'my-skills') {
            header.classList.add('my-skills');
            header.textContent = '⭐ My Skills';
        } else {
            header.textContent = category;
        }

        const itemsGrid = document.createElement('div');
        itemsGrid.className = 'skill-items-grid';

        skills.forEach(skill => {
            const card = document.createElement('div');
            card.className = 'skill-card';
            card.onclick = () => {
                // Switch to chat and use skill
                document.querySelector('.view-tab[data-view="chat"]').click();
                messageInput.value = '/' + skill.name + ' ';
                messageInput.focus();
                messageInput.dispatchEvent(new Event('input'));
            };

            card.innerHTML = `
                <div class="skill-card-icon">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="skill-card-info">
                    <div class="skill-card-name">${skill.displayName}</div>
                    <div class="skill-card-namespace">/${skill.name}</div>
                </div>
            `;

            itemsGrid.appendChild(card);
        });

        categoryDiv.appendChild(header);
        categoryDiv.appendChild(itemsGrid);
        grid.appendChild(categoryDiv);
    });
}

// Skills page search
document.getElementById('skillsPageSearch').addEventListener('input', function() {
    const query = this.value.toLowerCase();
    if (!query) {
        renderSkillsPage();
        return;
    }

    const filtered = allSkills.filter(skill =>
        skill.name.toLowerCase().includes(query) ||
        skill.displayName.toLowerCase().includes(query) ||
        (skill.category && skill.category.toLowerCase().includes(query))
    );

    // Render filtered
    const grid = document.getElementById('skillsPageGrid');
    grid.innerHTML = '';

    if (filtered.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: var(--sf-gray-6); padding: var(--spacing-2xl);">No skills found</p>';
        return;
    }

    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'skill-category-page';

    const header = document.createElement('div');
    header.className = 'skill-category-page-header';
    header.textContent = `Search Results (${filtered.length})`;

    const itemsGrid = document.createElement('div');
    itemsGrid.className = 'skill-items-grid';

    filtered.forEach(skill => {
        const card = document.createElement('div');
        card.className = 'skill-card';
        card.onclick = () => {
            document.querySelector('.view-tab[data-view="chat"]').click();
            messageInput.value = '/' + skill.name + ' ';
            messageInput.focus();
            messageInput.dispatchEvent(new Event('input'));
        };

        card.innerHTML = `
            <div class="skill-card-icon">
                <svg viewBox="0 0 24 24" fill="none">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                </svg>
            </div>
            <div class="skill-card-info">
                <div class="skill-card-name">${skill.displayName}</div>
                <div class="skill-card-namespace">/${skill.name}</div>
            </div>
        `;

        itemsGrid.appendChild(card);
    });

    categoryDiv.appendChild(header);
    categoryDiv.appendChild(itemsGrid);
    grid.appendChild(categoryDiv);
});
