const SUPABASE_URL = "https://ixswnnjhjreoewlbnzhp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4c3dubmpoanJlb2V3bGJuemhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNzA1MjgsImV4cCI6MjA4NzY0NjUyOH0.s6-SB78wtXb5SAro9FRvBvA292VxH2bJxOH22si3GpQ";
const server = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== DOM ====================
const chatDiv = document.getElementById('chat');
const AuthOverlay = document.getElementById('authOverlay');
const openLoginBtn = document.getElementById('openLoginBtn');
const loginTab = document.getElementById('loginTab');
const signupTab = document.getElementById('signupTab');
const loginFormDiv = document.getElementById('loginForm');
const signupFormDiv = document.getElementById('signupForm');
const switchToSignup = document.getElementById('switchToSignup');
const switchToLogin = document.getElementById('switchToLogin');
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const settingsToggleBtn = document.getElementById('settingsToggleBtn');
const greetingContainer = document.getElementById('greetingContainer');
const messageInput = document.getElementById('messageInput');
const globalPreview = document.getElementById('globalPreview');
const imageInput = document.getElementById('imageInput');
const sendBtn = document.getElementById('sendBtn');
const enlargeOverlay = document.getElementById('enlargeOverlay');
const enlargedImg = document.getElementById('enlargedImg');
const closeEnlarge = document.getElementById('closeEnlarge');
const closeAuthModalBtn = document.getElementById('closeModalBtn');
const settingsOverlay = document.getElementById('settingsOverlay');
const closeSettingsModalBtn = document.getElementById('closeSettingsBtnModal');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const logoutBtnSettings = document.getElementById('logoutBtnSettings');
const avatarZone = document.getElementById('avatarClickZone');
const hiddenFileInput = document.getElementById('hiddenAvatarInput');
const avatarPreview = document.getElementById('avatarPreviewBig');
const settingsDisplayName = document.getElementById('settingsDisplayName');
const mainColorPicker = document.getElementById('mainColorPicker');
const mainColorSwatch = document.getElementById('mainColorSwatch');
const mainPollToggle = document.getElementById('mainPollToggle');
const mainPollPanel = document.getElementById('mainPollPanel');
const mainPollQuestion = document.getElementById('mainPollQuestion');
const mainPollOptions = document.getElementById('mainPollOptions');
const mainAddPollOpt = document.getElementById('mainAddPollOpt');

// ==================== STATE ====================
let selectedFiles = [];
let currentUser = null;
let currentProfile = null;

let allMessages = [];
let topLevelMessages = [];

let cursor = null;
let totalTopLevel = 0;
let isLoadingMore = false;

const PAGE_SIZE = 20;
const MAX_SIZE = 10 * 1024 * 1024;
const EXP_PER_LEVEL = 100;

// ==================== HELPERS ====================
function timeAgo(dateStr) {
	if (!dateStr) return '';
	const d = new Date(dateStr.replace(' ', 'T'));
	const sec = Math.floor((Date.now() - d) / 1000);
	if (sec < 60) return `${sec}s ago`;
	const min = Math.floor(sec / 60);
	if (min < 60) return `${min}m ago`;
	const hr = Math.floor(min / 60);
	if (hr < 24) return `${hr}h ago`;
	const day = Math.floor(hr / 24);
	if (day < 7) return `${day}d ago`;
	return d.toLocaleDateString();
}

function sanitize(text) {
	return DOMPurify.sanitize(text, {
		ALLOWED_TAGS: ['b', 'i', 'span', 'a', 'div', 'br'],
		ALLOWED_ATTR: ['style', 'href', 'target', 'rel', 'class']
	});
}

function TextFormatting(text) {
	if (!text) return '';
	// Bold / italic
	let html = text
		.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
		.replace(/\*(.*?)\*/g, '<i>$1</i>');
	// Spoiler tags
	html = html.replace(/\|\|(.*?)\|\|/g, '<span class="spoiler" title="Click to reveal">$1</span>');
	// Newlines
	html = html.replace(/\n/g, '<br>');
	// YouTube embeds
	const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[^\s<]*)/g;
	const ytIds = [];
	html = html.replace(ytRegex, (match, id) => {
		ytIds.push(id);
		return `%%YT_PLACEHOLDER_${ytIds.length - 1}%%`;
	});
	// Plain URLs
	html = html.replace(/(?!(?:[^<]+>|[^>]+<\/a>))\b(https?:\/\/[^\s<]+)/gi,
		'<a href="$1" target="_blank" rel="noopener">$1</a>');
	// Restore YT embeds
	ytIds.forEach((id, i) => {
		html = html.replace(`%%YT_PLACEHOLDER_${i}%%`,
			`<div class="yt-embed"><iframe src="https://www.youtube.com/embed/${id}" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`);
	});

	return DOMPurify.sanitize(html, {
		ALLOWED_TAGS: ['b', 'i', 'span', 'a', 'div', 'iframe', 'br', 'img'],
		ALLOWED_ATTR: ['style', 'href', 'target', 'rel', 'src', 'allowfullscreen', 'class', 'referrerpolicy', 'title']
	});
}

