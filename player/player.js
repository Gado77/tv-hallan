// player/player.js
// Supabase já está disponível globalmente via CDN (window.supabase)

const SUPABASE_URL = 'https://isqwzrzbjotbwqkzhwqd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzcXd6cnpiam90Yndxa3pod3FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NjI1NDYsImV4cCI6MjA4NzQzODU0Nn0.EgJgqEJPUMh9WaPDKpFzHiyAwf4zsHRF1n1f56ZMSjc';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================
// CACHE API — Evita re-download de mídias (protege o egress)
// ============================================================
const CACHE_NAME = 'loopin-media-v1';

async function getMediaFromCache(url) {
    try {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(url);
        if (cached) {
            const blob = await cached.blob();
            return URL.createObjectURL(blob);
        }
    } catch (e) {
        console.warn('[Cache] Erro ao ler cache:', e);
    }
    return null;
}

async function addMediaToCache(url) {
    try {
        const cache = await caches.open(CACHE_NAME);
        await cache.add(url);
        const cached = await cache.match(url);
        const blob = await cached.blob();
        return URL.createObjectURL(blob);
    } catch (e) {
        console.warn('[Cache] Erro ao adicionar ao cache, usando URL direta:', e);
        return url;
    }
}

async function getOrCacheMedia(url) {
    const fromCache = await getMediaFromCache(url);
    if (fromCache) {
        console.log('[Cache] HIT:', url);
        return fromCache;
    }
    console.log('[Cache] MISS — baixando e cacheando:', url);
    return await addMediaToCache(url);
}

// ============================================================
// SELETORES DOM
// ============================================================
const body = document.body;
const mediaContainer = document.getElementById('media-container');
const pairingScreen = document.getElementById('pairing-screen');
const pairingCodeEl = document.getElementById('pairing-code');
const settingsPanel = document.getElementById('settings-panel');
const sidebarLogoImg = document.getElementById('sidebar-logo-img');
const sidebarLocation = document.getElementById('sidebar-location');
const currentWeatherTemp = document.getElementById('current-weather-temp');
const currentWeatherDesc = document.getElementById('current-weather-desc');
const dailyForecastContainer = document.getElementById('daily-forecast-container');
const newsTitle = document.getElementById('news-title');
const newsSummary = document.getElementById('news-summary');
const newsTimestamp = document.querySelector('.news-timestamp');

// ============================================================
// ESTADO GLOBAL
// ============================================================
let tvId = localStorage.getItem('tvId');
let currentPlaylist = [];
let currentMediaIndex = 0;
let mediaTimer;
let realtimeChannel = null;
let pairingChannel = null;
let settings = {};
let isSettingsPanelOpen = false;
let _pollingStarted = false;
let newsItems = [];
let currentNewsIndex = 0;

// ============================================================
// CONTROLE DE INTERFACE
// ============================================================
function showInfoMode() { body.classList.add('info-mode-active'); }
function hideInfoMode() { body.classList.remove('info-mode-active'); }

function updateClock() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    if (newsTimestamp) {
        const dateString = now.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
        newsTimestamp.innerHTML = `${hours}:${minutes} <span>${dateString}</span>`;
    }
}

function showSettingsPanel() {
    if (isSettingsPanelOpen) return;
    isSettingsPanelOpen = true;
    updateConnectionStatus();
    populatePlaylists();
    body.classList.add('settings-active');
    setTimeout(() => settingsPanel.querySelector('.settings-interactive')?.focus(), 500);
}

function hideSettingsPanel() {
    if (!isSettingsPanelOpen) return;
    isSettingsPanelOpen = false;
    body.classList.remove('settings-active');
}

function toggleSettingsPanel() {
    isSettingsPanelOpen ? hideSettingsPanel() : showSettingsPanel();
}

