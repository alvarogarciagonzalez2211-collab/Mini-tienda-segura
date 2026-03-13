const state = {
    user: null,
    activeTab: 'login'
};

const elements = {
    message: document.getElementById('message'),
    sessionBox: document.getElementById('sessionBox'),
    currentUser: document.getElementById('currentUser'),
    logoutBtn: document.getElementById('logoutBtn'),

    authPanel: document.getElementById('authPanel'),
    sellPanel: document.getElementById('sellPanel'),
    privatePanel: document.getElementById('privatePanel'),

    tabLogin: document.getElementById('tabLogin'),
    tabRegister: document.getElementById('tabRegister'),
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    sellForm: document.getElementById('sellForm'),

    refreshBtn: document.getElementById('refreshBtn'),
    productsList: document.getElementById('productsList'),
    mySellingList: document.getElementById('mySellingList'),
    myBoughtList: document.getElementById('myBoughtList')
};

function showMessage(text, type = 'success') {
    elements.message.textContent = text;
    elements.message.className = `message ${type}`;
    elements.message.classList.remove('hidden');
}

function hideMessage() {
    elements.message.textContent = '';
    elements.message.className = 'message hidden';
}

function escapeTrimmed(value) {
    return String(value || '').trim();
}

function setLoading(button, isLoading, loadingText = 'Cargando...') {
    if (!button) return;
    if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent;
    }
    button.disabled = isLoading;
    button.textContent = isLoading ? loadingText : button.dataset.originalText;
}

function setActiveTab(tab) {
    state.activeTab = tab;

    const isLogin = tab === 'login';

    elements.tabLogin.classList.toggle('active', isLogin);
    elements.tabRegister.classList.toggle('active', !isLogin);

    elements.loginForm.classList.toggle('hidden', !isLogin);
    elements.registerForm.classList.toggle('hidden', isLogin);

    hideMessage();
}

function formatDate(dateString) {
    try {
        return new Date(dateString).toLocaleString('es-ES');
    } catch {
        return dateString;
    }
}

async function apiFetch(url, options = {}) {
    const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'same-origin',
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    let data;
    try {
        data = await response.json();
    } catch {
        data = { ok: false, error: 'Respuesta no válida del servidor.' };
    }

    if (!response.ok || !data.ok) {
        const error = new Error(data.error || 'Error inesperado.');
        error.status = response.status;
        throw error;
    }

    return data;
}

function renderEmpty(container, text) {
    container.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'empty';
    div.textContent = text;
    container.appendChild(div);
}

function createProductCard(product) {
    const item = document.createElement('article');
    item.className = 'item';

    const head = document.createElement('div');
    head.className = 'item-head';

    const titleBox = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = product.title;

    const seller = document.createElement('p');
    seller.className = 'meta';
    seller.textContent = `Vendedor: ${product.sellerUsername}`;

    titleBox.appendChild(title);
    titleBox.appendChild(seller);

    const price = document.createElement('div');
    price.className = 'price';
    price.textContent = `${product.price.toFixed(2)} €`;

    head.appendChild(titleBox);
    head.appendChild(price);

    const description = document.createElement('p');
    description.textContent = product.description;

    const meta = document.createElement('p');
    meta.className = 'meta';
    meta.textContent = `Publicado: ${formatDate(product.createdAt)}`;

    item.appendChild(head);
    item.appendChild(description);
    item.appendChild(meta);

    if (state.user) {
        const button = document.createElement('button');
        button.className = 'btn';
        button.type = 'button';
        button.textContent = 'Comprar';

        if (product.sellerUsername === state.user.username) {
            button.disabled = true;
            button.textContent = 'Es tu producto';
        } else {
            button.addEventListener('click', async () => {
                try {
                    setLoading(button, true, 'Comprando...');
                    hideMessage();
                    const result = await apiFetch(`/api/products/${product.id}/buy`, {
                        method: 'POST'
                    });
                    showMessage(result.message, 'success');
                    await refreshAll();
                } catch (error) {
                    showMessage(error.message, 'error');
                } finally {
                    setLoading(button, false);
                }
            });
        }

        item.appendChild(button);
    }

    return item;
}

function createSimpleProductCard(product, sold = false) {
    const item = document.createElement('article');
    item.className = 'item';

    const head = document.createElement('div');
    head.className = 'item-head';

    const title = document.createElement('h3');
    title.textContent = product.title;

    const price = document.createElement('div');
    price.className = 'price';
    price.textContent = `${product.price.toFixed(2)} €`;

    head.appendChild(title);
    head.appendChild(price);

    const description = document.createElement('p');
    description.textContent = product.description || '';

    const meta = document.createElement('p');
    meta.className = 'meta';

    if (sold) {
        meta.textContent = `Comprado a ${product.sellerUsername} el ${formatDate(product.soldAt)}`;
    } else {
        meta.textContent = `Publicado: ${formatDate(product.createdAt)}`;
    }

    item.appendChild(head);
    if (product.description) {
        item.appendChild(description);
    }
    item.appendChild(meta);

    return item;
}

async function loadProducts() {
    const data = await apiFetch('/api/products');
    const products = Array.isArray(data.products) ? data.products : [];

    elements.productsList.innerHTML = '';

    if (products.length === 0) {
        renderEmpty(elements.productsList, 'No hay productos disponibles ahora mismo.');
        return;
    }

    for (const product of products) {
        elements.productsList.appendChild(createProductCard(product));
    }
}

