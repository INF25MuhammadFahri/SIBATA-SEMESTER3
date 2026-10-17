import crypto from 'crypto';

class SessionManager {
  constructor() {
    // Menyimpan sesi di memori server (untuk production skala besar, gunakan Redis)
    this.sessions = new Map();
    
    // Interval otomatis untuk membersihkan sesi yang kedaluwarsa setiap 1 menit
    setInterval(() => this.cleanupExpiredSessions(), 60 * 1000);
  }

  // 1. Generate Sesi Baru
  createSession(userId, customData = {}, ttlInMinutes = 30) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const expiresAt = now + ttlInMinutes * 60 * 1000;

    const sessionData = {
      sessionId,
      userId,
      data: customData,
      createdAt: now,
      expiresAt: expiresAt
    };

    this.sessions.set(sessionId, sessionData);
    return sessionData;
  }

  // 2. Ambil Sesi & Cek Hitung Mundur Waktu Aktif
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return { valid: false, message: 'Sesi tidak ditemukan.' };
    }

    if (Date.now() > session.expiresAt) {
      this.destroySession(sessionId);
      return { valid: false, message: 'Sesi telah kedaluwarsa.' };
    }

    const timeLeftMs = session.expiresAt - Date.now();
    const timeLeftSeconds = Math.floor(timeLeftMs / 1000);

    return {
      valid: true,
      session,
      timeLeft: {
        milliseconds: timeLeftMs,
        seconds: timeLeftSeconds,
        formatted: `${Math.floor(timeLeftSeconds / 60)} menit ${timeLeftSeconds % 60} detik lagi`
      }
    };
  }

  // 3. Hapus Sesi (Logout)
  destroySession(sessionId) {
    return this.sessions.delete(sessionId);
  }

  // 4. Perpanjang Sesi (Sliding Session)
  extendSession(sessionId, additionalMinutes = 30) {
    const result = this.getSession(sessionId);
    if (!result.valid) return false;

    result.session.expiresAt = Date.now() + additionalMinutes * 60 * 1000;
    this.sessions.set(sessionId, result.session);
    return true;
  }

  // 5. Bersihkan Sesi Kedaluwarsa
  cleanupExpiredSessions() {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(sessionId);
      }
    }
  }
}

// Export menggunakan ES Module
export default new SessionManager();