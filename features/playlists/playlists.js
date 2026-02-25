const SUPABASE_URL = 'https://isqwzrzbjotbwqkzhwqd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzcXd6cnpiam90Yndxa3pod3FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NjI1NDYsImV4cCI6MjA4NzQzODU0Nn0.EgJgqEJPUMh9WaPDKpFzHiyAwf4zsHRF1n1f56ZMSjc';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// CORREÇÃO 1: Caminho absoluto para o import a partir da raiz do site

// --- Seletores de Elementos ---
const userEmailDisplay = document.getElementById('user-email-display');
const logoutBtn = document.getElementById('logout-btn');
const playlistListContainer = document.getElementById('playlist-list-container');
const addPlaylistBtn = document.getElementById('add-playlist-btn');
const playlistModal = document.getElementById('playlist-modal');
const playlistForm = document.getElementById('playlist-form');
const modalTitle = document.getElementById('modal-title');
const closePlaylistModalBtn = document.getElementById('close-playlist-modal');
const cancelPlaylistBtn = document.getElementById('cancel-playlist-btn');
const playlistIdInput = document.getElementById('playlist-id');
const playlistNameInput = document.getElementById('playlist-name');
const playlistDescriptionInput = document.getElementById('playlist-description');
const editMediaModal = document.getElementById('edit-media-modal');
const closeEditMediaModalBtn = document.getElementById('close-edit-media-modal');
const playlistMediasList = document.getElementById('playlist-medias-list');
const availableMediasList = document.getElementById('available-medias-list');
const saveMediaChangesBtn = document.getElementById('save-media-changes-btn');

let currentEditingPlaylistId = null;
let clientId = null; // Variável para guardar o ID do cliente

// --- "SENTINELA" E INICIALIZAÇÃO ---
(async () => {
    const { data: { session } } = await db.auth.getSession();
    if (!session) {
        // CORREÇÃO 2: Usa a URL amigável para a página de login
        window.location.href = '../auth/auth.html';
        return;
    }
    
    clientId = session.user.user_metadata.client_id;
    if (!clientId) {
        alert("Erro crítico: ID do cliente não encontrado no perfil do usuário.");
        await db.auth.signOut();
        // CORREÇÃO 3: Usa a URL amigável para a página de login
        window.location.href = '../auth/auth.html';
        return;
    }

    userEmailDisplay.textContent = session.user.email;
    loadPlaylists();
})();

// --- LÓGICA DE LOGOUT ---
logoutBtn.addEventListener('click', async () => {
    await db.auth.signOut();
    // CORREÇÃO 4: Usa a URL amigável para a página de login
    window.location.href = '../auth/auth.html';
});

// --- FUNÇÕES DE MODAL ---
function openPlaylistModal(playlist = null) {
    playlistForm.reset();
    if (playlist) {
        modalTitle.textContent = 'Editar Playlist';
        playlistIdInput.value = playlist.id;
        playlistNameInput.value = playlist.name;
        playlistDescriptionInput.value = playlist.description;
    } else {
        modalTitle.textContent = 'Criar Nova Playlist';
        playlistIdInput.value = '';
    }
    playlistModal.style.display = 'flex';
}
function closePlaylistModal() { playlistModal.style.display = 'none'; }
addPlaylistBtn.addEventListener('click', () => openPlaylistModal());
closePlaylistModalBtn.addEventListener('click', closePlaylistModal);
cancelPlaylistBtn.addEventListener('click', closePlaylistModal);

function openEditMediaModal(playlistId, playlistName) {
    currentEditingPlaylistId = playlistId;
    document.getElementById('edit-media-modal-title').textContent = `Editando mídias de: ${playlistName}`;
    loadMediasForPlaylist();
    editMediaModal.style.display = 'flex';
}
function closeEditMediaModal() { editMediaModal.style.display = 'none'; currentEditingPlaylistId = null; }
closeEditMediaModalBtn.addEventListener('click', closeEditMediaModal);
saveMediaChangesBtn.addEventListener('click', savePlaylistMediaOrder);


// --- LÓGICA DE PLAYLISTS ---
async function loadPlaylists() {
    playlistListContainer.innerHTML = '<p>Buscando playlists...</p>';
    try {
        const { data: playlists, error } = await db.from('playlists').select('*').order('created_at', { ascending: false });
        if (error) throw error;

        if (playlists.length === 0) {
            playlistListContainer.innerHTML = '<p>Nenhuma playlist encontrada. Crie a primeira!</p>';
            return;
        }

        playlistListContainer.innerHTML = playlists.map(p => `
            <div class="item">
                <div class="item-info">
                    <div class="name">${p.name}</div>
                    <div class="details">${p.description || 'Sem descrição'}</div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-sm btn-secondary edit-playlist-btn" data-id="${p.id}">Editar</button>
                    <button class="btn btn-sm btn-primary edit-media-btn" data-id="${p.id}" data-name="${p.name}">Editar Mídias</button>
                    <button class="btn btn-sm btn-danger delete-playlist-btn" data-id="${p.id}">Excluir</button>
                </div>
            </div>
        `).join('');

        document.querySelectorAll('.edit-playlist-btn').forEach(b => {
            b.addEventListener('click', () => {
                const id = b.dataset.id;
                const playlist = playlists.find(p => p.id === id);
                openPlaylistModal(playlist);
            });
        });
        document.querySelectorAll('.edit-media-btn').forEach(b => b.addEventListener('click', (e) => openEditMediaModal(e.target.dataset.id, e.target.dataset.name)));
        document.querySelectorAll('.delete-playlist-btn').forEach(b => b.addEventListener('click', (e) => deletePlaylist(e.target.dataset.id)));

    } catch (error) {
        playlistListContainer.innerHTML = `<p style="color:red;">Erro ao carregar playlists: ${error.message}</p>`;
    }
}

playlistForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = playlistIdInput.value;
    const playlistData = { 
        name: playlistNameInput.value, 
        description: playlistDescriptionInput.value 
    };
    
    if (!id) {
        playlistData.client_id = clientId;
    }

    try {
        let error;
        if (id) {
            ({ error } = await db.from('playlists').update(playlistData).eq('id', id));
        } else {
            ({ error } = await db.from('playlists').insert([playlistData]));
        }
        if (error) throw error;
        closePlaylistModal();
        loadPlaylists();
    } catch (error) {
        alert('Erro ao salvar playlist: ' + error.message);
    }
});

async function deletePlaylist(id) {
    if (!confirm('Tem certeza que deseja excluir esta playlist?')) return;
    try {
        const { error } = await db.from('playlists').delete().eq('id', id);
        if (error) throw error;
        loadPlaylists();
    } catch (error) {
        alert('Erro ao excluir playlist: ' + error.message);
    }
}

// --- LÓGICA PARA ORGANIZAR MÍDIAS NA PLAYLIST ---
async function loadMediasForPlaylist() {
    playlistMediasList.innerHTML = '<p>Carregando...</p>';
    availableMediasList.innerHTML = '<p>Carregando...</p>';
    try {
        const [ { data: allMedias }, { data: playlistData } ] = await Promise.all([
            db.from('medias').select('id, name'),
            db.from('playlists').select('media_ids').eq('id', currentEditingPlaylistId).single()
        ]);
        const mediaIdsInPlaylist = playlistData.media_ids || [];
        const mediasInPlaylist = mediaIdsInPlaylist.map(id => allMedias.find(m => m.id === id)).filter(Boolean);
        const mediasAvailable = allMedias.filter(m => !mediaIdsInPlaylist.includes(m.id));
        renderMediaList(playlistMediasList, mediasInPlaylist, true);
        renderMediaList(availableMediasList, mediasAvailable, false);
    } catch (error) { console.error("Erro ao carregar mídias", error); }
}

function renderMediaList(listElement, mediaItems, isInPlaylist) {
    listElement.innerHTML = '';
    if (mediaItems.length === 0) {
        listElement.innerHTML = `<p>Nenhuma mídia aqui.</p>`;
        return;
    }
    mediaItems.forEach(media => {
        const itemEl = document.createElement('div');
        itemEl.className = 'item';
        itemEl.dataset.id = media.id;
        if (isInPlaylist) {
            itemEl.draggable = true;
        }
        itemEl.innerHTML = `
            <span>${media.name}</span>
            <button class="move-btn">${isInPlaylist ? '–' : '+'}</button>
        `;
        listElement.appendChild(itemEl);
    });
}

availableMediasList.addEventListener('click', (e) => {
    if (e.target.classList.contains('move-btn')) {
        const item = e.target.closest('.item');
        item.draggable = true;
        playlistMediasList.appendChild(item);
    }
});
playlistMediasList.addEventListener('click', (e) => {
    if (e.target.classList.contains('move-btn')) {
        const item = e.target.closest('.item');
        item.draggable = false;
        availableMediasList.appendChild(item);
    }
});

// --- LÓGICA DE DRAG AND DROP ---
let draggedItem = null;

playlistMediasList.addEventListener('dragstart', (e) => {
    draggedItem = e.target;
    setTimeout(() => {
        e.target.classList.add('dragging');
    }, 0);
});

playlistMediasList.addEventListener('dragend', (e) => {
    e.target.classList.remove('dragging');
    draggedItem = null;
});

playlistMediasList.addEventListener('dragover', (e) => {
    e.preventDefault();
    const afterElement = getDragAfterElement(playlistMediasList, e.clientY);
    if (afterElement == null) {
        playlistMediasList.appendChild(draggedItem);
    } else {
        playlistMediasList.insertBefore(draggedItem, afterElement);
    }
});

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function savePlaylistMediaOrder() {
    saveMediaChangesBtn.disabled = true;
    saveMediaChangesBtn.textContent = 'Salvando...';
    const mediaIdsInOrder = Array.from(playlistMediasList.querySelectorAll('.item')).map(item => item.dataset.id);
    try {
        const { error } = await db.from('playlists').update({ media_ids: mediaIdsInOrder }).eq('id', currentEditingPlaylistId);
        if (error) throw error;
        alert('Playlist atualizada com sucesso!');
        closeEditMediaModal();
    } catch (error) {
        alert('Erro ao salvar as alterações: ' + error.message);
    } finally {
        saveMediaChangesBtn.disabled = false;
        saveMediaChangesBtn.textContent = 'Salvar Alterações';
    }
}
