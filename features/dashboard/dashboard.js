const SUPABASE_URL = 'https://isqwzrzbjotbwqkzhwqd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzcXd6cnpiam90Yndxa3pod3FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NjI1NDYsImV4cCI6MjA4NzQzODU0Nn0.EgJgqEJPUMh9WaPDKpFzHiyAwf4zsHRF1n1f56ZMSjc';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


// --- Seletores de Elementos ---
const userEmailDisplay = document.getElementById('user-email-display');
const logoutBtn = document.getElementById('logout-btn');
const statsContainer = document.getElementById('stats-container');
const mediaCountEl = document.getElementById('media-count');
const playlistCountEl = document.getElementById('playlist-count');
const tvCountEl = document.getElementById('tv-count');

// --- "SENTINELA" DE AUTENTICAÇÃO E INICIALIZAÇÃO ---
(async () => {
    const { data: { session } } = await db.auth.getSession();
    if (!session) {
        window.location.href = '../auth/auth.html';
        return;
    }
    userEmailDisplay.textContent = session.user.email;
    loadDashboardData();
})();

// --- LÓGICA DE LOGOUT ---
logoutBtn.addEventListener('click', async () => {
    await db.auth.signOut();
    window.location.href = '../auth/auth.html';
});

// --- LÓGICA PRINCIPAL DO DASHBOARD ---
async function loadDashboardData() {
    try {
        const [mediaResponse, playlistResponse, tvResponse] = await Promise.all([
            db.from('medias').select('*', { count: 'exact', head: true }),
            db.from('playlists').select('*', { count: 'exact', head: true }),
            db.from('tvs').select('*', { count: 'exact', head: true })
        ]);

        if (mediaResponse.error) throw mediaResponse.error;
        if (playlistResponse.error) throw playlistResponse.error;
        if (tvResponse.error) throw tvResponse.error;

        mediaCountEl.textContent = mediaResponse.count;
        playlistCountEl.textContent = playlistResponse.count;
        tvCountEl.textContent = tvResponse.count;

        statsContainer.style.visibility = 'visible';
        setupClickableStats();
    } catch (error) {
        console.error("Erro ao carregar dados do dashboard:", error);
        statsContainer.innerHTML = `<p style="color:red;">Não foi possível carregar as estatísticas.</p>`;
    }
}

function setupClickableStats() {
    document.querySelectorAll('.stat-card-link').forEach(link => {
        link.addEventListener('click', function(event) {
            event.preventDefault(); 
            window.location.href = this.href;
        });
    });
}
