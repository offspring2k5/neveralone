# NeverAlone – Auth/Profil (FR4/FR5) & Frontend-Struktur (Stand: heute)

Dieses Dokument fasst alle Arbeiten zusammen, die heute rund um **Registrierung/Login (FR4/FR5)**, **Profilseite**, **Avatar-Upload**, **Frontend-Aufräumen** und **Tests** umgesetzt wurden.

---

## 1) Ziel & Scope (heute)

### Umgesetzt
- **FR4 (Must): Registrierung**
    - User kann Account anlegen (E-Mail + Passwort + optional DisplayName)
- **FR5 (Must): Login**
    - User kann sich per E-Mail + Passwort anmelden
    - Token-basierte Session (JWT)
- **Protected Endpoint**
    - `/api/auth/me` liefert Userdaten, wenn gültiger Token vorhanden
- **Profilseite**
    - Userdaten anzeigen (Name/E-Mail/Erstellt am)
    - DisplayName ändern (PATCH) – optional Richtung FR21
- **Avatar Upload**
    - Profilbild hochladen (PNG/JPG/WEBP, max 2MB)
    - Avatar wird als URL gespeichert und statisch ausgeliefert
    - UI zeigt Avatar oder Initiale (1. Buchstabe)
- **Frontend modularisiert**
    - Kein Inline-JS mehr in HTML
    - Pages nutzen Module unter `/js/*`
- **Tests**
    - node:test + supertest
    - Tests sind auf mehrere Dateien aufgeteilt + gemeinsame Helper

### Nicht umgesetzt (bewusst)
- Keine Räume/Tasks (FR6+)
- Kein Mobile Native (A1)
- Keine externen Integrationen (A3)
- Kein Payment (A5)

---

## 2) Backend

### 2.1 Express App (`be/server.js`)
- Startet Express und stellt statische Dateien bereit:
    - HTML/CSS über `express.static(FE_HTML_DIR)`
    - Frontend-JS Module über `/js` → `express.static(FE_JS_DIR)`
    - User-Uploads über `/user_uploads` → `db/user_uploads`
- API Routen:
    - `/api/health` (Test-Endpoint)
    - `/api/auth/*` (Auth/Profil/Avatar)

**Wichtig:**
- `express.json()` ist vor API-Routen registriert, damit POST/PATCH JSON Bodies verfügbar sind.

---

### 2.2 Persistenz: JSON-Store (`be/usersStore.js`)
- Minimaler Persistenz-Layer (Prototyp) mit Datei `db/users.json`
- Enthält:
    - `ensureDbFile()` → legt Datei an, falls sie fehlt
    - `readDb()` / `writeDb()` → einziges Persistenz-Gateway
    - `findUserByEmail(email)`
    - `findUserById(id)`
    - `createUser(user)`

**Datenformat (`db/users.json`):**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "test@test.com",
      "passwordHash": "$2b$10$...",
      "createdAt": "ISO_DATE",
      "displayName": "HELLO",
      "points": 0,
      "avatarUrl": "/user_uploads/avatars/<file>" 
    }
  ]
}
