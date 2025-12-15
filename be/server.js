const express = require("express");

const app = express();
const hostname = "127.0.0.1";
const port = 3000;
const path = require("path");

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "html")));

app.get("/api/health", (req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
});

app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});
