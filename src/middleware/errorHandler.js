function errorHandler(err, req, res, next) {
  console.error('[Erreur]', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.publicMessage || 'Une erreur est survenue. Veuillez réessayer.',
  });
}

module.exports = errorHandler;