// ==================== AUTH ====================
async function refreshUser() {
	const {data: {user}} = await server.auth.getUser();
	currentUser = user;
	if (user) {
		const {data: profile} = await server.from('user_profile').select('*').eq('id', user.id).single();
		currentProfile = profile;
		updateGreeting();
	} else {
		currentProfile = null;
		greetingContainer.innerHTML = '';
		openLoginBtn.style.display = 'inline-flex';
	}
}
function updateGreeting() {
	if (currentProfile) {
		greetingContainer.innerHTML = `<div class="user-greeting"><i class="fas fa-smile"></i> ${sanitize(currentProfile.display_name || 'member')}</div>`;
		openLoginBtn.style.display = 'none';
	} else {
		greetingContainer.innerHTML = '';
		openLoginBtn.style.display = 'inline-flex';
	}
}
async function signUp() {
	const email = document.getElementById('signup-email').value;
	const password = document.getElementById('signup-password').value;
	const displayName = document.getElementById('signup-displayname').value;
	if (!displayName) return alert('Display name required');
	const {data,
		error
	} = await server.auth.signUp({
		email,
		password
	});
	if (error) return alert(error.message);
	await server.from('user_profile').insert({
		id: data.user.id,
		display_name: displayName
	});
	alert('Signup successful! Check email if confirmation is required.');
	AuthOverlay.classList.remove('active');
	refreshUser();
}
async function login() {
	const email = document.getElementById('login-email').value;
	const password = document.getElementById('login-password').value;
	const {
		error
	} = await server.auth.signInWithPassword({
		email,
		password
	});
	if (error) return alert(error.message);
	AuthOverlay.classList.remove('active');
	refreshUser();
}
async function logout() {
	await server.auth.signOut();
	settingsOverlay.classList.remove('active');
	refreshUser();
}
async function BlockSystem(BlockType, targetUserId) {
	const {data,error} = await supabase.functions.invoke("manage-blocked-user", {
		body: {command: BlockType, user_id: targetUserId}
	});
	if (error) {
		console.error("Failed to unblock user:", error);
		return false;
	}

	console.log("Command Sucess:", data);
	return true;
}

// ==================== IMAGE COMPRESSION ====================
function compressImage(file) {
	return new Promise((resolve, reject) => new Compressor(file, {
		quality: 0.6,
		maxWidth: 1280,
		maxHeight: 1280,
		mimeType: 'image/jpeg',
		success: resolve,
		error: reject
	}));
}
async function CompressMessageImage(files, userId, messageId) {
	const urls = [];
	for (const file of files) {
		if (!file) continue;
		if (file.size > MAX_SIZE) {
			alert('File must be under 10MB');
			return urls;
		}
		try {
			let img = file;
			if (file.type !== 'image/gif') img = await compressImage(file);
			const path = `image/${userId}/${messageId}/${Date.now()}-${Math.random().toString(36).slice(2)}`;
			const fd = new FormData();
			fd.append('file', img);
			fd.append('path', path);
			const {data: pub,error} = await server.functions.invoke('upload-images', {
				body: fd
			});
			if (!error) urls.push(pub.publicUrl);
		} catch (e) {
			console.error('compression failed', e);
		}
	}
	return urls;
}
async function CompressProfileImages(file) {
	if (!file || file.size > MAX_SIZE) {
		if (file) alert('File must be under 10MB');
		return '';
	}
	try {
		let img = file;
		if (file.type !== 'image/gif') img = await compressImage(file);
		const path = `avatars/${currentUser.id}/${Date.now()}`;
		const fd = new FormData();
		fd.append('file', img);
		fd.append('path', path);
		const {data, error} = await server.functions.invoke('upload-images', {
			body: fd
		});
		return error ? '' : data.publicUrl;
	} catch (e) {
		console.error('compression failed', e);
		return '';
	}
}

// ==================== POLL HELPERS ====================
function buildPollPanel(container) {
	// Returns { question, options, singleChoice } from panel inputs
	const q = container.querySelector('.poll-question-input').value.trim();
	const opts = [...container.querySelectorAll('.poll-option-input')]
		.map(i => i.value.trim()).filter(Boolean);
	const sc = container.querySelector('input[type="checkbox"]').checked;
	return {
		question: q,
		options: opts,
		singleChoice: sc
	};
}

