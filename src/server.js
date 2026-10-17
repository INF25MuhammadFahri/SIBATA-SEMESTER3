

import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import * as data from "../common_data.js";
import * as midle from "./middleware/middleware.js"
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
dotenv.config();
// Konfigurasi
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Frontend statis
app.use(express.static(
    path.resolve(__dirname, "../public")
));

// Route halaman utama (Dashboard)
app.get(["/", "/dashboard"], (req, res) => {
    res.sendFile(
        path.resolve(__dirname, "../public/index.html")
    );
});

// Route panel admin
app.get("/admin", (req, res) => {
    res.sendFile(
        path.resolve(__dirname, "../public/admin.html")
    );
});

// Route halaman login
app.get("/login", (req, res) => {
    res.sendFile(
        path.resolve(__dirname, "../public/login.html")
    );
});

// Route API
app.post("/api/login",midle.login);
app.post("/api/logout",midle.logout);
app.post("/api/extendSesion",midle.extendSesionEndpoint);
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        timestamp: Date.now()
    });
});

// 404
app.use((req, res) => {
    res.status(404).json({
        error: "Not Found"
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err);

    if (res.headersSent) {
        return next(err);
    }

    res.status(500).json({
        error: "Internal Server Error"
    });
});

// Jalankan server
const server = app.listen(PORT, HOST, () => {
    console.log(`Server: http://${HOST}:${PORT}`);
});

// Shutdown secara teratur
function shutdown() {
    console.log("Menghentikan server...");

    server.close((err) => {
        if (err) {
            console.error(err);
            process.exitCode = 1;
        }
    });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);