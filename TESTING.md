# Testing Guide for Claude Code Web Interface

## How to Test the Fixes

### 1. Start the Server

```bash
cd ~/claude-code-web
node server.js
```

Then open http://localhost:3000 in your browser.

### 2. Test Chat Persistence (Main Fix)

**Test that chats no longer clear on their own:**

1. Send a few messages in the chat
2. Look at browser console (F12 → Console tab)
3. You should see logs like:
   ```
   Saved conversation with 2 messages
   ```
4. Refresh the page (F5)
5. Your conversation should still be there
6. Check console for:
   ```
   Loading conversation <id> with 2 messages
   ```

**Expected:** Chat persists across refreshes, with console logs confirming saves.

### 3. Test Error Recovery

**Fill up localStorage to trigger cleanup:**

1. Create many conversations (10-15)
2. Watch console for any errors
3. If you see "LocalStorage quota exceeded", the auto-cleanup should trigger
4. Console should show: "Clearing old data..."
5. New conversations should still save successfully

**Expected:** App handles full storage gracefully, doesn't crash or lose current conversation.

### 4. Test the New Agents Section

**Verify agents are accessible:**

1. Look in the left sidebar
2. You should see "Available Agents" section above "Available Skills"
3. Four agents should be visible:
   - General Purpose
   - Code Explorer
   - Code Reviewer
   - Researcher
4. Click any agent
5. Should see "@agent-name " appear in the input box
6. Should see confirmation message in chat

**Expected:** Agent buttons work and insert proper syntax.

### 5. Test Debug Panel

**Use debug tools to inspect storage:**

1. Click Settings (gear icon in sidebar)
2. Scroll to "Debug Info" section
3. Click "View Storage Debug Info"
4. You should see:
   - Conversation counts
   - Storage usage in KB
   - List of localStorage keys
   - Recent conversation titles
5. Try "Clear All Data" button
   - Should prompt for confirmation
   - Should clear everything and show welcome screen

**Expected:** Debug info displays correctly, helps diagnose issues.

### 6. Test Auto-Save

**Verify 30-second auto-save works:**

1. Send a message
2. Wait 30 seconds (don't close/refresh)
3. Watch console
4. Should see: "Auto-save triggered with X messages"
5. Then: "Saved conversation with X messages"

**Expected:** Auto-save logs appear every 30 seconds when there are messages.

### 7. Test Data Validation

**Try to break it (should not crash):**

1. Open browser console
2. Try to corrupt data:
   ```javascript
   localStorage.setItem('conversations', 'invalid json');
   ```
3. Refresh the page
4. Should see error in console but app should still work
5. Should fall back to empty conversations list

**Expected:** Corrupt data doesn't crash the app.

## Console Commands for Testing

Open browser console (F12) and try these:

```javascript
// Check current state
console.log('Conversations:', conversations);
console.log('Current Messages:', currentMessages);
console.log('Current Conversation ID:', currentConversationId);

// Check storage usage
let total = 0;
for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
        total += localStorage[key].length;
    }
}
console.log(`LocalStorage Usage: ${(total/1024).toFixed(2)} KB / ~5120 KB limit`);

// Manually trigger save
saveCurrentConversation();

// Check what's stored
console.log('Stored conversations:', Storage.get('conversations'));
console.log('Stored favorites:', Storage.get('favoritePrompts'));
console.log('Stored projects:', Storage.get('recentProjects'));

// Clear everything (careful!)
Storage.clearOldData();
```

## What to Look For

### ✅ Good Signs
- Console shows "Saved conversation with X messages" after sending messages
- Console shows "Loading conversation X with Y messages" after refresh
- Conversations appear in "Recent Conversations" list
- Page refresh doesn't lose your chat
- Auto-save logs appear every 30 seconds
- Debug panel shows accurate counts

### ⚠️ Warning Signs
- "Error writing to localStorage" in console
- "QuotaExceededError" (means you're near the limit)
- Conversations disappearing after refresh
- No auto-save logs appearing

### 🛑 Problems
- App crashes/freezes
- Console full of errors
- Can't send messages
- Settings panel won't open

## Common Issues & Solutions

### Issue: "Chat still clears on its own"

**Check:**
1. Open console and look for errors
2. Check Debug Panel → View Storage Debug Info
3. Look at localStorage usage
4. Try "Clear All Data" and start fresh

### Issue: "localStorage quota exceeded"

**Solution:**
1. The app should auto-clear old conversations
2. If not, manually clear in Settings → Clear All Data
3. Or in console: `localStorage.clear()`

### Issue: "Agents buttons don't work"

**Check:**
1. Look for JavaScript errors in console
2. Make sure server.js is running
3. Try refreshing the page

## Browser Compatibility

Tested on:
- Chrome 120+
- Safari 17+
- Firefox 120+
- Edge 120+

LocalStorage limits vary by browser (typically 5-10 MB).

## Performance Tips

- Keep conversations under 50 messages for best performance
- Export old conversations before clearing
- Use Debug Panel to monitor storage usage
- Clear data if app feels slow

## Report Issues

If you find bugs:
1. Open browser console (F12)
2. Copy any error messages
3. Note what you were doing when it happened
4. Check Debug Panel for storage state
5. Report with all this info
