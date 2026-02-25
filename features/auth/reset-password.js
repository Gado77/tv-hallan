// features/auth/reset-password.js
const SUPABASE_URL = 'https://isqwzrzbjotbwqkzhwqd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzcXd6cnpiam90Yndxa3pod3FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NjI1NDYsImV4cCI6MjA4NzQzODU0Nn0.EgJgqEJPUMh9WaPDKpFzHiyAwf4zsHRF1n1f56ZMSjc';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const resetForm       = document.getElementById('reset-password-form');
const newPasswordInput = document.getElementById('new-password');
const messageArea     = document.getElementById('message-area');
const feedbackMessage = document.getElementById('feedback-message');

window.addEventListener('DOMContentLoaded', () => {
    const hash   = window.location.hash;
    const params = new URLSearchParams(hash.substring(1));
    if (params.has('access_token') && (params.get('type') === 'recovery' || params.get('type') === 'invite')) {
        messageArea.textContent  = "Link válido. Por favor, crie sua nova senha.";
        resetForm.style.display = 'block';
    }
});

db.auth.onAuthStateChange(async (event) => {
    if (event === "PASSWORD_RECOVERY") {
        messageArea.textContent  = "Token verificado. Você já pode criar sua nova senha.";
        resetForm.style.display = 'block';
    }
});

resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await db.auth.updateUser({ password: newPasswordInput.value });
    if (error) {
        showFeedback(`Erro ao atualizar a senha: ${error.message}`, 'error');
    } else {
        messageArea.textContent  = "Senha atualizada com sucesso! Você já pode fazer o login.";
        resetForm.style.display = 'none';
        showFeedback('Senha atualizada com sucesso!', 'success');
        setTimeout(() => { window.location.href = './auth.html'; }, 3000);
    }
});

function showFeedback(message, type = 'success') {
    feedbackMessage.textContent = message;
    feedbackMessage.className   = `toast show ${type}`;
    setTimeout(() => feedbackMessage.classList.remove('show'), 5000);
}
