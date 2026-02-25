const SUPABASE_URL = 'https://isqwzrzbjotbwqkzhwqd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzcXd6cnpiam90Yndxa3pod3FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NjI1NDYsImV4cCI6MjA4NzQzODU0Nn0.EgJgqEJPUMh9WaPDKpFzHiyAwf4zsHRF1n1f56ZMSjc';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// CORREÇÃO 1: Caminho absoluto para o import a partir da raiz do site

// --- Seletores de Elementos ---
const userEmailDisplay = document.getElementById('user-email-display');
const logoutBtn = document.getElementById('logout-btn');
const settingsForm = document.getElementById('settings-form');
const logoUploadInput = document.getElementById('logo-upload');
const logoSizeInput = document.getElementById('logo-size');
const logoSizeValue = document.getElementById('logo-size-value');
const currentLogoPreview = document.getElementById('current-logo-preview');
const infoPanelEnabledInput = document.getElementById('info-panel-enabled');
const weatherApiKeyInput = document.getElementById('weather-api-key');
const weatherCityInput = document.getElementById('weather-city');
const feedbackMessage = document.getElementById('feedback-message');

let clientId = null;
let currentSettings = {};

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
        alert("Erro crítico: ID do cliente não encontrado.");
        await db.auth.signOut();
        // CORREÇÃO 3: Usa a URL amigável para a página de login
        window.location.href = '../auth/auth.html';
        return;
    }

    userEmailDisplay.textContent = session.user.email;
    loadSettings();

    logoSizeInput.addEventListener('input', () => {
        if (logoSizeValue) {
            logoSizeValue.textContent = logoSizeInput.value;
        }
    });
})();

// --- LÓGICA DE LOGOUT ---
logoutBtn.addEventListener('click', async () => {
    await db.auth.signOut();
    // CORREÇÃO 4: Usa a URL amigável para a página de login
    window.location.href = '../auth/auth.html';
});

// --- LÓGICA DE CONFIGURAÇÕES ---
async function loadSettings() {
    try {
        const { data, error } = await db.from('settings').select('*').eq('client_id', clientId).single();
        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
            currentSettings = data;
            const size = data.logo_size || 10;
            logoSizeInput.value = size;
            logoSizeValue.textContent = size;
            infoPanelEnabledInput.checked = data.info_panel_enabled;
            weatherApiKeyInput.value = data.weather_api_key || '';
            weatherCityInput.value = data.weather_city || '';

            if (data.logo_url) {
                currentLogoPreview.innerHTML = `<p>Logo Atual:</p><img src="${data.logo_url}" alt="Logo atual" style="max-height: 80px; background: #555; padding: 10px; border-radius: 5px;">`;
            } else {
                currentLogoPreview.innerHTML = '';
            }
        }
    } catch (error) {
        showFeedback(`Erro ao carregar configurações: ${error.message}`, 'error');
    }
}

settingsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = settingsForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Salvando...';

    try {
        const newLogoFile = logoUploadInput.files[0];
        let logoUpdate = {};

        if (newLogoFile) {
            if (currentSettings.logo_file_path) {
                await db.storage.from('midias').remove([currentSettings.logo_file_path]);
            }
            const newFilePath = `${clientId}/logo/${Date.now()}_${newLogoFile.name}`;
            const { error: uploadError } = await db.storage.from('midias').upload(newFilePath, newLogoFile);
            if (uploadError) throw uploadError;
            const { data: urlData } = db.storage.from('midias').getPublicUrl(newFilePath);
            logoUpdate = { logo_url: urlData.publicUrl, logo_file_path: newFilePath };
        }

        const updatedSettings = {
            client_id: clientId,
            ...logoUpdate,
            logo_size: parseInt(logoSizeInput.value),
            info_panel_enabled: infoPanelEnabledInput.checked,
            weather_api_key: weatherApiKeyInput.value.trim(),
            weather_city: weatherCityInput.value.trim(),
        };

        const { error } = await db.from('settings').upsert(updatedSettings, { onConflict: 'client_id' });
        if (error) throw error;

        showFeedback('Configurações salvas com sucesso!', 'success');
        loadSettings();

    } catch (error) {
        showFeedback(`Erro ao salvar: ${error.message}`, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Salvar Configurações';
    }
});

function showFeedback(message, type = 'success') {
    feedbackMessage.textContent = message;
    feedbackMessage.className = `toast show ${type}`;
    setTimeout(() => {
        feedbackMessage.classList.remove('show');
    }, 4000);
}
