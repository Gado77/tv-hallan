const SUPABASE_URL = 'https://isqwzrzbjotbwqkzhwqd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzcXd6cnpiam90Yndxa3pod3FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NjI1NDYsImV4cCI6MjA4NzQzODU0Nn0.EgJgqEJPUMh9WaPDKpFzHiyAwf4zsHRF1n1f56ZMSjc';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// CORREÇÃO 1: Caminho absoluto para o import a partir da raiz do site

// --- Seletores de Elementos e Variáveis Globais ---
const userEmailDisplay = document.getElementById('user-email-display');
const logoutBtn = document.getElementById('logout-btn');
const addMediaForm = document.getElementById('add-media-form');
const mediaListContainer = document.getElementById('media-list-container');
let clientId = null; // Variável para guardar o ID do cliente

// --- "SENTINELA" DE AUTENTICAÇÃO E INICIALIZAÇÃO DA PÁGINA ---
(async () => {
    const { data: { session } } = await db.auth.getSession();
    if (!session) {
        // CORREÇÃO 2: Usa a URL amigável para a página de login
        window.location.href = '../auth/auth.html';
        return;
    }

    clientId = session.user.user_metadata.client_id;
    if (!clientId) {
        alert("Erro crítico: ID do cliente não encontrado. Por favor, faça login novamente.");
        await db.auth.signOut();
        // CORREÇÃO 3: Usa a URL amigável para a página de login
        window.location.href = '../auth/auth.html';
        return;
    }

    userEmailDisplay.textContent = session.user.email;
    loadMedias();
})();

// --- LÓGICA DE LOGOUT ---
logoutBtn.addEventListener('click', async () => {
    await db.auth.signOut();
    // CORREÇÃO 4: Usa a URL amigável para a página de login
    window.location.href = '../auth/auth.html';
});

// --- LÓGICA DE GERENCIAMENTO DE MÍDIAS ---

async function loadMedias() {
    mediaListContainer.innerHTML = '<p>Buscando mídias...</p>';
    try {
        const { data: medias, error } = await db.from('medias').select('*').order('created_at', { ascending: false });
        if (error) throw error;

        if (medias.length === 0) {
            mediaListContainer.innerHTML = '<p>Nenhuma mídia encontrada. Adicione a primeira!</p>';
            return;
        }

        mediaListContainer.innerHTML = medias.map(media => `
            <div class="item">
                <div class="item-info">
                    <div class="name">${media.name}</div>
                    <div class="details">Tipo: ${media.type} | Duração: ${media.duration || 'N/A'}s</div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-sm btn-danger delete-media-btn" data-id="${media.id}" data-path="${media.file_path}">Excluir</button>
                </div>
            </div>
        `).join('');

        document.querySelectorAll('.delete-media-btn').forEach(button => {
            button.addEventListener('click', handleDeleteMedia);
        });

    } catch (error) {
        mediaListContainer.innerHTML = `<p style="color:red;">Erro ao carregar mídias: ${error.message}</p>`;
    }
}

function getVideoDuration(file) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = function() {
            window.URL.revokeObjectURL(video.src);
            resolve(Math.round(video.duration));
        }
        video.onerror = function() {
            reject("Não foi possível carregar os metadados do vídeo.");
        }
        video.src = URL.createObjectURL(file);
    });
}

addMediaForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = addMediaForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Enviando...';

    const mediaName = document.getElementById('media-name').value;
    const mediaFile = document.getElementById('media-file').files[0];
    const mediaDurationInput = document.getElementById('media-duration').value;

    if (!mediaFile || !mediaName) {
        alert("Por favor, selecione um arquivo e preencha o nome.");
        submitButton.disabled = false;
        submitButton.textContent = 'Adicionar Mídia';
        return;
    }

    try {
        const isVideo = mediaFile.type.startsWith('video');
        const duration = isVideo ? await getVideoDuration(mediaFile) : parseInt(mediaDurationInput) || 10;
        
        const filePath = `${clientId}/${Date.now()}_${mediaFile.name}`;
        const { error: uploadError } = await db.storage.from('midias').upload(filePath, mediaFile);
        if (uploadError) throw uploadError;

        const { data: urlData } = db.storage.from('midias').getPublicUrl(filePath);

        const mediaData = {
            name: mediaName,
            type: isVideo ? 'video' : 'image',
            duration: duration,
            url: urlData.publicUrl,
            file_path: filePath,
            client_id: clientId
        };

        const { error: insertError } = await db.from('medias').insert([mediaData]);
        if (insertError) throw insertError;

        alert('Mídia adicionada com sucesso!');
        addMediaForm.reset();
        loadMedias();

    } catch (error) {
        alert(`Erro ao adicionar mídia: ${error.message}`);
        console.error("Detalhes do erro:", error);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Adicionar Mídia';
    }
});

async function handleDeleteMedia(event) {
    const mediaId = event.target.dataset.id;
    const mediaPath = event.target.dataset.path;

    if (!confirm('Tem certeza que deseja excluir esta mídia? Esta ação não pode ser desfeita.')) return;

    try {
        if (mediaPath) {
             const { error: storageError } = await db.storage.from('midias').remove([mediaPath]);
             if (storageError) console.error("Aviso: o arquivo no storage não foi removido.", storageError);
        }

        const { error: dbError } = await db.from('medias').delete().eq('id', mediaId);
        if (dbError) throw dbError;

        alert('Mídia excluída com sucesso.');
        loadMedias();

    } catch (error) {
        alert(`Erro ao excluir mídia: ${error.message}`);
        console.error("Detalhes do erro:", error);
    }
}