function initPollPanel(panel, addOptBtn) {
	addOptBtn.addEventListener('click', () => {
		const idx = panel.children.length + 1;
		const row = document.createElement('div');
		row.className = 'poll-option-row';
		row.innerHTML = `<input type="text" class="poll-option-input" placeholder="Option ${idx}">
                <button class="poll-remove-opt" title="Remove"><i class="fas fa-times"></i></button>`;
		row.querySelector('.poll-remove-opt').addEventListener('click', () => {
			if (panel.children.length > 2) row.remove();
			else alert('Need at least 2 options');
		});
		panel.appendChild(row);
	});
	// remove buttons on existing rows
	panel.querySelectorAll('.poll-remove-opt').forEach(btn => {
		btn.addEventListener('click', () => {
			if (panel.children.length > 2) btn.closest('.poll-option-row').remove();
			else alert('Need at least 2 options');
		});
	});
}
// ==================== POST / EDIT / DELETE ====================
async function postMessage(content, files, parentId = null, pollData = null) {
	if (!currentUser) return alert('You must be logged in');
	if (!content && (!files || !files.length) && !pollData) return alert('Nothing to post');

	const btn = parentId ?
		document.querySelector(`[data-parent="${parentId}"]`) :
		sendBtn;
	if (btn) {
		btn.disabled = true;
		btn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i>';
	}

	try {
		const {data: msg, error} = await server.functions.invoke('post-message', {
			content: content,
			parent_id: parentId
		});
		if (error) throw error;

		if (files && files.length) {
			const urls = await CompressMessageImage(files, currentUser.id, msg.id);
			for (const url of urls) {
				await server.from('message_images').insert({
					message_id: msg.id,
					image_url: url
				});
			}
		}

		if (pollData && pollData.question && pollData.options.length >= 2) {
			await server.from('poll').insert({
				message: msg.id,
				poll_data: {
					question: pollData.question,
					options: pollData.options.map(o => ({
						label: o,
						votes: []
					}))
				},
				single_choice: pollData.singleChoice
			});
		}

		await new Promise(r => setTimeout(r, 800));
	} catch (err) {
		console.error('Post failed:', err);
		alert('Failed to post. Try again.');
	} finally {
		if (btn) {
			btn.disabled = false;
			btn.innerHTML = parentId ?
				'<i class="fas fa-paper-plane"></i> Reply' :
				'<i class="fas fa-paper-plane"></i> Post';
		}
	}
}
async function deleteMessage(messageId) {
	if (!confirm('Delete this message?')) return;
	await server.from('messages').delete().eq('id', messageId);
	await fullReload();
}
async function editMessage(messageId, oldContent) {
	// Find the card and open its unified reply box in "edit" mode.
	const card = document.querySelector(`[data-message-id="${messageId}"]`);
	if (!card) return;

	const box = card.querySelector('.reply-box-nested');
	if (!box) return;

	const ta = box.querySelector('textarea');
	const richPreview = box.querySelector('.reply-rich-preview');
	const sendBtn = box.querySelector('.send-reply-btn');

	// Pre-fill with existing content
	ta.value = oldContent;
	updateRichPreview(ta, richPreview);

	// Visual edit-mode state
	box.classList.add('edit-mode');
	let label = box.querySelector('.edit-mode-label');
	if (!label) {
		label = document.createElement('div');
		label.className = 'edit-mode-label';
		label.innerHTML = '<i class="fas fa-pencil-alt"></i> Editing message — press Esc to cancel';
		box.insertBefore(label, box.firstChild);
	}

	// Show the box
	box.style.display = 'block';
	ta.focus();

	const originalLabel = sendBtn.innerHTML;

	function closeEditMode() {
		box.classList.remove('edit-mode');
		label.remove();
		ta.value = '';
		richPreview.innerHTML = '';
		richPreview.style.display = 'none';
		box.style.display = 'none';
		document.removeEventListener('keydown', onKey);
	}

	// Clone button to wipe any prior listeners from appendReplyBox
	const newBtn = sendBtn.cloneNode(true);
	newBtn.innerHTML = '<i class="fas fa-save"></i> Save edit';
	sendBtn.replaceWith(newBtn);
	const freshBtn = box.querySelector('.send-reply-btn');

	freshBtn.addEventListener('click', async () => {
		const newText = ta.value.trim();
		if (!newText) return alert('Cannot save an empty message');
		freshBtn.disabled = true;
		freshBtn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i>';

		const {error} = await server.from('messages').update({
			content: newText
        }).eq('id', messageId);
		if (error) {
			alert(error.message);
			freshBtn.disabled = false;
			freshBtn.innerHTML = '<i class="fas fa-save"></i> Save edit';
			return;
		}

		closeEditMode();
		await fullReload();
	});

	const onKey = (e) => {
		if (e.key === 'Escape'){closeEditMode()};
	};
	document.addEventListener('keydown', onKey);
}

// ==================== POLL VOTING ====================
async function castVote(pollId, pollData, singleChoice, optionIndex) {
	if (!currentUser) return alert('Log in to vote');
	const uid = currentUser.id;
	const opts = JSON.parse(JSON.stringify(pollData.options)); // deep copy

	if (singleChoice) {
		const alreadyVoted = opts.some(o => (o.votes || []).includes(uid));
		if (alreadyVoted) return alert('You already voted');
		opts[optionIndex].votes = [...(opts[optionIndex].votes || []), uid];
	} else {
		const arr = opts[optionIndex].votes || [];
		if (arr.includes(uid)) {
			opts[optionIndex].votes = arr.filter(v => v !== uid);
		} else {
			opts[optionIndex].votes = [...arr, uid];
		}
	}
	await server.from('poll').update({
		poll_data: {
			question: pollData.question,
			options: opts
		}
	}).eq('id', pollId);
	await fullReload();
}

// ==================== PAGINATION / LOAD ====================
async function fetchMessages(before = 10, limit = PAGE_SIZE) {
	const {data,error} = await server.functions.invoke('fetch-compressedv2', {
		body: {before, limit}
	});
	if (error) {
		console.error('Data Fetch Error:', error);
		return null;
	}
	return data;
}

function addMessages(messages) {
    const existingIds = new Set(allMessages.map(m => m.id));
    for (const message of messages) {
        if (!existingIds.has(message.id)) {
            allMessages.push(message);
            existingIds.add(message.id);
        }
    }
}
	
function buildTree() {
    const messageMap = {};

    for (const message of allMessages) {
        message.children = [];
        messageMap[message.id] = message;
    }

    for (const message of allMessages) {
        if (message.parent_id && messageMap[message.parent_id]) {
            messageMap[message.parent_id].children.push(message);
        }
    }

    topLevelMessages = allMessages
        .filter(message => !message.parent_id)
        .sort((a, b) =>
            new Date(b.created_at) - new Date(a.created_at)
        );
}

async function loadInitial() {
    allMessages = [];
    topLevelMessages = [];
    cursor = null;
    totalTopLevel = 0;

    const result = await fetchMessages();

    if (!result) {
        showLoadError();
        return;
    }

    addMessages(result.messages);

    cursor = result.nextCursor;

    buildTree();
    renderTopLevel();
}

