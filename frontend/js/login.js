document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');

    // Si el usuario ya está logueado, redirigirlo a la página principal
    if (localStorage.getItem('authToken')) {
        window.location.href = '../index.html';
        return;
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(loginForm);
            const data = Object.fromEntries(formData.entries());

            loginForm.querySelector('button').setAttribute('aria-busy', 'true');
            errorMessage.style.display = 'none';

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });

                const result = await response.json();

                if (response.ok) {
                    // **CAMBIO CLAVE**: Guardamos tanto el token como el rol del usuario
                    localStorage.setItem('authToken', result.accessToken);
                    localStorage.setItem('userRole', result.rol);
                    
                    window.location.href = '../index.html'; // Redirigir a la página principal
                } else {
                    errorMessage.textContent = result.error || 'Ocurrió un error desconocido.';
                    errorMessage.style.display = 'block';
                }
            } catch (error) {
                console.error('Error de red:', error);
                errorMessage.textContent = 'No se pudo conectar con el servidor.';
                errorMessage.style.display = 'block';
            } finally {
                loginForm.querySelector('button').removeAttribute('aria-busy');
            }
        });
    }
});