async function loadMyProducts() {
    if (!state.user) {
        elements.mySellingList.innerHTML = '';
        elements.myBoughtList.innerHTML = '';
        return;
    }

    const data = await apiFetch('/api/my/products');
    const selling = Array.isArray(data.selling) ? data.selling : [];
    const bought = Array.isArray(data.bought) ? data.bought : [];

    elements.mySellingList.innerHTML = '';
    elements.myBoughtList.innerHTML = '';

    if (selling.length === 0) {
        renderEmpty(elements.mySellingList, 'Todavía no has publicado productos.');
    } else {
        for (const product of selling) {
            elements.mySellingList.appendChild(createSimpleProductCard(product, false));
        }
    }

    if (bought.length === 0) {
        renderEmpty(elements.myBoughtList, 'Todavía no has comprado productos.');
    } else {
        for (const product of bought) {
            elements.myBoughtList.appendChild(createSimpleProductCard(product, true));
        }
    }
}

function updateSessionUI() {
    const loggedIn = Boolean(state.user);

    elements.sessionBox.classList.toggle('hidden', !loggedIn);
    elements.sellPanel.classList.toggle('hidden', !loggedIn);
    elements.privatePanel.classList.toggle('hidden', !loggedIn);

    if (loggedIn) {
        elements.currentUser.textContent = state.user.username;
    } else {
        elements.currentUser.textContent = '';
    }
}

async function loadSession() {
    const data = await apiFetch('/api/auth/me');
    state.user = data.user;
    updateSessionUI();
}

async function refreshAll() {
    await loadSession();
    await loadProducts();

    if (state.user) {
        await loadMyProducts();
    } else {
        elements.mySellingList.innerHTML = '';
        elements.myBoughtList.innerHTML = '';
    }
}

elements.tabLogin.addEventListener('click', () => setActiveTab('login'));
elements.tabRegister.addEventListener('click', () => setActiveTab('register'));

elements.loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideMessage();

    const button = elements.loginForm.querySelector('button[type="submit"]');
    const formData = new FormData(elements.loginForm);

    const username = escapeTrimmed(formData.get('username'));
    const password = String(formData.get('password') || '');

    if (!username || !password) {
        showMessage('Debes completar usuario y contraseña.', 'error');
        return;
    }

    try {
        setLoading(button, true, 'Entrando...');
        const result = await apiFetch('/api/auth/login', {
            method: 'POST',
            body: { username, password }
        });

        elements.loginForm.reset();
        showMessage(result.message, 'success');
        await refreshAll();
    } catch (error) {
        showMessage(error.message, 'error');
    } finally {
        setLoading(button, false);
    }
});

elements.registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideMessage();

    const button = elements.registerForm.querySelector('button[type="submit"]');
    const formData = new FormData(elements.registerForm);

    const username = escapeTrimmed(formData.get('username'));
    const password = String(formData.get('password') || '');

    if (!username || !password) {
        showMessage('Debes completar todos los campos.', 'error');
        return;
    }

    try {
        setLoading(button, true, 'Creando cuenta...');
        const result = await apiFetch('/api/auth/register', {
            method: 'POST',
            body: { username, password }
        });

        elements.registerForm.reset();
        showMessage(result.message, 'success');
        await refreshAll();
    } catch (error) {
        showMessage(error.message, 'error');
    } finally {
        setLoading(button, false);
    }
});

elements.sellForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideMessage();

    const button = elements.sellForm.querySelector('button[type="submit"]');
    const formData = new FormData(elements.sellForm);

    const title = escapeTrimmed(formData.get('title'));
    const description = escapeTrimmed(formData.get('description'));
    const price = Number(formData.get('price'));

    if (!title || !description || !Number.isFinite(price)) {
        showMessage('Debes completar todos los campos del producto.', 'error');
        return;
    }

    try {
        setLoading(button, true, 'Publicando...');
        const result = await apiFetch('/api/products', {
            method: 'POST',
            body: { title, description, price }
        });

        elements.sellForm.reset();
        showMessage(result.message, 'success');
        await refreshAll();
    } catch (error) {
        showMessage(error.message, 'error');
    } finally {
        setLoading(button, false);
    }
});

elements.logoutBtn.addEventListener('click', async () => {
    hideMessage();

    try {
        setLoading(elements.logoutBtn, true, 'Saliendo...');
        const result = await apiFetch('/api/auth/logout', {
            method: 'POST'
        });

        showMessage(result.message, 'success');
        state.user = null;
        updateSessionUI();
        await refreshAll();
    } catch (error) {
        showMessage(error.message, 'error');
    } finally {
        setLoading(elements.logoutBtn, false);
    }
});

elements.refreshBtn.addEventListener('click', async () => {
    hideMessage();

    try {
        setLoading(elements.refreshBtn, true, 'Actualizando...');
        await refreshAll();
    } catch (error) {
        showMessage(error.message, 'error');
    } finally {
        setLoading(elements.refreshBtn, false);
    }
});

(async function init() {
    try {
        setActiveTab('login');
        await refreshAll();
    } catch (error) {
        showMessage(error.message || 'No se pudo cargar la aplicación.', 'error');
    }
})();