async function fullReload() {
	const pagesLoaded = Math.ceil(currentOffset / PAGE_SIZE) || 1;
	allMessages = [];
	topLevelMessages = [];

	for (let page = 0; page < pagesLoaded; page++) {
		const result = await fetchPage(page * PAGE_SIZE);
		if (!result) break;
		mergeMessages(result.messages);
		totalTopLevel = result.total;
	}
	buildTree();
	renderTopLevel();
}

async function setLoadMoreButton(state) { 
    const button = document.getElementById('loadMoreBtn'); 
    if (state) { 
        button.disabled = true; 
        button.innerHTML = ` <i class="fas fa-spinner fa-pulse"></i> Loading… `; 
    }else{
        button.disabled = false; 
        button.innerHTML = ` <i class="fas fa-chevron-down"></i> Show more posts `; 
    }
}

async function loadMore() {
    if (isLoadingMore || !cursor) {return;}
    
    isLoadingMore = true;
    setLoadMoreButton(true);

    const result = await fetchMessages(cursor);
    if (result) {
        addMessages(result.messages);
        cursor = result.nextCursor;
        buildTree();
        renderTopLevel();
    }

    setLoadMoreButton(false);
    isLoadingMore = false;
}

function renderTopLevel() {
    chatDiv.innerHTML = '';

    if (topLevelMessages.length === 0) {
        chatDiv.innerHTML = `
            <div style="text-align:center;padding:30px;color:#8a9ab0;">
                No discussions yet. Be the first!
            </div>
        `;
        return;
    }

    for (const message of topLevelMessages) {
        chatDiv.appendChild(
            createMessageElement(message, false)
        );

        if (message.children.length > 0) {
            const replies = document.createElement('div');
            replies.className = 'replies-section';

            chatDiv.appendChild(replies);

            renderReplies(message.children, replies, 0);
        }
    }
}

function renderReplies(messages, container, depth) {
    //Sorting by ascending, add some desc option later ig
    messages.sort((a, b) =>new Date(a.created_at) - new Date(b.created_at));
    for (const message of messages) {
        container.appendChild(createMessageElement(message, true));

        if (message.children.length === 0) {
            continue;
        }

        if (depth < 1){
            const replies = document.createElement('div');
            replies.className = 'replies-section';
            container.appendChild(replies);
            renderReplies(message.children, replies, depth + 1);
        }else{
            renderReplies(message.children, container, depth);
        }
    }
}

function createMessageElement(msg, isReply) {
	const card = document.createElement('div');
	card.className = isReply ? 'reply-card' : 'comment-card';
	card.dataset.messageId = msg.id;

	const profile = msg.user_profile || {
		display_name: 'Guest',
		image_url: 'https://img.freepik.com/premium-vector/default-avatar-profile-icon-social-media-user-image-gray-avatar-icon-blank-profile-silhouette-vector-illustration_561158-3407.jpg'
	};

	let parentBadge = '';
	if (isReply && msg.parent_id) {
		const parent = allMessages.find(m => m.id == msg.parent_id);
		if (parent && parent.user_profile) {
			parentBadge = `<span class="reply-to-badge"><i class="fas fa-reply"></i> ${sanitize(parent.user_profile.display_name || 'member')}</span>`;
		}
	}

	card.innerHTML = `
            <div class="comment-header">
                <div class="comment-avatar"><img src="${profile.image_url}" alt="" loading="lazy"></div>
                <span class="comment-author">${sanitize(profile.display_name || 'Guest')}</span>
                ${parentBadge}
                ${profile.title ? `<span class="comment-id-badge">${sanitize(profile.title)}</span>` : ''}
                <span class="comment-time"><i class="far fa-clock"></i> ${timeAgo(msg.created_at)}</span>
            </div>
            <div class="comment-body"></div>`;

	const body = card.querySelector('.comment-body');

	// Content with truncation
	const formatted = TextFormatting(msg.content || '');
	const contentDiv = document.createElement('div');
	contentDiv.className = 'comment-content';

	if ((msg.content || '').length > 2000) {
		const inner = document.createElement('div');
		inner.className = 'truncate-inner';
		inner.innerHTML = formatted;
		contentDiv.classList.add('content-truncated');
		contentDiv.appendChild(inner);
		const showBtn = document.createElement('button');
		showBtn.className = 'show-more-text';
		showBtn.textContent = 'Show more';
		let expanded = false;
		showBtn.addEventListener('click', () => {
			expanded = !expanded;
			inner.style.maxHeight = expanded ? 'none' : '';
			inner.style.overflow = expanded ? 'visible' : '';
			contentDiv.classList.toggle('content-truncated', !expanded);
			showBtn.textContent = expanded ? 'Show less' : 'Show more';
		});
		contentDiv.appendChild(showBtn);
	} else {
		contentDiv.innerHTML = formatted;
	}
	body.appendChild(contentDiv);

	// Spoiler click handler
	contentDiv.querySelectorAll('.spoiler').forEach(s => {
		s.addEventListener('click', () => s.classList.toggle('revealed'));
	});

	// Images
	if (msg.message_images && msg.message_images.length) {
		const imgDiv = document.createElement('div');
		imgDiv.className = 'comment-image';
		msg.message_images.forEach(img => {
			const wrapper = document.createElement('div');
			wrapper.className = 'img-wrapper';
			const im = document.createElement('img');
			im.loading = 'lazy';
			im.src = img.image_url;

			im.addEventListener('click', () => {
				enlargedImg.src = img.image_url;
				enlargeOverlay.classList.add('active');
			});

			if (img.censored != null && img.censored == true) {
				im,
				censorBtn = censorImage(im);
				wrapper.appendChild(censorBtn);
			}
			wrapper.appendChild(im);
			imgDiv.appendChild(wrapper);
		});
		body.appendChild(imgDiv);
	}

	// Poll display
	if (msg.poll) {
		body.appendChild(renderPollDisplay(msg.poll));
	}

	// Menu (owner or mod)
	const canEdit = (currentProfile && currentProfile.rank === 'Moderator') ||
		(currentUser && msg.sender === currentUser.id);
	if (canEdit) appendMenu(card, msg);

	appendReplyBox(card, msg);
	return card;
}

