import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import * as data from "./common_data.js";
import * as midle from "./middleware/middleware.js";
import * as route from "./route/route.js";
import * as api from "./api/api.js";
import * as cli from "./cli/cli.js";
import * as db from "./database/db.js";
import cors from "cors";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
dotenv.config();

// Konfigurasi
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);

app.use(cors());
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
app.get("/user_account", (req, res) => {
    res.sendFile(
        path.resolve(__dirname, "../public/user_account.html")
    );
});

// Route panel admin
app.get("/admin", (req, res) => {
    
      res.sendFile(
          path.resolve(__dirname, "../public/admin.html")
      );
    
});
app.get("/account_manager", (req, res) => {
    res.sendFile(
          path.resolve(__dirname, "../public/account_manager.html")
      );
});

// Route halaman login
app.get("/login", (req, res) => {
    res.sendFile(
        path.resolve(__dirname, "../public/login.html")
    );
});

// Route API Otentikasi & Sesi
app.post("/api/login", midle.login);
app.post("/api/logout", midle.logout);
app.post("/api/extendSesion", midle.extendSesionEndpoint);

// Test url
app.get("/api/test", route.get);
app.post("/api/test", route.post);
app.put("/api/test", route.put);
app.delete("/api/test", route.del);

// API Resource
app.use("/api/data_sawah", route.data_sawah.router);
app.use("/api/wilayah", route.wilayah.router);
app.use("/api/infrastruktur", route.infrastruktur.router);
app.use("/api/kandidat_lokasi", route.kandidat_lokasi.router);
app.use("/api/status_lahan", route.status_lahan.router);
app.use("/api/pemilik", route.pemilik.router);
app.use("/api/kabupaten_kota", route.kabupaten_kota.router);
app.use("/api/jenis_pengairan", route.jenis_pengairan.router);
app.get("/api/joined", route.getJoined);
app.get("/api/databaseStatus",route.getDbStatus);
app.use("/api/accounts",route.akun_manager.router);
// Inisialisasi API & Database (tunggu hingga siap sebelum mendengarkan request)
await api.init();
try {
    await midle.acc.importFromJson();
} catch (e) {
    console.warn("Gagal sinkron akun default:", e.message);
}

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
    cli.init();
});
//process.stdin.setRawMode(false);
// Shutdown secara teratur
import { promisify } from "node:util";

const closeServer = promisify(server.close.bind(server));

async function ashut() {
    await closeServer();

    if (db.db) {
        await db.db.end();
    }

    cli.close();
}

async function shutdown() {
    console.log("Menghentikan server...");

    try {
        await ashut();

        console.log("Semua proses shutdown selesai.");

        process.exit();
    } catch (err) {
        console.error("Shutdown error:", err);
        process.exitCode = 1;
    }
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
