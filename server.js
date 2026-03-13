const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

const usersFile = path.join(__dirname, "data", "users.json");
const productsFile = path.join(__dirname, "data", "products.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: "mini-tienda-secreta",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 }
  })
);

function readJSON(filePath, defaultValue = []) {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const content = fs.readFileSync(filePath, "utf8");
    if (!content.trim()) return defaultValue;
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error leyendo ${filePath}:`, error.message);
    return defaultValue;
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function getCurrentUser(req) {
  const users = readJSON(usersFile);
  return users.find((user) => user.id === req.session.userId) || null;
}

function requireAuth(req, res, next) {
  const user = getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ ok: false, message: "Debes iniciar sesión." });
  }
  req.user = user;
  next();
}

app.post("/api/register", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "").trim();

  if (!username || !password) {
    return res.status(400).json({ ok: false, message: "Completa usuario y contraseña." });
  }

  if (password.length < 4) {
    return res.status(400).json({ ok: false, message: "La contraseña debe tener al menos 4 caracteres." });
  }

  const users = readJSON(usersFile);
  const exists = users.some((u) => u.username.toLowerCase() === username.toLowerCase());

  if (exists) {
    return res.status(409).json({ ok: false, message: "Ese usuario ya existe." });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const newUser = {
    id: Date.now().toString(),
    username,
    passwordHash,
    saldo: 1000
  };

  users.push(newUser);
  writeJSON(usersFile, users);

  res.json({ ok: true, message: "Usuario registrado correctamente." });
});

app.post("/api/login", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "").trim();

  const users = readJSON(usersFile);
  const user = users.find((u) => u.username.toLowerCase() === username.toLowerCase());

  if (!user) {
    return res.status(401).json({ ok: false, message: "Usuario o contraseña incorrectos." });
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);

  if (!validPassword) {
    return res.status(401).json({ ok: false, message: "Usuario o contraseña incorrectos." });
  }

  req.session.userId = user.id;

  res.json({
    ok: true,
    message: "Sesión iniciada.",
    user: {
      id: user.id,
      username: user.username,
      saldo: user.saldo
    }
  });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true, message: "Sesión cerrada." });
  });
});

app.get("/api/me", (req, res) => {
  const user = getCurrentUser(req);
  if (!user) {
    return res.json({ ok: true, authenticated: false });
  }

  res.json({
    ok: true,
    authenticated: true,
    user: {
      id: user.id,
      username: user.username,
      saldo: user.saldo
    }
  });
});

app.get("/api/products", requireAuth, (req, res) => {
  const products = readJSON(productsFile);
  const availableProducts = products.filter((product) => product.disponible);
  const myListings = products.filter(
    (product) => product.sellerId === req.user.id && product.disponible
  );
  const myPurchases = products.filter(
    (product) => product.ownerId === req.user.id && !product.disponible
  );

  res.json({
    ok: true,
    availableProducts,
    myListings,
    myPurchases,
    user: {
      id: req.user.id,
      username: req.user.username,
      saldo: req.user.saldo
    }
  });
});

app.post("/api/products", requireAuth, (req, res) => {
  const nombre = String(req.body.nombre || "").trim();
  const precio = Number(req.body.precio);

  if (!nombre || Number.isNaN(precio) || precio <= 0) {
    return res.status(400).json({ ok: false, message: "Introduce un nombre y un precio válidos." });
  }

  const products = readJSON(productsFile);

  const newProduct = {
    id: Date.now().toString(),
    nombre,
    precio,
    sellerId: req.user.id,
    sellerName: req.user.username,
    ownerId: null,
    disponible: true
  };

  products.push(newProduct);
  writeJSON(productsFile, products);

  res.json({ ok: true, message: "Producto publicado correctamente.", product: newProduct });
});

app.post("/api/products/:id/buy", requireAuth, (req, res) => {
  const users = readJSON(usersFile);
  const products = readJSON(productsFile);

  const buyerIndex = users.findIndex((user) => user.id === req.user.id);
  const productIndex = products.findIndex(
    (product) => product.id === req.params.id && product.disponible
  );

  if (productIndex === -1) {
    return res.status(404).json({ ok: false, message: "Producto no disponible." });
  }

  const product = products[productIndex];

  if (product.sellerId === req.user.id) {
    return res.status(400).json({ ok: false, message: "No puedes comprar tu propio producto." });
  }

  if (users[buyerIndex].saldo < product.precio) {
    return res.status(400).json({ ok: false, message: "No tienes saldo suficiente." });
  }

  const sellerIndex = users.findIndex((user) => user.id === product.sellerId);

  users[buyerIndex].saldo -= product.precio;
  if (sellerIndex !== -1) {
    users[sellerIndex].saldo += product.precio;
  }

  products[productIndex].disponible = false;
  products[productIndex].ownerId = req.user.id;

  writeJSON(usersFile, users);
  writeJSON(productsFile, products);

  res.json({ ok: true, message: "Compra realizada correctamente." });
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