function renderPollDisplay(poll) {
	const pd = poll.poll_data;
	const sc = poll.single_choice;
	const totalVotes = pd.options.reduce((s, o) => s + (o.votes || []).length, 0);
	const uid = currentUser ? currentUser.id : null;
	const userVoted = uid && pd.options.some(o => (o.votes || []).includes(uid));

	const div = document.createElement('div');
	div.className = `poll-display${userVoted ? ' poll-voted' : ''}`;

	let html = `<div class="poll-question">${sanitize(pd.question)}</div>`;
	if (sc) html += `<div class="poll-single-badge"><i class="fas fa-check-circle"></i> Single choice</div>`;

	pd.options.forEach((opt, i) => {
		const votes = (opt.votes || []).length;
		const pct = totalVotes ? Math.round((votes / totalVotes) * 100) : 0;
		const voted = uid && (opt.votes || []).includes(uid);
		html += `
                <div class="poll-option-vote" data-opt="${i}" data-poll="${poll.id}">
                    <div class="poll-bar-wrap">
                        <div class="poll-bar-fill" style="width:${pct}%"></div>
                        <div class="poll-bar-label">${sanitize(opt.label)}${voted ? ' ✓' : ''}</div>
                    </div>
                    <span class="poll-bar-pct">${pct}%</span>
                    ${!userVoted || !sc ? `<button class="poll-vote-btn">${voted ? 'Unvote' : 'Vote'}</button>` : ''}
                </div>`;
	});
	html += `<div class="poll-meta">${totalVotes} vote${totalVotes !== 1 ? 's' : ''}</div>`;
	div.innerHTML = html;

	div.querySelectorAll('.poll-option-vote').forEach(row => {
		const voteBtn = row.querySelector('.poll-vote-btn');
		if (voteBtn) {
			voteBtn.addEventListener('click', async (e) => {
				e.stopPropagation();
				await castVote(poll.id, pd, sc, parseInt(row.dataset.opt));
			});
		}
	});
	return div;
}

function appendMenu(card, msg) {
	const menuDiv = document.createElement('div');
	menuDiv.className = 'comment-menu-';
	menuDiv.innerHTML = `
            <button class="menu-trigger"><i class="fas fa-ellipsis-v"></i></button>
            <div class="menu-dropdown">
                <button class="menu-item edit-item"><i class="fas fa-edit"></i> Edit</button>
                <button class="menu-item delete-item delete"><i class="fas fa-trash-alt"></i> Delete</button>
            </div>`;
	card.appendChild(menuDiv);

	const dropdown = menuDiv.querySelector('.menu-dropdown');
	menuDiv.querySelector('.menu-trigger').addEventListener('click', e => {
		e.stopPropagation();
		dropdown.classList.toggle('show');
	});
	menuDiv.querySelector('.edit-item').addEventListener('click', () => {
		editMessage(msg.id, msg.content || '');
		dropdown.classList.remove('show');
	});
	menuDiv.querySelector('.delete-item').addEventListener('click', () => {
		deleteMessage(msg.id);
		dropdown.classList.remove('show');
	});
	document.addEventListener('click', () => dropdown.classList.remove('show'), {
		once: false
	});
}

