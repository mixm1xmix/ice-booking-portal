# NSCC 2026 - Practice Ice Booking

March 25, 2026 · Wolfville & Windsor Curling Clubs

---

## Local Development

```bash
npm install
npm run dev
```

Opens at http://localhost:5173

---

## Admin Portal

Click the **⚙️ Admin** button in the top-right of the header.

| Role | Default PIN | Capabilities |
|---|---|---|
| **Master admin** | `0000` | View, cancel, assign bookings + manage all PINs |
| **Secondary admin** | Set by master | View, cancel, assign bookings — cannot manage PINs |

**Change the default master PIN immediately after first use.**

The master admin can add secondary admins by name with individual PINs, reset any secondary PIN, and remove secondary admins. Secondary admins cannot lock out the master or access PIN management.

---

## Customisation

Edit the constants at the top of `src/CurlingBooking.jsx`:

| Constant | Default | Description |
|---|---|---|
| `CLUBS` | Wolfville, Windsor | Club names in the tabs |
| `SHEETS_PER_SLOT` | `4` | Sheets per time slot |
| `CLEANING_SLOTS` | `'10-30'`, `'13-0'` | Slot IDs blocked for ice cleaning |
| `DEFAULT_MASTER_PIN` | `'0000'` | Initial master PIN |

Slot times are in the `generateSlots()` function — edit the `times` array to adjust the schedule.
