// test/_app.js
// Zentrale Stelle: ENV setzen, dann App laden.
// So ist JWT_SECRET garantiert gleich, egal in welcher Reihenfolge Tests laufen.

process.env.JWT_SECRET = "test-secret";

module.exports = require("../be/server");