// ==================== REPLY BOX (Unified) ====================
function appendReplyBox(card, msg) {
	const actionsDiv = document.createElement('div');
	actionsDiv.className = 'comment-actions';
	actionsDiv.innerHTML = `<button class="reply-toggle-btn"><i class="fas fa-reply"></i> Reply</button>`;
	card.appendChild(actionsDiv);

	const box = document.createElement('div');
	box.className = 'reply-box-nested';
	box.innerHTML = `
            <div class="input-group">
                <div class="rich-preview reply-rich-preview"></div>
                <textarea rows="3" placeholder="Write a reply…"></textarea>
                <div class="compose-toolbar">
                    <button class="toolbar-btn" data-action="bold"><i class="fas fa-bold"></i></button>
                    <button class="toolbar-btn" data-action="italic"><i class="fas fa-italic"></i></button>
                    <div class="toolbar-sep"></div>
                    <button class="toolbar-btn" data-action="spoiler"><i class="fas fa-eye-slash"></i> <span>Spoiler</span></button>
                    <div class="toolbar-sep"></div>
                    <button class="toolbar-btn" data-action="color">
                        <span class="color-swatch" style="background:#2e9afe;"></span> <span>Color</span>
                    </button>
                    <input type="color" class="hidden-color reply-color-picker" value="#2e9afe">
                    <div class="toolbar-sep"></div>
                    <button class="toolbar-btn reply-poll-toggle"><i class="fas fa-poll-h"></i> <span>Poll</span></button>
                </div>
            </div>
            <div class="preview-area reply-file-preview"></div>
            <div class="poll-panel reply-poll-panel">
                <h4><i class="fas fa-poll-h"></i> Create a Poll</h4>
                <input type="text" class="poll-question-input" placeholder="Ask a question…">
                <div class="poll-options-list">
                    <div class="poll-option-row">
                        <input type="text" class="poll-option-input" placeholder="Option 1">
                        <button class="poll-remove-opt"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="poll-option-row">
                        <input type="text" class="poll-option-input" placeholder="Option 2">
                        <button class="poll-remove-opt"><i class="fas fa-times"></i></button>
                    </div>
                </div>
                <button class="poll-add-opt reply-add-poll-opt"><i class="fas fa-plus"></i> Add option</button>
                <div class="poll-footer" style="margin-top:10px;">
                    <div class="poll-toggle-row">
                        <label class="toggle-switch">
                            <input type="checkbox" class="reply-single-choice" checked>
                            <div class="toggle-track"></div>
                            <div class="toggle-thumb"></div>
                        </label>
                        <span>Single choice only</span>
                    </div>
                </div>
            </div>
            <div class="compose-footer">
                <div class="compose-footer-left">
                    <label class="attach-label reply-file-label"><i class="fas fa-image"></i> <span>Image</span></label>
                    <input type="file" class="reply-file-input" accept="image/*" multiple style="display:none;">
                </div>
                <button class="send-btn send-reply-btn" data-parent="${msg.id}"><i class="fas fa-paper-plane"></i> Reply</button>
            </div>`;
	card.appendChild(box);

	const ta = box.querySelector('textarea');
	const richPreview = box.querySelector('.reply-rich-preview');
	const fileInput = box.querySelector('.reply-file-input');
	const fileLabel = box.querySelector('.reply-file-label');
	const filePreview = box.querySelector('.reply-file-preview');
	const colorPicker = box.querySelector('.reply-color-picker');
	const colorSwatch = box.querySelector('.color-swatch');
	const pollToggle = box.querySelector('.reply-poll-toggle');
	const pollPanel = box.querySelector('.reply-poll-panel');
	const pollOptsList = box.querySelector('.poll-options-list');
	const addOptBtn = box.querySelector('.reply-add-poll-opt');
	const sendBtn = box.querySelector('.send-reply-btn');

	// Toggle reply box
	actionsDiv.querySelector('.reply-toggle-btn').addEventListener('click', () => {
		box.style.display = box.style.display === 'none' ? 'block' : 'none';
	});

	// Link file label to input
	fileLabel.addEventListener('click', () => fileInput.click());

	// Rich preview on input
	let replyFiles = [];
	ta.addEventListener('input', () => updateRichPreview(ta, richPreview));

	// Toolbar
	box.querySelectorAll('[data-action]').forEach(btn => {
		btn.addEventListener('click', () => {
			const action = btn.dataset.action;
			if (action === 'color') {
				colorPicker.click();
				return;
			}
			applyFormat(ta, action, colorPicker.value);
			updateRichPreview(ta, richPreview);
		});
	});
	colorPicker.addEventListener('input', () => {
		colorSwatch.style.background = colorPicker.value;
		applyFormat(ta, 'color', colorPicker.value);
		updateRichPreview(ta, richPreview);
	});

	// Poll panel
	pollToggle.addEventListener('click', () => {
		pollPanel.classList.toggle('visible');
		pollToggle.classList.toggle('active');
	});
	initPollPanel(pollOptsList, addOptBtn);

	// File previews
	fileInput.addEventListener('change', () => {
		replyFiles = [...replyFiles, ...Array.from(fileInput.files)];
		updateFilePreviews(replyFiles, filePreview, (idx) => {
			replyFiles.splice(idx, 1);
			updateFilePreviews(replyFiles, filePreview, null);
		});
	});

	// Send reply
	sendBtn.addEventListener('click', async () => {
		sendBtn.disabled = true;
		const content = ta.value.trim();
		const pollPanelVisible = pollPanel.classList.contains('visible');
		const poll = pollPanelVisible ? buildPollPanel(pollPanel) : null;
		if (!content && !replyFiles.length && !poll) {
			sendBtn.disabled = false;
			return alert('Write something first');
		}
		await postMessage(content, replyFiles, msg.id, poll);
		ta.value = '';
		replyFiles = [];
		fileInput.value = '';
		filePreview.innerHTML = '';
		richPreview.innerHTML = '';
		richPreview.style.display = 'none';
		pollPanel.classList.remove('visible');
		box.style.display = 'none';
		await fullReload();
	});
}

// ==================== FORMAT / PREVIEW ====================
function applyFormat(ta, action, color) {
	const start = ta.selectionStart;
	const end = ta.selectionEnd;
	let text = ta.value;
	let before, after;
    
	if (action === 'bold') {
		before = '**';
		after = '**';
	} else if (action === 'italic') {
		before = '*';
		after = '*';
	} else if (action === 'spoiler') {
		before = '||';
		after = '||';
	} else if (action === 'color') {
		// Strip any existing color span that wraps exactly the selected text,
		// so re-coloring never nests <span style="color:…"> inside another.
		const selected = text.slice(start, end);
		const spanWrap = /^<span style="color:[^"]+;">([\s\S]*)<\/span>$/;
		const inner = selected.match(spanWrap);
		if (inner) {
			// Unwrap first so we wrap fresh below
			const unwrapped = inner[1];
			text = text.slice(0, start) + unwrapped + text.slice(end);
			ta.value = text;
			ta.selectionStart = start;
			ta.selectionEnd = start + unwrapped.length;
		}
		const s2 = ta.selectionStart,
			e2 = ta.selectionEnd,
			t2 = ta.value;
		const bef = `<span style="color:${color};">`,
			aft = '</span>';
		ta.value = t2.slice(0, s2) + bef + t2.slice(s2, e2) + aft + t2.slice(e2);
		ta.selectionStart = s2 + bef.length;
		ta.selectionEnd = e2 + bef.length;
		ta.focus();
		return;
	} else return;
    
	ta.value = text.slice(0, start) + before + text.slice(start, end) + after + text.slice(end);
	ta.selectionStart = start + before.length;
	ta.selectionEnd = end + before.length;
	ta.focus();
}

