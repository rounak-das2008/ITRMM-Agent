const API_BASE_URL = 'http://localhost:8000/api';

document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatMessages = document.getElementById('chatMessages');
    const messagesContainer = document.querySelector('.chat-messages-container');
    
    // Source elements
    const sourcesList = document.getElementById('sourcesList');
    const newSourceUrl = document.getElementById('newSourceUrl');
    const addSourceBtn = document.getElementById('addSourceBtn');
    const sourceError = document.getElementById('sourceError');

    // Upload elements
    const uploadBtn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('fileInput');
    const fileChip = document.getElementById('fileChip');
    const fileChipName = document.getElementById('fileChipName');
    const fileChipRemove = document.getElementById('fileChipRemove');
    const uploadStatus = document.getElementById('uploadStatus');
    const uploadStatusText = document.getElementById('uploadStatusText');

    let selectedFile = null;

    // Auto-resize textarea
    chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        updateSendButton();
    });

    function updateSendButton() {
        sendBtn.disabled = chatInput.value.trim().length === 0 && !selectedFile;
    }

    // Enter to send, Shift+Enter for new line
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!sendBtn.disabled) {
                handleSend();
            }
        }
    });

    // --- Upload Logic ---
    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            selectedFile = file;
            fileChipName.textContent = file.name;
            fileChip.classList.add('visible');
            updateSendButton();
        }
    });

    fileChipRemove.addEventListener('click', () => {
        clearFileSelection();
    });

    function clearFileSelection() {
        selectedFile = null;
        fileInput.value = '';
        fileChip.classList.remove('visible');
        updateSendButton();
    }

    // --- Chat Logic ---
    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Markdown simple parser
    function parseMarkdown(text) {
        let html = text;
        // Headers (###)
        html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gm, '<h3>$1</h3>');
        // Bold
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Italics
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Code
        html = html.replace(/`(.*?)`/g, '<code>$1</code>');
        // New lines
        html = html.replace(/\n\n/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');
        
        return `<p>${html}</p>`;
    }

    const botAvatarSVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#FF6200" rx="12"/><text x="50" y="62" font-family="Arial, sans-serif" font-weight="bold" font-size="36" fill="white" text-anchor="middle">ING</text></svg>`;

    function appendMessage(text, sender, extraHTML = '') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        if (sender === 'bot') {
            // Bot message: avatar + content
            const avatarDiv = document.createElement('div');
            avatarDiv.className = 'message-avatar bot-avatar';
            avatarDiv.innerHTML = botAvatarSVG;
            messageDiv.appendChild(avatarDiv);

            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.innerHTML = parseMarkdown(text) + extraHTML;
            messageDiv.appendChild(contentDiv);
        } else {
            // User message: just the bubble, no avatar
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.textContent = text;
            messageDiv.appendChild(contentDiv);
        }
        
        chatMessages.appendChild(messageDiv);
        scrollToBottom();
    }

    function addLoadingIndicator() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot-message loading-indicator';
        messageDiv.id = 'loadingIndicator';

        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar bot-avatar';
        avatarDiv.innerHTML = botAvatarSVG;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = '<em>Thinking... accessing Wiki...</em>';
        
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
        scrollToBottom();
    }

    function removeLoadingIndicator() {
        const loading = document.getElementById('loadingIndicator');
        if (loading) loading.remove();
    }

    // Unified send handler
    async function handleSend() {
        if (selectedFile) {
            await handleFileUpload();
        } else {
            await handleChat();
        }
    }

    async function handleChat() {
        const message = chatInput.value.trim();
        if (!message) return;

        appendMessage(message, 'user');
        
        chatInput.value = '';
        chatInput.style.height = 'auto';
        chatInput.disabled = true;
        sendBtn.disabled = true;

        addLoadingIndicator();

        try {
            const response = await fetch(`${API_BASE_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: message })
            });

            removeLoadingIndicator();

            if (!response.ok) {
                throw new Error('Failed to get response from ITRMM Agent');
            }

            const data = await response.json();
            appendMessage(data.reply, 'bot');
        } catch (error) {
            removeLoadingIndicator();
            appendMessage("⚠️ Error: Could not connect to the agent.", 'bot');
            console.error(error);
        } finally {
            chatInput.disabled = false;
            updateSendButton();
            chatInput.focus();
        }
    }

    async function handleFileUpload() {
        if (!selectedFile) return;

        const fileName = selectedFile.name;
        const userText = chatInput.value.trim();
        const userMsg = userText || `📎 Uploaded: ${fileName}`;
        
        // Show user message
        appendMessage(userMsg, 'user');
        
        // Reset input
        chatInput.value = '';
        chatInput.style.height = 'auto';
        chatInput.disabled = true;
        sendBtn.disabled = true;
        uploadBtn.disabled = true;

        // Show upload status
        uploadStatusText.textContent = `Processing "${fileName}"... This may take a few minutes for all questions.`;
        uploadStatus.classList.add('visible');

        // Show bot loading
        addLoadingIndicator();

        const formData = new FormData();
        formData.append('file', selectedFile);
        // Send user's text as instructions for response style
        if (userText) {
            formData.append('instructions', userText);
        }

        clearFileSelection();

        try {
            const response = await fetch(`${API_BASE_URL}/assess`, {
                method: 'POST',
                body: formData
            });

            removeLoadingIndicator();
            uploadStatus.classList.remove('visible');

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.detail || 'Assessment processing failed');
            }

            // Get the file as a blob for download
            const blob = await response.blob();
            const downloadUrl = URL.createObjectURL(blob);

            // Extract filename from content-disposition header or fallback
            let downloadName = `ITRMM_Results_${fileName}`;
            const cd = response.headers.get('content-disposition');
            if (cd) {
                const match = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (match && match[1]) {
                    downloadName = match[1].replace(/['"]/g, '');
                }
            }

            // Ensure it ends in .csv
            if (!downloadName.endsWith('.csv')) {
                downloadName = downloadName.replace(/\.(xlsx?|csv)$/i, '') + '.csv';
            }

            // Build a download button HTML
            const downloadBtnHTML = `
                <button class="download-btn" onclick="(function(){
                    const a = document.createElement('a');
                    a.href = '${downloadUrl}';
                    a.download = '${downloadName}';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                })()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download ${downloadName}
                </button>
            `;

            appendMessage(
                `✅ Assessment complete! All questions in **"${fileName}"** have been processed and filled with detailed responses, risk ratings, and evidence links. Click below to download your results.`,
                'bot',
                downloadBtnHTML
            );

            // Also trigger auto-download
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = downloadName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

        } catch (error) {
            removeLoadingIndicator();
            uploadStatus.classList.remove('visible');
            appendMessage(`⚠️ Error processing file: ${error.message}`, 'bot');
            console.error(error);
        } finally {
            chatInput.disabled = false;
            uploadBtn.disabled = false;
            updateSendButton();
            chatInput.focus();
        }
    }

    sendBtn.addEventListener('click', handleSend);

    // --- Dynamic Sources Logic ---
    async function loadSources() {
        try {
            const response = await fetch(`${API_BASE_URL}/sources`);
            const data = await response.json();
            renderSources(data.urls);
        } catch (error) {
            console.error("Failed to load sources", error);
        }
    }

    function renderSources(urls) {
        sourcesList.innerHTML = '';
        if (urls.length === 0) {
            sourcesList.innerHTML = '<span class="disclaimer">No sources connected.</span>';
            return;
        }

        urls.forEach(url => {
            const linkDiv = document.createElement('div');
            linkDiv.className = 'wiki-link';

            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.target = '_blank';
            anchor.textContent = url.split('/').pop() || url;
            anchor.style.textDecoration = 'none';
            anchor.style.color = 'inherit';
            anchor.style.flex = '1';

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '×';
            removeBtn.title = 'Remove Source';
            removeBtn.onclick = () => removeSource(url);

            linkDiv.appendChild(anchor);
            linkDiv.appendChild(removeBtn);
            sourcesList.appendChild(linkDiv);
        });
    }

    function showSourceError(msg) {
        sourceError.textContent = msg;
        sourceError.style.display = 'block';
        setTimeout(() => sourceError.style.display = 'none', 4000);
    }

    async function addSource() {
        const url = newSourceUrl.value.trim();
        if (!url) return;

        addSourceBtn.disabled = true;
        addSourceBtn.textContent = "Loading...";

        try {
            const response = await fetch(`${API_BASE_URL}/sources`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await response.json();
            
            if (!response.ok) {
                showSourceError(data.detail || "Failed to add source");
            } else {
                renderSources(data.urls);
                newSourceUrl.value = '';
            }
        } catch (e) {
            showSourceError("Network error adding source");
        } finally {
            addSourceBtn.disabled = false;
            addSourceBtn.textContent = "Add URL";
        }
    }

    async function removeSource(url) {
        try {
            const response = await fetch(`${API_BASE_URL}/sources`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await response.json();
            
            if (!response.ok) {
                showSourceError(data.detail || "Failed to remove source");
            } else {
                renderSources(data.urls);
            }
        } catch (e) {
            showSourceError("Network error removing source");
        }
    }

    addSourceBtn.addEventListener('click', addSource);
    newSourceUrl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addSource();
    });
    
    // Initial state
    loadSources();
    sendBtn.disabled = true;
    chatInput.focus();
});
