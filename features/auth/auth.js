// features/auth/auth.js
const SUPABASE_URL = 'https://isqwzrzbjotbwqkzhwqd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzcXd6cnpiam90Yndxa3pod3FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NjI1NDYsImV4cCI6MjA4NzQzODU0Nn0.EgJgqEJPUMh9WaPDKpFzHiyAwf4zsHRF1n1f56ZMSjc';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const DASHBOARD_URL = '../dashboard/dashboard.html';
const RESET_URL     = 'reset-password.html';

const loginForm           = document.getElementById('login-form');
const signupForm          = document.getElementById('signup-form');
const feedbackMessage     = document.getElementById('feedback-message');
const forgotPasswordLink  = document.getElementById('forgot-password-link');
const openSignupModalBtn  = document.getElementById('open-signup-modal-btn');
const signupModal         = document.getElementById('signup-modal');
const closeSignupModalBtn = document.getElementById('close-signup-modal');

// --- Login ---
loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email    = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = DASHBOARD_URL;
    } catch (error) {
        showFeedback(`Erro no login: ${error.message}`, 'error');
    }
});

// --- Esqueci minha senha ---
forgotPasswordLink.addEventListener('click', async (event) => {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    if (!email) {
        showFeedback('Por favor, digite seu e-mail no campo acima antes de clicar em "Esqueci minha senha".', 'error');
        return;
    }
    try {
        const { error } = await db.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/' + RESET_URL,
        });
        if (error) throw error;
        showFeedback('Se existir uma conta com este e-mail, um link de redefinição foi enviado.', 'success');
    } catch (error) {
        showFeedback(`Erro: ${error.message}`, 'error');
    }
});

// --- Modal de Cadastro ---
openSignupModalBtn.addEventListener('click', (e) => { e.preventDefault(); signupModal.style.display = 'flex'; });
closeSignupModalBtn.addEventListener('click', () => { signupModal.style.display = 'none'; });
signupModal.addEventListener('click', (e) => { if (e.target === signupModal) signupModal.style.display = 'none'; });

signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const clientName   = document.getElementById('signup-client-name').value;
    const userEmail    = document.getElementById('signup-email').value;
    const password     = document.getElementById('signup-password').value;
    const submitButton = signupForm.querySelector('button');
    submitButton.disabled    = true;
    submitButton.textContent = 'A enviar...';
    try {
        const { error } = await db.functions.invoke('solicitar-cadastro', {
            body: { client_name: clientName, user_email: userEmail, password },
        });
        if (error) throw error;
        showFeedback('Solicitação enviada com sucesso! Você será notificado quando a sua conta for aprovada.', 'success');
        signupForm.reset();
        signupModal.style.display = 'none';
    } catch (error) {
        showFeedback(`Erro: ${error.message}`, 'error');
    } finally {
        submitButton.disabled    = false;
        submitButton.textContent = 'Enviar Solicitação';
    }
});

function showFeedback(message, type = 'success', duration = 4000) {
    feedbackMessage.textContent = message;
    feedbackMessage.className   = `toast show ${type}`;
    setTimeout(() => feedbackMessage.classList.remove('show'), duration);
}