function updateRichPreview(ta, previewEl) {
	const formatted = TextFormatting(ta.value);
	if (!formatted.trim()) {
		previewEl.style.display = 'none';
		previewEl.innerHTML = '';
	} else {
		previewEl.style.display = 'block';
		previewEl.innerHTML = formatted;
		previewEl.querySelectorAll('.spoiler').forEach(s =>
			s.addEventListener('click', () => s.classList.toggle('revealed'))
		);
	}
}

function updateFilePreviews(files, container, onRemove) {
	container.innerHTML = '';
	files.forEach((f, idx) => {
		const r = new FileReader();
		r.onload = e => {
			const thumb = document.createElement('div');
			thumb.className = 'thumb-preview';
			thumb.innerHTML = `<img src="${e.target.result}"><span class="remove-preview">&times;</span>`;
			container.appendChild(thumb);
			thumb.querySelector('.remove-preview').addEventListener('click', () => {
				if (onRemove) onRemove(idx);
			});
		};
		r.readAsDataURL(f);
	});
}

function censorImage(im) {
	im.classList.add('censored');
	im.addEventListener('click', () => {
		if (im.classList.contains('censored')) {
			im.classList.remove('censored');
		} else {
			enlargedImg.src = img.image_url;
			enlargeOverlay.classList.add('active');
		}
	});
	const censorBtn = document.createElement('button');
	censorBtn.className = 'censor-btn';
	censorBtn.title = 'Toggle blur';
	censorBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
	censorBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		im.classList.toggle('censored');
		censorBtn.innerHTML = im.classList.contains('censored') ?
			'<i class="fas fa-eye-slash"></i>' :
			'<i class="fas fa-eye"></i>';
	});
	return im, censorBtn;
}

// ==================== Events ====================
// Rich preview for main input
messageInput.addEventListener('input', () => updateRichPreview(messageInput, document.getElementById('mainRichPreview')));

document.querySelectorAll('#mainToolbar [data-action]').forEach(btn => {
	btn.addEventListener('click', () => {
		const action = btn.dataset.action;
		if (action === 'color') {
			mainColorPicker.click();
			return;
		}
		applyFormat(messageInput, action, mainColorPicker.value);
		updateRichPreview(messageInput, document.getElementById('mainRichPreview'));
	});
});
mainColorPicker.addEventListener('input', () => {
	mainColorSwatch.style.background = mainColorPicker.value;
	applyFormat(messageInput, 'color', mainColorPicker.value);
	updateRichPreview(messageInput, document.getElementById('mainRichPreview'));
});

// Poll toggle (main)
mainPollToggle.addEventListener('click', () => {
	mainPollPanel.classList.toggle('visible');
	mainPollToggle.classList.toggle('active');
});
initPollPanel(mainPollOptions, mainAddPollOpt);

// Image input
imageInput.addEventListener('change', () => {
	selectedFiles = [...selectedFiles, ...Array.from(imageInput.files)];
	updateFilePreviews(selectedFiles, globalPreview, (idx) => {
		selectedFiles.splice(idx, 1);
		updateFilePreviews(selectedFiles, globalPreview, null);
	});
});

// Drag & drop on textarea
messageInput.addEventListener('dragover', e => {
	e.preventDefault();
	messageInput.parentElement.style.borderColor = '#2e9afe';
});
messageInput.addEventListener('dragleave', () => {
	messageInput.parentElement.style.borderColor = '';
});
messageInput.addEventListener('drop', e => {
	e.preventDefault();
	messageInput.parentElement.style.borderColor = '';
	const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
	selectedFiles = [...selectedFiles, ...files];
	updateFilePreviews(selectedFiles, globalPreview, (idx) => {
		selectedFiles.splice(idx, 1);
		updateFilePreviews(selectedFiles, globalPreview, null);
	});
});

// Send main post
sendBtn.addEventListener('click', async () => {
	sendBtn.disabled = true;
	sendBtn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i>';
	const content = messageInput.value.trim();
	const pollPanelVisible = mainPollPanel.classList.contains('visible');
	const poll = pollPanelVisible ? buildPollPanel(mainPollPanel) : null;

	await postMessage(content, selectedFiles.length ? selectedFiles : null, null, poll);

	messageInput.value = '';
	selectedFiles = [];
	globalPreview.innerHTML = '';
	imageInput.value = '';
	document.getElementById('mainRichPreview').innerHTML = '';
	document.getElementById('mainRichPreview').style.display = 'none';
	mainPollPanel.classList.remove('visible');
	mainPollToggle.classList.remove('active');

	sendBtn.disabled = false;
	sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Post';
	await fullReload();
});

// Load more
document.getElementById('loadMoreBtn').addEventListener('click', loadMore);

// ==================== MODALS ====================
openLoginBtn.addEventListener('click', () => AuthOverlay.classList.add('active'));
closeAuthModalBtn.addEventListener('click', () => AuthOverlay.classList.remove('active'));
AuthOverlay.addEventListener('click', e => {
	if (e.target === AuthOverlay) AuthOverlay.classList.remove('active');
});

