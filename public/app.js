const authSection = document.getElementById("authSection");
const shopSection = document.getElementById("shopSection");
const sessionPanel = document.getElementById("sessionPanel");
const welcomeUser = document.getElementById("welcomeUser");
const userBalance = document.getElementById("userBalance");
const messageBox = document.getElementById("messageBox");

const registerForm = document.getElementById("registerForm");
const loginForm = document.getElementById("loginForm");
const sellForm = document.getElementById("sellForm");
const logoutBtn = document.getElementById("logoutBtn");

const availableProducts = document.getElementById("availableProducts");
const myListings = document.getElementById("myListings");
const myPurchases = document.getElementById("myPurchases");

function showMessage(text, type = "success") {
  messageBox.textContent = text;
  messageBox.className = `message ${type}`;
  messageBox.classList.remove("hidden");
}

function clearMessage() {
  messageBox.textContent = "";
  messageBox.className = "message hidden";
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Ha ocurrido un error.");
  }

  return data;
}

function createProductCard(product, mode) {
  const card = document.createElement("article");
  card.className = "card product-card";

  const title = document.createElement("h3");
  title.textContent = product.nombre;

  const price = document.createElement("p");
  price.innerHTML = `Precio: <strong>${product.precio} €</strong>`;

  const seller = document.createElement("p");
  seller.textContent = `Vendedor: ${product.sellerName}`;

  card.append(title, price);

  if (mode === "available") {
    card.append(seller);
    const buyButton = document.createElement("button");
    buyButton.textContent = "Comprar";
    buyButton.addEventListener("click", async () => {
      try {
        clearMessage();
        const result = await api(`/api/products/${product.id}/buy`, {
          method: "POST"
        });
        showMessage(result.message, "success");
        await loadProducts();
      } catch (error) {
        showMessage(error.message, "error");
      }
    });
    card.appendChild(buyButton);
  }

  if (mode === "listing") {
    const state = document.createElement("p");
    state.textContent = "Estado: en venta";
    card.appendChild(state);
  }

  if (mode === "purchase") {
    const status = document.createElement("p");
    status.textContent = "Comprado correctamente";
    card.appendChild(status);
  }

  return card;
}

function renderList(container, items, mode, emptyText) {
  container.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    container.appendChild(createProductCard(item, mode));
  });
}

function setAuthenticatedView(user) {
  authSection.classList.add("hidden");
  shopSection.classList.remove("hidden");
  sessionPanel.classList.remove("hidden");
  welcomeUser.textContent = `Usuario: ${user.username}`;
  userBalance.textContent = user.saldo;
}

function setGuestView() {
  authSection.classList.remove("hidden");
  shopSection.classList.add("hidden");
  sessionPanel.classList.add("hidden");
}

async function checkSession() {
  try {
    const result = await api("/api/me");
    if (result.authenticated) {
      setAuthenticatedView(result.user);
      await loadProducts();
    } else {
      setGuestView();
    }
  } catch (error) {
    setGuestView();
    showMessage(error.message, "error");
  }
}

async function loadProducts() {
  const result = await api("/api/products");

  setAuthenticatedView(result.user);

  const visibles = result.availableProducts.filter(
    (product) => product.sellerId !== result.user.id
  );

  renderList(
    availableProducts,
    visibles,
    "available",
    "No hay productos disponibles para comprar."
  );
  renderList(
    myListings,
    result.myListings,
    "listing",
    "No tienes productos publicados."
  );
  renderList(
    myPurchases,
    result.myPurchases,
    "purchase",
    "Todavía no has comprado nada."
  );
}

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  try {
    const payload = {
      username: document.getElementById("registerUsername").value,
      password: document.getElementById("registerPassword").value
    };

    const result = await api("/api/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    showMessage(result.message, "success");
    registerForm.reset();
  } catch (error) {
    showMessage(error.message, "error");
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  try {
    const payload = {
      username: document.getElementById("loginUsername").value,
      password: document.getElementById("loginPassword").value
    };

    const result = await api("/api/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    showMessage(result.message, "success");
    loginForm.reset();
    setAuthenticatedView(result.user);
    await loadProducts();
  } catch (error) {
    showMessage(error.message, "error");
  }
});

sellForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  try {
    const payload = {
      nombre: document.getElementById("productName").value,
      precio: Number(document.getElementById("productPrice").value)
    };

    const result = await api("/api/products", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    showMessage(result.message, "success");
    sellForm.reset();
    await loadProducts();
  } catch (error) {
    showMessage(error.message, "error");
  }
});

logoutBtn.addEventListener("click", async () => {
  clearMessage();
  try {
    const result = await api("/api/logout", { method: "POST" });
    showMessage(result.message, "success");
    setGuestView();
  } catch (error) {
    showMessage(error.message, "error");
  }
});

checkSession();
