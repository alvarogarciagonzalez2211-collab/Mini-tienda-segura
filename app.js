require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');

const {
  initDb,
  getUserByUsername,
  getUserById,
  createUser,
  listAvailableProducts,
  createProduct,
  getMyProducts,
  buyProduct
} = require('./db');

const {
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  validateUsername,
  validatePassword,
  validateProductInput,
  centsToEuros
} = require('./utils');

const PORT = Number(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return next(unauthorized());
  }
  next();
}

function sameOriginGuard(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  const origin = req.get('origin');
  const host = `${req.protocol}://${req.get('host')}`;

  if (origin && origin !== host) {
    return next(forbidden('Origen de la petición no permitido.'));
  }

  next();
}

function noStore(_req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  next();
}

(async () => {
  await initDb();
  const app = express();

  app.disable('x-powered-by');

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"]
      }
    },
    referrerPolicy: { policy: 'no-referrer' }
  }));

  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: false, limit: '10kb' }));
  app.use(sameOriginGuard);

  app.use(session({
    name: 'mini_tienda_sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 2
    }
  }));

  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: 'Demasiadas peticiones. Inténtalo de nuevo más tarde.' }
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { ok: false, error: 'Demasiados intentos de autenticación. Espera unos minutos.' }
  });

  app.use(globalLimiter);
  app.use(express.static(path.join(__dirname, 'public'), {
    etag: false,
    maxAge: 0,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-store');
    }
  }));

  app.get('/api/auth/me', noStore, async (req, res, next) => {
    try {
      if (!req.session.userId) {
        return res.json({ ok: true, user: null });
      }

      const user = await getUserById(req.session.userId);
      if (!user) {
        req.session.destroy(() => {});
        return res.json({ ok: true, user: null });
      }

      return res.json({
        ok: true,
        user: {
          id: user.id,
          username: user.username,
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/register', authLimiter, noStore, async (req, res, next) => {
    try {
      const username = validateUsername(req.body.username);
      const password = validatePassword(req.body.password);
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await createUser({ username, passwordHash });

      req.session.regenerate((sessionErr) => {
        if (sessionErr) {
          return next(sessionErr);
        }

        req.session.userId = user.id;
        req.session.save((saveErr) => {
          if (saveErr) {
            return next(saveErr);
          }

          return res.status(201).json({
            ok: true,
            message: 'Cuenta creada correctamente.',
            user: {
              id: user.id,
              username: user.username
            }
          });
        });
      });
    } catch (error) {
      if (error.code === 'USER_EXISTS') {
        return next(conflict(error.message));
      }
      next(error);
    }
  });

  app.post('/api/auth/login', authLimiter, noStore, async (req, res, next) => {
    try {
      const username = validateUsername(req.body.username);
      const password = String(req.body.password || '');

      if (!password) {
        throw badRequest('Debes introducir usuario y contraseña.');
      }

      const user = await getUserByUsername(username);
      const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;

      if (!user || !passwordMatches) {
        throw unauthorized('Credenciales incorrectas.');
      }

      req.session.regenerate((sessionErr) => {
        if (sessionErr) {
          return next(sessionErr);
        }

        req.session.userId = user.id;
        req.session.save((saveErr) => {
          if (saveErr) {
            return next(saveErr);
          }

          return res.json({
            ok: true,
            message: 'Has iniciado sesión correctamente.',
            user: {
              id: user.id,
              username: user.username
            }
          });
        });
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/logout', noStore, requireAuth, (req, res, next) => {
    req.session.destroy((err) => {
      if (err) {
        return next(err);
      }
      res.clearCookie('mini_tienda_sid');
      return res.json({ ok: true, message: 'Sesión cerrada correctamente.' });
    });
  });

  app.get('/api/products', async (_req, res, next) => {
    try {
      const products = await listAvailableProducts();
      return res.json({
        ok: true,
        products: products.map((product) => ({
          id: product.id,
          title: product.title,
          description: product.description,
          price: centsToEuros(product.priceCents),
          sellerUsername: product.sellerUsername,
          createdAt: product.createdAt
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/my/products', requireAuth, async (req, res, next) => {
    try {
      const data = await getMyProducts(req.session.userId);
      return res.json({
        ok: true,
        selling: data.selling.map((product) => ({
          id: product.id,
          title: product.title,
          description: product.description,
          price: centsToEuros(product.priceCents),
          createdAt: product.createdAt
        })),
        bought: data.bought.map((product) => ({
          id: product.id,
          title: product.title,
          description: product.description,
          price: centsToEuros(product.priceCents),
          sellerUsername: product.sellerUsername,
          soldAt: product.soldAt
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/products', requireAuth, async (req, res, next) => {
    try {
      const { title, description, priceCents } = validateProductInput(req.body);
      const product = await createProduct({
        title,
        description,
        priceCents,
        sellerId: req.session.userId
      });

      return res.status(201).json({
        ok: true,
        message: 'Producto publicado correctamente.',
        product: {
          id: product.id,
          title: product.title,
          description: product.description,
          price: centsToEuros(product.priceCents)
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/products/:id/buy', requireAuth, async (req, res, next) => {
    const productId = Number(req.params.id);

    if (!Number.isInteger(productId) || productId <= 0) {
      return next(badRequest('El identificador del producto no es válido.'));
    }

    try {
      const product = await buyProduct({ productId, buyerId: req.session.userId });
      return res.json({ ok: true, message: `Has comprado "${product.title}" correctamente.` });
    } catch (error) {
      if (error.code === 'PRODUCT_NOT_FOUND') {
        return next(notFound(error.message));
      }
      if (error.code === 'OWN_PRODUCT') {
        return next(forbidden(error.message));
      }
      if (error.code === 'ALREADY_SOLD') {
        return next(conflict(error.message));
      }
      next(error);
    }
  });

  app.use('/api', (_req, _res, next) => next(notFound('Ruta API no encontrada.')));

  app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    const safeMessage = status >= 500
      ? 'Ha ocurrido un error interno. Inténtalo de nuevo más tarde.'
      : (err.publicMessage || 'La solicitud no pudo procesarse.');

    if (status >= 500) {
      console.error(err);
    }

    res.status(status).json({ ok: false, error: safeMessage });
  });

  app.listen(PORT, () => {
    console.log(`Mini tienda segura disponible en http://localhost:${PORT}`);
  });
})();