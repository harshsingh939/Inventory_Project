/**
 * Vercel serverless entry: all requests are routed here via vercel.json rewrites.
 * @see https://vercel.com/guides/using-express-with-vercel
 */
const app = require('../server');

module.exports = app;
