# Claude Code Web Interface

A custom web interface for Claude Code with Salesforce Lightning Design System branding and MCP integration.

## Features

✅ **Salesforce Branding**: Official SLDS colors, typography, and design patterns  
✅ **Chat Interface**: Clean conversation UI with Claude Code CLI integration  
✅ **Authentication Status**: Real-time status indicators for Salesforce and Google Workspace  
✅ **Clickable Auth**: One-click authentication for SF (`sf org login`) and Google (MCP `mcp-adaptor auth`)  
✅ **Model Selector**: Switch between Claude models (Sonnet 4.6, Opus 4.8, Haiku 4.5, Fable 5)  
✅ **Skills Browser**: View and execute all available Claude Code skills  
✅ **Custom Skills**: Your custom skills appear first under "⭐ My Skills"  
✅ **Skills Search**: Filter skills by name or category  
✅ **Skill Invocation**: Click any skill to execute it via Claude Code CLI  
✅ **Conversation History**: Track multiple chat sessions  
✅ **Responsive Design**: Works on desktop and mobile devices

## Screenshots

### Main Interface
- Sidebar with conversation history and skills browser
- Chat area with model selector and auth status
- Input box with file attachment support

### Skills Section
- All available skills organized by category
- Custom skills highlighted at the top
- Search functionality for quick access

### Authentication
- Visual indicators for Salesforce and Google Workspace
- Click to authenticate directly from the interface
- Auto-refresh status every 30 seconds

## Prerequisites

- Node.js installed
- Claude Code CLI (`claude`) installed and in PATH
- Salesforce CLI (`sf`) for Salesforce authentication
- MCP Adaptor (`mcp-adaptor`) for Google Workspace authentication

## Getting Started

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd claude-code-web
   ```

2. **Start the server**
   ```bash
   node server.js
   ```

3. **Open in browser**
   ```
   http://localhost:3000
   ```

4. **Authenticate services**
   - Click "SF" badge to authenticate with Salesforce
   - Click "Google" badge to authenticate with Google Workspace/MCP

## How It Works

### Architecture

```
Browser (Frontend)
    ↓ HTTP POST
Node.js Server (server.js)
    ↓ spawn()
Claude Code CLI
    ↓
Your conversation
```

### Key Components

- **server.js**: Node.js HTTP server that bridges the web UI to Claude Code CLI
- **index.html**: Main UI structure with sidebar, chat, and input areas
- **script.js**: Frontend JavaScript for user interactions and API calls
- **styles.css**: Salesforce-branded CSS with SLDS design tokens

### API Endpoints

- `GET /api/auth-status` - Check Salesforce and Google auth status
- `POST /api/auth-trigger` - Start authentication flow for a service
- `GET /api/skills` - List all available Claude Code skills
- `POST /api/message` - Send message or skill invocation to Claude Code

## Skills Integration

The interface scans for skills in:
- `~/.claude/commands/` - Custom command files (markdown)
- `~/.claude/plugins/cache/*/skills/*/SKILL.md` - Plugin skills
- `~/.claude/plugins/cache/*/skills/*/skill.md` - Plugin skills (lowercase)

Custom skills are automatically detected and shown under "⭐ My Skills" category.

## Authentication

### Salesforce
Runs `sf org login web` to open browser for OAuth authentication.

### Google Workspace (MCP)
Runs `mcp-adaptor auth` to authenticate with MCP services. Status check looks for running `mcp-adaptor --server google_workspace` process.

## Model Selection

Choose from available Claude models:
- **Sonnet 4.6**: Balanced performance (default)
- **Opus 4.8**: Most capable model
- **Haiku 4.5**: Fast and efficient
- **Fable 5**: Latest model

Selection is saved to localStorage and passed to Claude Code via `--model` flag.

## File Structure

```
claude-code-web/
├── index.html       # Main HTML structure
├── styles.css       # Salesforce-branded styles
├── script.js        # Frontend JavaScript
├── server.js        # Node.js backend server
├── .gitignore       # Git ignore rules
└── README.md        # This file
```

## Design Tokens

### Colors
- **Primary Blue**: `#0176D3` (Salesforce brand)
- **Dark Blue**: `#014486` (hover states)
- **Light Blue**: `#1B96FF` (accents)
- **Success**: `#4CAF50` (authenticated)
- **Error**: `#F44336` (not authenticated)

### Typography
- **Font Family**: Salesforce Sans (with fallbacks)
- **Sizes**: `0.75rem` to `1.5rem` (SLDS scale)

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile: Responsive layout

## Security Notes

- Server spawns Claude Code CLI processes with user's environment
- Authentication happens through official CLI tools (sf, mcp-adaptor)
- No credentials stored in the web interface
- Uses `execFile` instead of `exec` to prevent command injection

## Development

### Adding New Features

1. Update UI in `index.html`
2. Add styles in `styles.css`
3. Add frontend logic in `script.js`
4. Add backend endpoints in `server.js`

### Custom Skills

To add your own custom skills:
1. Create a markdown file in `~/.claude/commands/`
2. Or create a skill in your plugin under `skills/`
3. Skill will automatically appear in the interface

## Troubleshooting

**Skills not showing?**
- Check `~/.claude/commands/` and `~/.claude/plugins/cache/` directories
- Restart the server: `node server.js`

**Authentication not working?**
- Ensure `sf` and `mcp-adaptor` are in PATH
- Check authentication status manually: `sf org list`, `mcp-adaptor status`

**Model not switching?**
- Check browser console for errors
- Verify Claude Code CLI supports `--model` flag

## License

MIT

## Contributing

Pull requests welcome! Please follow existing code style and add tests for new features.

## Credits

Built with ❤️ using:
- [Claude Code](https://code.claude.ai) - AI coding assistant
- [Salesforce Lightning Design System](https://lightningdesignsystem.com) - Design tokens
- Node.js - Backend server