async function populatePlaylists() {
    const select = document.getElementById('playlist-select');
    if (!select || !tvId) return;
    try {
        const { data, error } = await db.rpc('get_playlists_for_tv', { tv_id_input: tvId });
        if (error) throw error;
        select.innerHTML = '';
        if (data && data.length > 0) {
            data.forEach(playlist => {
                const option = document.createElement('option');
                option.value = playlist.id;
                option.textContent = playlist.name;
                if (playlist.id === settings.playlist_id) option.selected = true;
                select.appendChild(option);
            });
        } else {
            select.innerHTML = '<option>Nenhuma playlist encontrada</option>';
        }
    } catch (error) {
        console.error("Erro ao buscar playlists:", error);
        select.innerHTML = '<option>Erro ao carregar</option>';
    }
}

async function saveNewPlaylist() {
    const select = document.getElementById('playlist-select');
    const newPlaylistId = select.value;
    if (!newPlaylistId || !tvId) return;
    try {
        const { error } = await db.from('tvs').update({ playlist_id: newPlaylistId }).eq('id', tvId);
        if (error) throw error;
        alert("Playlist alterada com sucesso! A TV irá atualizar em breve.");
        hideSettingsPanel();
    } catch (error) {
        alert("Erro ao alterar a playlist.");
    }
}

function restartPlayer() {
    if (confirm("Tem certeza que deseja reiniciar o player?")) location.reload();
}

function updateConnectionStatus() {
    const internetStatusEl = document.getElementById('internet-status-value');
    const supabaseStatusEl = document.getElementById('supabase-status-value');
    if (internetStatusEl) internetStatusEl.textContent = navigator.onLine ? 'Conectado ✅' : 'Offline ❌';
    if (supabaseStatusEl) supabaseStatusEl.textContent = realtimeChannel?.state === 'joined' ? 'Conectado ✅' : 'Conectando... 🟡';
}

function unpairTv(withConfirmation = true) {
    const doUnpair = () => {
        localStorage.removeItem('tvId');
        localStorage.removeItem('pendingTvId');
        localStorage.removeItem('pendingCode');
        if (realtimeChannel) db.removeChannel(realtimeChannel);
        if (pairingChannel) db.removeChannel(pairingChannel);
        location.reload();
    };
    if (withConfirmation) {
        if (confirm("Tem certeza que deseja desparear esta TV?")) doUnpair();
    } else {
        doUnpair();
    }
}

function handleSettingsNavigation(direction) {
    const focusable = Array.from(settingsPanel.querySelectorAll('.settings-interactive'));
    if (!focusable.length) return;
    let currentIndex = focusable.indexOf(document.activeElement);
    if (direction === 'down') currentIndex = (currentIndex + 1) % focusable.length;
    else if (direction === 'up') currentIndex = (currentIndex - 1 + focusable.length) % focusable.length;
    focusable[currentIndex].focus();
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.error(err.message));
    } else {
        document.exitFullscreen();
    }
}

// ============================================================
// REPRODUÇÃO DE MÍDIA (com Cache API)
// ============================================================
async function playMediaAtIndex(index) {
    clearTimeout(mediaTimer);
    const spinner = mediaContainer.querySelector('.loading-spinner');

    if (!currentPlaylist || currentPlaylist.length === 0) {
        if (spinner) spinner.style.display = 'none';
        mediaContainer.innerHTML = `<div class="overlay"><h1>Nenhuma playlist selecionada.</h1><p>Por favor, associe uma playlist a esta TV no painel de administração.</p></div>`;
        return;
    }

    if (spinner) spinner.style.display = 'block';

    currentMediaIndex = (index + currentPlaylist.length) % currentPlaylist.length;
    const media = currentPlaylist[currentMediaIndex];

    if (!media || !media.url) {
        console.warn("Mídia inválida encontrada, a pular...");
        if (spinner) spinner.style.display = 'none';
        setTimeout(() => playMediaAtIndex(currentMediaIndex + 1), 500);
        return;
    }

    const mediaUrl = await getOrCacheMedia(media.url);

    const oldElement = mediaContainer.querySelector('img, video');
    if (oldElement) {
        oldElement.classList.remove('active');
        setTimeout(() => oldElement.remove(), 800);
    }

    const elementType = media.type === 'image' ? 'img' : 'video';
    const newElement = document.createElement(elementType);

    const onMediaReady = () => {
        if (spinner) spinner.style.display = 'none';
        newElement.classList.add('active');
        if (elementType === 'video') {
            newElement.play().catch(e => console.error("Erro ao dar play no vídeo:", e));
            newElement.onended = () => playMediaAtIndex(currentMediaIndex + 1);
        } else {
            const duration = media.duration || 10;
            mediaTimer = setTimeout(() => playMediaAtIndex(currentMediaIndex + 1), duration * 1000);
        }
    };

    const onMediaError = () => {
        console.error(`Falha ao carregar mídia: ${media.url}`);
        if (spinner) spinner.style.display = 'none';
        setTimeout(() => playMediaAtIndex(currentMediaIndex + 1), 1000);
    };

    if (elementType === 'video') {
        newElement.preload = 'auto';
        newElement.muted = true;
        newElement.loop = false;
        newElement.addEventListener('canplaythrough', onMediaReady, { once: true });
        newElement.addEventListener('error', onMediaError, { once: true });
    } else {
        newElement.addEventListener('load', onMediaReady, { once: true });
        newElement.addEventListener('error', onMediaError, { once: true });
    }

    newElement.src = mediaUrl;
    mediaContainer.appendChild(newElement);
}

