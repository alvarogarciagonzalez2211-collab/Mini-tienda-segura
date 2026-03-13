function createHttpError(status, publicMessage) {
  const error = new Error(publicMessage);
  error.status = status;
  error.publicMessage = publicMessage;
  return error;
}

function badRequest(message = 'Solicitud no válida.') {
  return createHttpError(400, message);
}

function unauthorized(message = 'Debes iniciar sesión para continuar.') {
  return createHttpError(401, message);
}

function forbidden(message = 'No tienes permisos para realizar esta acción.') {
  return createHttpError(403, message);
}

function notFound(message = 'Recurso no encontrado.') {
  return createHttpError(404, message);
}

function conflict(message = 'Conflicto en la solicitud.') {
  return createHttpError(409, message);
}

function validateUsername(username) {
  const value = String(username || '').trim();

  if (!value) {
    throw badRequest('El nombre de usuario es obligatorio.');
  }

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(value)) {
    throw badRequest('El usuario debe tener entre 3 y 20 caracteres y solo puede contener letras, números y guion bajo.');
  }

  return value;
}

function validatePassword(password) {
  const value = String(password || '');

  if (!value) {
    throw badRequest('La contraseña es obligatoria.');
  }

  if (value.length < 10 || value.length > 72) {
    throw badRequest('La contraseña debe tener entre 10 y 72 caracteres.');
  }

  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasNumber = /[0-9]/.test(value);
  const hasSymbol = /[^A-Za-z0-9]/.test(value);

  if (!hasUpper || !hasLower || !hasNumber || !hasSymbol) {
    throw badRequest('La contraseña debe incluir mayúscula, minúscula, número y símbolo.');
  }

  return value;
}

function validateProductInput(body) {
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  const price = Number(body.price);

  if (!title || !description || !Number.isFinite(price)) {
    throw badRequest('Debes completar todos los campos del producto.');
  }

  if (title.length < 3 || title.length > 60) {
    throw badRequest('El título debe tener entre 3 y 60 caracteres.');
  }

  if (description.length < 10 || description.length > 300) {
    throw badRequest('La descripción debe tener entre 10 y 300 caracteres.');
  }

  if (price <= 0 || price > 1000000) {
    throw badRequest('El precio debe ser mayor que 0 y razonable.');
  }

  const priceCents = Math.round(price * 100);

  return {
    title,
    description,
    priceCents
  };
}

function centsToEuros(cents) {
  return Number(cents) / 100;
}

module.exports = {
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  validateUsername,
  validatePassword,
  validateProductInput,
  centsToEuros
};