loginTab.addEventListener('click', () => {
	loginTab.classList.add('active');
	signupTab.classList.remove('active');
	loginFormDiv.style.display = 'block';
	signupFormDiv.style.display = 'none';
});
signupTab.addEventListener('click', () => {
	signupTab.classList.add('active');
	loginTab.classList.remove('active');
	signupFormDiv.style.display = 'block';
	loginFormDiv.style.display = 'none';
});
switchToSignup.addEventListener('click', e => {
	e.preventDefault();
	signupTab.click();
});
switchToLogin.addEventListener('click', e => {
	e.preventDefault();
	loginTab.click();
});
loginBtn.addEventListener('click', login);
signupBtn.addEventListener('click', signUp);

// Settings
settingsToggleBtn.addEventListener('click', async () => {
	if (!currentUser) return alert('Log in first');
	await refreshUser();
	if (currentProfile) LoadProfile();
	settingsOverlay.classList.add('active');
});
closeSettingsModalBtn.addEventListener('click', () => settingsOverlay.classList.remove('active'));
settingsOverlay.addEventListener('click', e => {
	if (e.target === settingsOverlay) settingsOverlay.classList.remove('active');
});

logoutBtnSettings.addEventListener('click', logout);

avatarZone.addEventListener('click', () => hiddenFileInput.click());
hiddenFileInput.addEventListener('change', e => {
	const file = e.target.files[0];
	if (file) {
		const r = new FileReader();
		r.onload = ev => avatarPreview.src = ev.target.result;
		r.readAsDataURL(file);
	}
});

document.getElementById('applyBgBtn').addEventListener('click', () => {
	const url = document.getElementById('bgImageUrl').value.trim();
	if (url) {
		document.body.style.backgroundImage = `url('${url}')`;
		document.body.style.backgroundSize = 'cover';
		document.body.style.backgroundAttachment = 'fixed';
		document.body.style.backgroundPosition = 'center';
		if (currentProfile) currentProfile.bgUrl = url;
		alert('Background updated!');
	}
});

document.getElementById('sillynessBlock').addEventListener('click', () => {
	addSillyness(2);
	addExp(3);
});

// Enlarge overlay
closeEnlarge.addEventListener('click', () => enlargeOverlay.classList.remove('active'));
enlargeOverlay.addEventListener('click', e => {
	if (e.target === enlargeOverlay) enlargeOverlay.classList.remove('active');
});

// ==================== PROFILE ====================
function updateExpUI() {
	const expFill = document.getElementById('expFillBar');
	const levelSpan = document.getElementById('currentLevel');
	const expFraction = document.getElementById('expFraction');
	if (!expFill || !currentProfile) return;
	const exp = currentProfile.exp || 0;
	const level = Math.floor((Math.sqrt(0.08 * exp + 1) - 1) / 2);
	const pct = Math.min(100, (exp / EXP_PER_LEVEL) * 100);
	expFill.style.width = `${pct}%`;
	expFill.classList.add('animate-pulse');
	setTimeout(() => expFill.classList.remove('animate-pulse'), 600);
	if (levelSpan) levelSpan.textContent = level;
	if (expFraction) expFraction.textContent = `${exp} / ${EXP_PER_LEVEL} XP`;
}

function addExp(n) {
	if (!currentProfile) return;
	currentProfile.exp = (currentProfile.exp || 0) + n;
	updateExpUI();
}

function addSillyness(n = 1) {
	if (!currentProfile) return;
	currentProfile.sillyness = (currentProfile.sillyness || 0) + n;
	document.getElementById('sillynessValue').textContent = currentProfile.sillyness;
}

function LoadProfile() {
	if (!currentUser || !currentProfile) return;
	settingsDisplayName.value = sanitize(currentProfile.display_name || '');
	avatarPreview.src = currentProfile.image_url || avatarPreview.src;
	document.getElementById('rankValueDisplay').textContent = currentProfile.rank || 'User';
	document.getElementById('sillynessValue').textContent = currentProfile.sillyness || 0;
	const bgInput = document.getElementById('bgImageUrl');
	if (bgInput && currentProfile.bgUrl) bgInput.value = currentProfile.bgUrl;
	if (currentProfile.bgUrl) {
		document.body.style.backgroundImage = `url('${currentProfile.bgUrl}')`;
		document.body.style.backgroundSize = 'cover';
		document.body.style.backgroundAttachment = 'fixed';
		document.body.style.backgroundPosition = 'center';
	}
	updateExpUI();
}

saveSettingsBtn.addEventListener('click', async () => {
	if (!currentUser) return alert('Log in first');
	saveSettingsBtn.disabled = true;
	const newName = sanitize(settingsDisplayName.value.trim());
	if (newName.length > 100) {
		alert('Keep it short. \nTwT - Rinrin');
		saveSettingsBtn.disabled = false;
		return;
	}
	const file = hiddenFileInput.files[0];
	let imageUrl = currentProfile ? currentProfile.image_url || '' : '';
	if (file) imageUrl = await CompressProfileImages(file);

	const updates = {};
	if (newName) updates.display_name = newName;
	if (imageUrl) updates.image_url = imageUrl;
	if (!Object.keys(updates).length) {
		saveSettingsBtn.disabled = false;
		return;
	}

	const {
		error
	} = await server.from('user_profile').update(updates).eq('id', currentUser.id);
	if (error) {
		alert(error.message);
	} else {
		addExp(5);
		addSillyness(1);
		settingsOverlay.classList.remove('active');
		await refreshUser();
		alert('✨ Profile updated! +5 XP & +1 Sillyness ✨');
	}
	saveSettingsBtn.disabled = false;
});

// ==================== INIT ====================
refreshUser().then(() => loadInitial());
