const SUPABASE_URL = 'https://isqwzrzbjotbwqkzhwqd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzcXd6cnpiam90Yndxa3pod3FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NjI1NDYsImV4cCI6MjA4NzQzODU0Nn0.EgJgqEJPUMh9WaPDKpFzHiyAwf4zsHRF1n1f56ZMSjc';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


// --- Seletores de Elementos ---
const userEmailDisplay = document.getElementById('user-email-display');
const logoutBtn = document.getElementById('logout-btn');
const tvListContainer = document.getElementById('tv-list-container');
const addTvBtn = document.getElementById('add-tv-btn');
const tvModal = document.getElementById('tv-modal');
const tvForm = document.getElementById('tv-form');
const tvModalTitle = document.getElementById('tv-modal-title');
const closeTvModalBtn = document.getElementById('close-tv-modal');
const cancelTvBtn = document.getElementById('cancel-tv-btn');
const tvIdInput = document.getElementById('tv-id');
const tvNameInput = document.getElementById('tv-name');
const tvLocationInput = document.getElementById('tv-location');
const tvPlaylistSelect = document.getElementById('tv-playlist-select');
const tvOrientationSelect = document.getElementById('tv-orientation');
const tvPairingCodeInput = document.getElementById('tv-pairing-code');
const pairingCodeGroup = document.getElementById('pairing-code-group');

let clientId = null; // Variável para guardar o ID do cliente

// --- "SENTINELA" E INICIALIZAÇÃO ---
(async () => {
    const { data: { session } } = await db.auth.getSession();
    if (!session) {
        window.location.href = '../auth/auth.html';
        return;
    }
    
    clientId = session.user.user_metadata.client_id;
    if (!clientId) {
        alert("Erro crítico: ID do cliente não encontrado. Por favor, faça login novamente.");
        await db.auth.signOut();
        window.location.href = '../auth/auth.html';
        return;
    }

    userEmailDisplay.textContent = session.user.email;
    loadTvs();
})();

// --- LÓGICA DE LOGOUT ---
logoutBtn.addEventListener('click', async () => {
    await db.auth.signOut();
    window.location.href = '../auth/auth.html';
});

// --- FUNÇÕES DO MODAL ---
async function openTvModal(tv = null) {
    tvForm.reset();
    
    if (tv) { // Editando uma TV existente
        tvModalTitle.textContent = 'Editar TV';
        tvIdInput.value = tv.id;
        tvNameInput.value = tv.name;
        tvLocationInput.value = tv.location;
        tvOrientationSelect.value = tv.orientation;
        pairingCodeGroup.style.display = 'none';
        tvPairingCodeInput.required = false;
        await populatePlaylistSelect(tv.playlist_id);
    } else { // Registrando (pareando) uma nova TV
        tvModalTitle.textContent = 'Registrar Nova TV';
        tvIdInput.value = '';
        pairingCodeGroup.style.display = 'block';
        tvPairingCodeInput.required = true;
        await populatePlaylistSelect();
    }
    tvModal.style.display = 'flex';
}

function closeTvModal() {
    tvModal.style.display = 'none';
}

addTvBtn.addEventListener('click', () => openTvModal());
closeTvModalBtn.addEventListener('click', closeTvModal);
cancelTvBtn.addEventListener('click', closeTvModal);

async function populatePlaylistSelect(selectedPlaylistId = null) {
    try {
        const { data: playlists, error } = await db.from('playlists').select('id, name');
        if (error) throw error;
        
        tvPlaylistSelect.innerHTML = '<option value="">Nenhuma</option>';
        playlists.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.name;
            if (p.id === selectedPlaylistId) {
                option.selected = true;
            }
            tvPlaylistSelect.appendChild(option);
        });
    } catch (error) {
        tvPlaylistSelect.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}


// --- LÓGICA DE GERENCIAMENTO DE TVS (CRUD) ---

async function loadTvs() {
    tvListContainer.innerHTML = '<p>Buscando TVs registradas...</p>';
    try {
        const { data: tvs, error } = await db.from('tvs')
            .select('*, playlists(name)')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false });
        if (error) throw error;

        if (tvs.length === 0) {
            tvListContainer.innerHTML = '<p>Nenhuma TV registrada. Ligue uma TV e use o código para registrar.</p>';
            return;
        }

        tvListContainer.innerHTML = tvs.map(tv => `
            <div class="item">
                <div class="item-info">
                    <div class="name">${tv.name}</div>
                    <div class="details">
                        Local: ${tv.location || 'N/A'} | Playlist: ${tv.playlists?.name || 'Nenhuma'}
                    </div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-sm btn-secondary edit-tv-btn" data-id="${tv.id}">Editar</button>
                    <button class="btn btn-sm btn-danger delete-tv-btn" data-id="${tv.id}">Excluir</button>
                </div>
            </div>
        `).join('');

        document.querySelectorAll('.edit-tv-btn').forEach(b => {
            b.addEventListener('click', () => {
                const id = b.dataset.id;
                const tv = tvs.find(t => t.id === id);
                openTvModal(tv);
            });
        });
        document.querySelectorAll('.delete-tv-btn').forEach(b => b.addEventListener('click', (e) => deleteTv(e.target.dataset.id)));

    } catch (error) {
        tvListContainer.innerHTML = `<p style="color:red;">Erro ao carregar TVs: ${error.message}</p>`;
    }
}

tvForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = tvIdInput.value;
    
    const baseData = {
        name: tvNameInput.value,
        location: tvLocationInput.value,
        playlist_id: tvPlaylistSelect.value || null,
        orientation: tvOrientationSelect.value,
    };

    try {
        let error;
        if (id) {
            // Editando uma TV existente
            ({ error } = await db.from('tvs').update(baseData).eq('id', id));
        } else {
            // LÓGICA DE PAREAMENTO CORRIGIDA
            const pairingCode = tvPairingCodeInput.value.trim().toUpperCase();
            if (!pairingCode) {
                alert("O código de pareamento é obrigatório.");
                return;
            }
            
            // CORREÇÃO: Prepara os dados para a atualização SEM anular o pairing_code
            const updateData = {
                ...baseData,
                client_id: clientId
                // A linha "pairing_code: null" foi REMOVIDA daqui
            };
            
            const { data: updatedTvs, error: updateError } = await db
                .from('tvs')
                .update(updateData)
                .eq('pairing_code', pairingCode)
                .select();

            if (updateError) throw updateError;
            
            if (!updatedTvs || updatedTvs.length === 0) {
                throw new Error("Código de pareamento inválido ou já utilizado.");
            }
        }

        closeTvModal();
        loadTvs();
    } catch (error) {
        alert('Erro ao salvar TV: ' + error.message);
    }
});

async function deleteTv(id) {
    if (!confirm('Tem certeza que deseja excluir esta TV?')) return;
    try {
        const { error } = await db.from('tvs').delete().eq('id', id);
        if (error) throw error;
        loadTvs();
    } catch (error) {
        alert('Erro ao excluir TV: ' + error.message);
    }
}