// ============================================================
// CLIMA
// ============================================================
async function fetchWeather() {
    if (!settings.weather_api_key || !settings.weather_city) return;
    try {
        const response = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${settings.weather_city}&appid=${settings.weather_api_key}&units=metric&lang=pt_br`);
        const data = await response.json();
        if (data.cod !== "200") throw new Error(data.message);

        if (sidebarLocation) sidebarLocation.textContent = data.city.name;
        const now = data.list[0];
        if (currentWeatherTemp) currentWeatherTemp.textContent = `${Math.round(now.main.temp)}°`;
        if (currentWeatherDesc) currentWeatherDesc.textContent = now.weather[0].description;

        if (dailyForecastContainer) {
            dailyForecastContainer.innerHTML = '';
            const dailyForecasts = data.list.filter(item => item.dt_txt.includes("12:00:00")).slice(0, 4);
            dailyForecasts.forEach(forecast => {
                const dayName = new Date(forecast.dt * 1000).toLocaleDateString('pt-BR', { weekday: 'long' });
                dailyForecastContainer.innerHTML += `<div class="day-item"><span class="day-name">${dayName}</span><div class="day-details"><span class="temps"><span class="max">${Math.round(forecast.main.temp_max)}°</span><span class="min">${Math.round(forecast.main.temp_min)}°</span></span></div></div>`;
            });
        }
    } catch (error) {
        console.error("Erro ao buscar previsão do tempo:", error.message);
        if (sidebarLocation) sidebarLocation.textContent = "Erro de Clima";
    }
}

// ============================================================
// NOTÍCIAS
// ============================================================
async function fetchNews() {
    try {
        const { data, error } = await db.rpc('get_recent_news');
        if (error) throw error;
        newsItems = data && data.length ? data.map(item => ({ title: item.summary_title, description: item.summary_text })) : [];
        if (newsItems.length > 0) displayNews(0);
        else if (newsTitle) newsTitle.textContent = "Sem notícias recentes.";
    } catch (error) {
        console.error("Erro ao buscar notícias:", error.message);
        if (newsTitle) newsTitle.textContent = "Erro ao carregar notícias.";
    }
}

function displayNews(index) {
    if (!newsItems || newsItems.length === 0) return;
    currentNewsIndex = (index + newsItems.length) % newsItems.length;
    const item = newsItems[currentNewsIndex];
    if (newsTitle) newsTitle.textContent = item.title;
    if (newsSummary) newsSummary.textContent = item.description;
}

// ============================================================
// CONFIGURAÇÕES
// ============================================================
function applySettings(tvData, clientSettingsData) {
    settings = { ...(clientSettingsData || {}), ...(tvData || {}) };
    body.classList.toggle('vertical', settings.orientation === 'vertical');
    if (sidebarLogoImg && settings.logo_url) {
        sidebarLogoImg.src = settings.logo_url;
        const logoSize = Math.max(1, Math.min(20, settings.logo_size || 10));
        const minRem = 4, maxRem = 15;
        sidebarLogoImg.style.maxWidth = `${minRem + ((logoSize - 1) / 19) * (maxRem - minRem)}rem`;
    }
}

// ============================================================
// SYNC DE PLAYLIST (polling silencioso a cada 15min)
// ============================================================
async function syncPlaylist() {
    if (!tvId) return;
    try {
        const { data, error } = await db.rpc('get_player_data', { tv_id_input: tvId });
        if (error) throw error;
        if (!data || !data.tv) return;

        const newPlaylist = data.playlist_medias || [];
        const currentIds = currentPlaylist.map(m => m.id).join(',');
        const newIds = newPlaylist.map(m => m.id).join(',');

        if (currentIds !== newIds) {
            console.log('[Realtime] Playlist atualizada — sincronizando cache...');

            // Remove do cache as mídias que saíram da playlist
            const newUrls = new Set(newPlaylist.map(m => m.url));
            const removedMedias = currentPlaylist.filter(m => !newUrls.has(m.url));

            if (removedMedias.length > 0) {
                try {
                    const cache = await caches.open(CACHE_NAME);
                    for (const media of removedMedias) {
                        await cache.delete(media.url);
                        console.log('[Cache] Removido:', media.url);
                    }
                } catch (e) {
                    console.warn('[Cache] Erro ao limpar cache:', e);
                }
            }

            currentPlaylist = newPlaylist;
            playMediaAtIndex(0);
        } else {
            console.log('[Polling] Sem mudanças na playlist.');
        }
    } catch (error) {
        console.warn('[Polling] Erro ao sincronizar playlist:', error.message);
    }
}

// ============================================================
// CARREGAMENTO INICIAL
// ============================================================
async function getInitialData() {
    if (!tvId) {
        showPairingScreen();
        return;
    }

    try {
        const { data, error } = await db.rpc('get_player_data', { tv_id_input: tvId });
        if (error) throw error;

        if (!data || !data.tv) {
            console.warn('TV não encontrada no banco. Voltando para tela de pareamento.');
            unpairTv(false);
            return;
        }

        if (pairingScreen) pairingScreen.style.display = 'none';

        applySettings(data.tv, data.client_settings);
        currentPlaylist = data.playlist_medias || [];
        playMediaAtIndex(0);

        fetchWeather();
        fetchNews();
        setInterval(fetchWeather, 30 * 60 * 1000);
        setInterval(fetchNews, 5 * 60 * 1000);
        setInterval(() => displayNews(currentNewsIndex + 1), 10 * 1000);

        startRealtimeListeners(tvId);

        if (!_pollingStarted) {
            _pollingStarted = true;
            setInterval(() => {
                console.log('[Polling] Verificando atualizações de playlist...');
                syncPlaylist();
            }, 2 * 60 * 1000);
        }

    } catch (error) {
        console.error("Erro ao carregar dados iniciais:", error.message);
        setTimeout(getInitialData, 10000);
    }
}

// ============================================================
// REALTIME
// ============================================================
function startRealtimeListeners(currentTvId) {
    if (realtimeChannel) db.removeChannel(realtimeChannel);

    realtimeChannel = db.channel(`tv-channel-${currentTvId}`);

    // Escuta mudanças na TV (ex: troca de playlist, orientação)
    realtimeChannel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tvs', filter: `id=eq.${currentTvId}` },
        () => {
            console.log('[Realtime] TV atualizada, recarregando...');
            getInitialData();
        }
    );

    // Escuta mudanças na playlist associada (ex: nova mídia adicionada)
    if (settings.playlist_id) {
        realtimeChannel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'playlists', filter: `id=eq.${settings.playlist_id}` },
            () => {
                console.log('[Realtime] Playlist atualizada, recarregando mídias...');
                syncPlaylist();
            }
        );
    }

    realtimeChannel.subscribe();
}

// ============================================================
// TELA DE PAREAMENTO
// ============================================================
async function showPairingScreen() {
    if (pairingScreen) pairingScreen.style.display = 'flex';
    if (pairingChannel) db.removeChannel(pairingChannel);

    // Se já temos um código pendente salvo, não gera um novo
    let pendingTvId = localStorage.getItem('pendingTvId');
    let code = localStorage.getItem('pendingCode');

    if (!pendingTvId || !code) {
        // Gera novo código e insere na tabela
        code = Math.random().toString(36).substring(2, 8).toUpperCase();
        if (pairingCodeEl) pairingCodeEl.textContent = code;

        try {
            const { data: newTv, error: insertError } = await db
                .from('tvs')
                .insert({ pairing_code: code })
                .select('id')
                .single();

            if (insertError) throw insertError;

            pendingTvId = newTv.id;
            localStorage.setItem('pendingTvId', pendingTvId);
            localStorage.setItem('pendingCode', code);
        } catch (error) {
            console.error("Erro ao criar TV para pareamento:", error.message);
            if (pairingCodeEl) pairingCodeEl.textContent = "ERRO";
            return;
        }
    } else {
        // Restaura o código salvo na tela
        if (pairingCodeEl) pairingCodeEl.textContent = code;
    }

    console.log(`Aguardando pareamento da TV ${pendingTvId} com código ${code}...`);

    // Escuta por UPDATE na TV pelo ID (Realtime só suporta filtro por id)
    pairingChannel = db
        .channel(`pairing-channel-${pendingTvId}`)
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'tvs', filter: `id=eq.${pendingTvId}` },
            (payload) => {
                if (payload.new.client_id) {
                    console.log('Pareamento concluído!', payload.new);
                    // Limpa os dados temporários
                    localStorage.removeItem('pendingTvId');
                    localStorage.removeItem('pendingCode');
                    // Salva o tvId definitivo
                    localStorage.setItem('tvId', payload.new.id);
                    tvId = payload.new.id;
                    if (pairingChannel) db.removeChannel(pairingChannel);
                    getInitialData();
                }
            }
        )
        .subscribe();
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================
function initPlayer() {
    updateClock();
    setInterval(updateClock, 30000);

    document.getElementById('save-playlist-btn')?.addEventListener('click', saveNewPlaylist);
    document.getElementById('restart-player-btn')?.addEventListener('click', restartPlayer);
    document.getElementById('unpair-tv-btn')?.addEventListener('click', () => unpairTv(true));

    document.addEventListener('keydown', (event) => {
        if (isSettingsPanelOpen) {
            event.preventDefault();
            switch (event.key) {
                case 'ArrowUp': handleSettingsNavigation('up'); break;
                case 'ArrowDown': handleSettingsNavigation('down'); break;
                case 'Enter': document.activeElement?.click(); break;
                case 'Escape': hideSettingsPanel(); break;
            }
            return;
        }
        switch (event.key) {
            case 'ArrowUp':
                body.classList.contains('info-mode-active') ? hideInfoMode() : showInfoMode();
                break;
            case 'ArrowDown':
                if (!body.classList.contains('info-mode-active')) toggleSettingsPanel();
                break;
            case 'Escape':
                hideInfoMode();
                hideSettingsPanel();
                break;
            case 'Enter':
                if (!isSettingsPanelOpen && !body.classList.contains('info-mode-active')) toggleFullscreen();
                break;
            case 'ArrowRight':
                body.classList.contains('info-mode-active') ? displayNews(currentNewsIndex + 1) : playMediaAtIndex(currentMediaIndex + 1);
                break;
            case 'ArrowLeft':
                body.classList.contains('info-mode-active') ? displayNews(currentNewsIndex - 1) : playMediaAtIndex(currentMediaIndex - 1);
                break;
        }
    });

    getInitialData();
}

function gerarNovoCodigoPareamento() {
    localStorage.removeItem('pendingTvId');
    localStorage.removeItem('pendingCode');
    if (pairingChannel) db.removeChannel(pairingChannel);
    showPairingScreen();
}

document.addEventListener('DOMContentLoaded', initPlayer);
