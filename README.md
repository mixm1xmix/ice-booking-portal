# CSCA Practice Ice Booking

National Stick Curling Championship · March 25, 2026
Wolfville & Windsor Curling Clubs

---

## Local Development (Vite)

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build → dist/
npm run preview    # preview production build locally
```

---

## Deploying to Vercel via GitHub

1. Push this repository to GitHub (.gitignore already excludes node_modules/ and dist/)
2. Go to vercel.com → Add New Project → import your GitHub repo
3. Vercel auto-detects Vite — no extra configuration needed
4. Click Deploy. The vercel.json handles SPA routing so page refreshes work correctly.

Every push to main will trigger an automatic re-deploy.

---

## Project Structure

```
curling-booking/
├── .gitignore
├── vercel.json               # SPA routing for Vercel
├── index.html                # Viewport meta tag — critical for mobile
├── vite.config.js
├── package.json
└── src/
    ├── main.jsx              # React root
    ├── index.css             # Global reset (full-width, box-sizing)
    ├── CurlingBooking.jsx    # Main application component
    └── storage.js            # localStorage adapter
```

---

## Storage

By default the app uses localStorage — bookings are stored in the browser
and are NOT shared across devices.

To support real multi-user bookings shared across all devices, replace
src/storage.js with an API-backed implementation. The adapter must export
an object with these async methods:

  storage.get(key)        → { key, value }  (throws if not found)
  storage.set(key, value) → { key, value }
  storage.delete(key)     → { key, deleted }
  storage.list(prefix?)   → { keys, prefix }

Recommended backends: Supabase (free tier), Firebase Firestore, PocketBase.

---

## Admin Portal

Click the ⚙️ Admin button in the top-right of the header.

Master admin  — Default PIN: 0000 — change this immediately!
  Capabilities: view, cancel, assign bookings + manage all admin PINs

Secondary admin — PIN set by master admin
  Capabilities: view, cancel, assign bookings — cannot manage PINs

How PIN management works:
- Master admin can change their own PIN at any time
- Master admin can add secondary admins by name, each with a unique PIN
- Master admin can reset any secondary admin PIN individually
- Master admin can remove a secondary admin entirely
- Secondary admins cannot lock out the master or manage any PINs

---

## Customisation

Constants at the top of CurlingBooking.jsx:

  CLUBS              Club names in the tabs
  SHEETS_PER_SLOT    Sheets per time slot (default: 4)
  CLEANING_SLOTS     Slot IDs blocked for ice cleaning
  DEFAULT_MASTER_PIN Initial master PIN (default: 0000 — change it!)

Slot times are in the generateSlots() function — edit the times array.
