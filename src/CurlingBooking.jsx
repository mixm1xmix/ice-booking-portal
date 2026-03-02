import { useState, useEffect } from 'react'
import { storage } from './storage'

// ─── Config ──────────────────────────────────────────────────────────────────
const CLUBS            = ['Wolfville Curling Club', 'Windsor Curling Club']
const SHEETS_PER_SLOT  = 4
const STORAGE_KEY      = 'curling-march25-bookings-v3'
const ADMIN_STORAGE_KEY = 'curling-march25-admin-config'
const DEFAULT_MASTER_PIN = '0000'
const CLEANING_SLOTS   = new Set(['10-30', '13-0'])

// ─── Slot generation ─────────────────────────────────────────────────────────
function generateSlots() {
  const times = [
    [8,30],[9,0],[9,30],[10,0],[10,30],[11,0],[11,30],
    [12,0],[12,30],[13,0],[13,30],[14,0],[14,30],
  ]
  return times.map(([h, m]) => {
    const endM = m === 30 ? 0 : 30
    const endH = m === 30 ? h + 1 : h
    const fmt = (hh, mm) => {
      const ap  = hh < 12 ? 'AM' : 'PM'
      const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh
      return `${h12}:${mm === 0 ? '00' : '30'} ${ap}`
    }
    return {
      id:       `${h}-${m}`,
      label:    `${fmt(h, m)} – ${fmt(endH, endM)}`,
      cleaning: CLEANING_SLOTS.has(`${h}-${m}`),
    }
  })
}

const SLOTS = generateSlots()

// ─── Colours ─────────────────────────────────────────────────────────────────
const RED        = '#cc0001'
const RED_DARK   = '#990001'
const RED_LIGHT  = '#fde8e8'
const RED_BORDER = '#e8a0a0'
const CHARCOAL   = '#1e1e1e'
const MID_GREY   = '#555555'
const LIGHT_GREY = '#f5f5f5'
const BORDER_GREY = '#dedede'
const WHITE      = '#ffffff'
const GREEN      = '#1a7a3c'
const GREEN_BG   = '#e8f5ee'
const GREEN_BORDER = '#7ec89a'
const ICE_BLUE   = '#e8f4fb'
const ICE_BORDER = '#aed6ef'
const AMBER      = '#7a4f00'
const AMBER_BG   = '#fff8e6'
const AMBER_BORDER = '#f0c040'
const NAVY       = '#0a2a4a'
const NAVY_LIGHT = '#e8eef5'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

// Default admin config shape.
// secondaryAdmins: [{ id, name, pin }]
function defaultAdminConfig() {
  return { masterPin: DEFAULT_MASTER_PIN, secondaryAdmins: [] }
}

// Shared input style — always white background
const inputStyle = (borderColor = BORDER_GREY, extra = {}) => ({
  width: '100%',
  padding: '11px 13px',
  borderRadius: 7,
  border: `2px solid ${borderColor}`,
  fontSize: 16,
  fontFamily: 'inherit',
  color: CHARCOAL,
  background: WHITE,
  boxSizing: 'border-box',
  outline: 'none',
  ...extra,
})

const pinInputStyle = (borderColor = BORDER_GREY) => ({
  ...inputStyle(borderColor),
  fontSize: 22,
  letterSpacing: '0.3em',
})

// ─── Component ───────────────────────────────────────────────────────────────
export default function CurlingBooking() {

  // ── User / booking state ───────────────────────────────────────────────────
  const [emailInput,   setEmailInput]   = useState('')
  const [enteredEmail, setEnteredEmail] = useState('')
  const [emailError,   setEmailError]   = useState('')
  const [bookings,  setBookings]  = useState({})
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(null)
  const [message,   setMessage]   = useState(null)
  const [activeTab, setActiveTab] = useState(0)

  // ── Admin state ────────────────────────────────────────────────────────────
  const [view,          setView]          = useState('booking') // 'booking' | 'admin'
  const [adminConfig,   setAdminConfig]   = useState(defaultAdminConfig())
  const [adminPinInput, setAdminPinInput] = useState('')
  const [adminAuthed,   setAdminAuthed]   = useState(null) // null | { role:'master' } | { role:'secondary', id, name }
  const [adminPinError, setAdminPinError] = useState('')
  const [adminActiveClub, setAdminActiveClub] = useState(0)

  // ── PIN management state (master only) ────────────────────────────────────
  const [pinMsg,        setPinMsg]        = useState(null)
  const [newMasterPin,  setNewMasterPin]  = useState('')
  const [masterPinErr,  setMasterPinErr]  = useState('')
  // Add secondary admin form
  const [newAdminName,  setNewAdminName]  = useState('')
  const [newAdminPin,   setNewAdminPin]   = useState('')
  const [newAdminErr,   setNewAdminErr]   = useState('')
  // Reset secondary PIN inline editing — keyed by admin id
  const [resetPinValues, setResetPinValues] = useState({}) // { [id]: string }
  const [resetPinErrors, setResetPinErrors] = useState({}) // { [id]: string }

  // ── Assign modal ───────────────────────────────────────────────────────────
  const [assignModal, setAssignModal] = useState(null)
  const [assignEmail, setAssignEmail] = useState('')
  const [assignError, setAssignError] = useState('')

  // ── Load on mount, poll every 5 s ─────────────────────────────────────────
  useEffect(() => {
    loadAll()
    const iv = setInterval(loadBookings, 5000)
    return () => clearInterval(iv)
  }, [])

  async function loadAll() {
    await Promise.all([loadBookings(), loadAdminConfig()])
  }

  async function loadBookings() {
    try {
      const r = await storage.get(STORAGE_KEY)
      setBookings(JSON.parse(r.value))
    } catch (e) { /* no bookings yet */ }
    setLoading(false)
  }

  async function loadAdminConfig() {
    try {
      const r = await storage.get(ADMIN_STORAGE_KEY)
      const saved = JSON.parse(r.value)
      // Migrate old shape (secondaryPins array) to new shape if needed
      if (saved.secondaryPins && !saved.secondaryAdmins) {
        saved.secondaryAdmins = saved.secondaryPins.map((pin, i) => ({
          id: `migrated-${i}`, name: `Admin ${i + 1}`, pin,
        }))
        delete saved.secondaryPins
      }
      setAdminConfig({ ...defaultAdminConfig(), ...saved })
    } catch (e) { /* use defaults */ }
  }

  async function saveAdminConfig(cfg) {
    try {
      await storage.set(ADMIN_STORAGE_KEY, JSON.stringify(cfg))
      setAdminConfig(cfg)
    } catch (e) { console.error('saveAdminConfig failed', e) }
  }

  async function saveBookings(updated) {
    try {
      await storage.set(STORAGE_KEY, JSON.stringify(updated))
    } catch (e) { console.error('saveBookings failed', e) }
  }

  // ── Messages ───────────────────────────────────────────────────────────────
  function showMsg(text, type = 'error') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 5000)
  }

  function showPinMsg(text, type = 'error') {
    setPinMsg({ text, type })
    setTimeout(() => setPinMsg(null), 4000)
  }

  // ── Email ──────────────────────────────────────────────────────────────────
  function handleSetEmail() {
    const v = emailInput.trim()
    if (!v) { setEmailError('Please enter your email address.'); return }
    if (!isValidEmail(v)) { setEmailError('Please enter a valid email address (e.g. name@example.com).'); return }
    setEmailError('')
    setEnteredEmail(v.toLowerCase())
  }

  // ── Booking helpers ────────────────────────────────────────────────────────
  function getSlotBookings(club, slotId) {
    const prefix = `${club}::${slotId}::`
    return Object.entries(bookings).filter(([k]) => k.startsWith(prefix))
  }

  function getMyBooking() {
    if (!enteredEmail) return undefined
    return Object.entries(bookings).find(([, v]) => v.email === enteredEmail.toLowerCase())
  }

  // ── Book ───────────────────────────────────────────────────────────────────
  async function handleBook(club, slot) {
    if (!enteredEmail) { showMsg("Please enter your skip's email first."); return }
    const email = enteredEmail.toLowerCase()
    const myEx  = getMyBooking()
    if (myEx) { showMsg(`You already have a booking: ${myEx[1].slotLabel} at ${myEx[1].club}`); return }
    const slotEntries = getSlotBookings(club, slot.id)
    if (slotEntries.length >= SHEETS_PER_SLOT) { showMsg('All 4 sheets are booked for that time. Please choose another slot.'); return }

    setSaving(`${club}::${slot.id}`)
    let fresh = {}
    try { const r = await storage.get(STORAGE_KEY); fresh = JSON.parse(r.value) } catch (e) { /* ok */ }

    const freshSlot = Object.entries(fresh).filter(([k]) => k.startsWith(`${club}::${slot.id}::`))
    if (freshSlot.length >= SHEETS_PER_SLOT) { setBookings(fresh); setSaving(null); showMsg('All sheets just filled up! Please choose another.'); return }
    if (Object.entries(fresh).find(([, v]) => v.email === email)) { setBookings(fresh); setSaving(null); showMsg('Your team already has a booking.'); return }

    const takenSheets = freshSlot.map(([k]) => parseInt(k.split('::')[2]))
    let sheet = 1
    while (takenSheets.includes(sheet)) sheet++

    const key = `${club}::${slot.id}::${sheet}`
    const updated = { ...fresh, [key]: { email, club, slotLabel: slot.label, sheet, bookedAt: Date.now() } }
    await saveBookings(updated)
    setBookings(updated)
    setSaving(null)
    showMsg(`Booked! Sheet ${sheet} — ${slot.label} at ${club}`, 'success')
  }

  // ── Cancel own ────────────────────────────────────────────────────────────
  async function handleCancel(key) {
    const b = bookings[key]
    if (!b) return
    if (b.email !== enteredEmail.toLowerCase()) { showMsg('You can only cancel your own booking.'); return }
    const updated = { ...bookings }
    delete updated[key]
    await saveBookings(updated)
    setBookings(updated)
    showMsg('Booking cancelled.', 'info')
  }

  // ── Admin: cancel any ─────────────────────────────────────────────────────
  async function adminCancel(key) {
    const updated = { ...bookings }
    delete updated[key]
    await saveBookings(updated)
    setBookings(updated)
    showMsg('Booking cancelled by admin.', 'info')
  }

  // ── Admin: assign ─────────────────────────────────────────────────────────
  async function adminAssign() {
    const { club, slotId, slotLabel, sheet } = assignModal
    const email = assignEmail.trim().toLowerCase()
    if (!email) { setAssignError('Please enter an email address.'); return }
    if (!isValidEmail(email)) { setAssignError('Please enter a valid email address.'); return }
    if (Object.entries(bookings).find(([, v]) => v.email === email)) { setAssignError('That email already has a booking.'); return }
    const key = `${club}::${slotId}::${sheet}`
    if (bookings[key]) { setAssignError('That sheet is already booked.'); return }
    const updated = { ...bookings, [key]: { email, club, slotLabel, sheet, bookedAt: Date.now(), assignedByAdmin: true } }
    await saveBookings(updated)
    setBookings(updated)
    setAssignModal(null); setAssignEmail(''); setAssignError('')
    showMsg(`Sheet ${sheet} assigned to ${email}`, 'success')
  }

  // ── Admin login ───────────────────────────────────────────────────────────
  function handleAdminLogin() {
    const pin = adminPinInput.trim()
    if (!pin) { setAdminPinError('Please enter your PIN.'); return }
    if (pin === adminConfig.masterPin) {
      setAdminAuthed({ role: 'master' })
      setAdminPinError(''); setAdminPinInput('')
      return
    }
    const sec = adminConfig.secondaryAdmins.find(a => a.pin === pin)
    if (sec) {
      setAdminAuthed({ role: 'secondary', id: sec.id, name: sec.name })
      setAdminPinError(''); setAdminPinInput('')
      return
    }
    setAdminPinError('Incorrect PIN. Please try again.')
  }

  // ── Master: change own PIN ────────────────────────────────────────────────
  function handleChangeMasterPin() {
    const p = newMasterPin.trim()
    if (!/^\d{4,8}$/.test(p)) { setMasterPinErr('PIN must be 4–8 digits.'); return }
    if (adminConfig.secondaryAdmins.some(a => a.pin === p)) { setMasterPinErr('That PIN is already used by a secondary admin.'); return }
    setMasterPinErr('')
    saveAdminConfig({ ...adminConfig, masterPin: p })
    setNewMasterPin('')
    showPinMsg('Master PIN updated successfully.', 'success')
  }

  // ── Master: add a new secondary admin ────────────────────────────────────
  function handleAddSecondaryAdmin() {
    const name = newAdminName.trim()
    const pin  = newAdminPin.trim()
    if (!name) { setNewAdminErr('Please enter a name for this admin.'); return }
    if (!/^\d{4,8}$/.test(pin)) { setNewAdminErr('PIN must be 4–8 digits.'); return }
    if (pin === adminConfig.masterPin) { setNewAdminErr('PIN cannot match the master PIN.'); return }
    if (adminConfig.secondaryAdmins.some(a => a.pin === pin)) { setNewAdminErr('That PIN is already in use.'); return }
    const newAdmin = { id: `admin-${Date.now()}`, name, pin }
    const cfg = { ...adminConfig, secondaryAdmins: [...adminConfig.secondaryAdmins, newAdmin] }
    saveAdminConfig(cfg)
    setNewAdminName(''); setNewAdminPin(''); setNewAdminErr('')
    showPinMsg(`Admin "${name}" added successfully.`, 'success')
  }

  // ── Master: reset a secondary admin's PIN ────────────────────────────────
  function handleResetSecPin(id) {
    const pin = (resetPinValues[id] || '').trim()
    if (!/^\d{4,8}$/.test(pin)) {
      setResetPinErrors(prev => ({ ...prev, [id]: 'PIN must be 4–8 digits.' }))
      return
    }
    if (pin === adminConfig.masterPin) {
      setResetPinErrors(prev => ({ ...prev, [id]: 'Cannot match the master PIN.' }))
      return
    }
    if (adminConfig.secondaryAdmins.some(a => a.id !== id && a.pin === pin)) {
      setResetPinErrors(prev => ({ ...prev, [id]: 'That PIN is already used by another admin.' }))
      return
    }
    setResetPinErrors(prev => ({ ...prev, [id]: '' }))
    setResetPinValues(prev => ({ ...prev, [id]: '' }))
    const updated = adminConfig.secondaryAdmins.map(a => a.id === id ? { ...a, pin } : a)
    saveAdminConfig({ ...adminConfig, secondaryAdmins: updated })
    showPinMsg(`PIN reset for "${adminConfig.secondaryAdmins.find(a => a.id === id)?.name}".`, 'success')
  }

  // ── Master: remove a secondary admin ─────────────────────────────────────
  function handleRemoveSecAdmin(id) {
    const admin = adminConfig.secondaryAdmins.find(a => a.id === id)
    const updated = adminConfig.secondaryAdmins.filter(a => a.id !== id)
    saveAdminConfig({ ...adminConfig, secondaryAdmins: updated })
    showPinMsg(`Admin "${admin?.name}" removed.`, 'success')
  }

  const myBookingEntry = getMyBooking()
  const isMaster       = adminAuthed?.role === 'master'

  // ════════════════════════════════════════════════════════════════════════════
  //  ADMIN VIEW
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'admin') {
    return (
      <div style={{ minHeight: '100vh', width: '100%', background: LIGHT_GREY, fontFamily: "'Arial',sans-serif", color: CHARCOAL }}>

        {/* ── Header ── */}
        <div style={{ width: '100%', background: `linear-gradient(135deg,${NAVY} 0%,#1a4a7a 100%)`, boxShadow: '0 3px 12px rgba(0,0,0,0.3)' }}>
          <div style={{ background: NAVY, padding: '8px 28px', fontSize: 12, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Canadian Stick Curling Association — Admin Portal
          </div>
          <div style={{ padding: '16px 28px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 36, lineHeight: 1 }}>⚙️</div>
            <div>
              <h1 style={{ margin: 0, fontSize: 'clamp(18px,3vw,26px)', fontWeight: 700, color: WHITE }}>Admin Portal — Practice Ice Booking</h1>
              <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>National Stick Curling Championship · March 25, 2026</p>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {adminAuthed && (
                <span style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, padding: '6px 14px', fontSize: 13, color: WHITE, fontWeight: 600 }}>
                  {isMaster ? '🔑 Master Admin' : `🔐 ${adminAuthed.name}`}
                </span>
              )}
              <button
                onClick={() => { setView('booking'); setAdminAuthed(null); setAdminPinInput('') }}
                style={{ padding: '8px 18px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.1)', color: WHITE, fontWeight: 600, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}
              >
                ← Back to Booking
              </button>
            </div>
          </div>
        </div>

        <div style={{ width: '100%', padding: '24px 20px', boxSizing: 'border-box' }}>
          <div style={{ maxWidth: 960, margin: '0 auto' }}>

            {/* ── PIN Login ── */}
            {!adminAuthed ? (
              <div style={{ background: WHITE, border: `1px solid ${BORDER_GREY}`, borderRadius: 10, padding: '30px', maxWidth: 420, margin: '40px auto', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
                <h2 style={{ margin: '0 0 6px', fontSize: 20, color: CHARCOAL }}>🔒 Admin Login</h2>
                <p style={{ margin: '0 0 20px', color: MID_GREY, fontSize: 15 }}>Enter your admin PIN to continue.</p>
                <input
                  type="password"
                  value={adminPinInput}
                  onChange={e => { setAdminPinInput(e.target.value); setAdminPinError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                  placeholder="Enter PIN"
                  style={pinInputStyle(adminPinError ? RED : BORDER_GREY)}
                  autoComplete="current-password"
                />
                {adminPinError && <div style={{ color: RED_DARK, fontSize: 14, marginTop: 8, fontWeight: 600 }}>{adminPinError}</div>}
                <button
                  onClick={handleAdminLogin}
                  style={{ width: '100%', marginTop: 16, padding: '13px 0', borderRadius: 7, border: 'none', background: NAVY, color: WHITE, fontWeight: 700, fontSize: 17, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Login
                </button>
              </div>
            ) : (
              <>
                {/* ── Feedback ── */}
                {message && (
                  <div style={{ padding: '13px 18px', borderRadius: 8, marginBottom: 16, background: message.type === 'success' ? GREEN_BG : message.type === 'info' ? '#eef4ff' : RED_LIGHT, border: `1px solid ${message.type === 'success' ? GREEN_BORDER : message.type === 'info' ? '#99b8e8' : RED_BORDER}`, color: message.type === 'success' ? GREEN : message.type === 'info' ? '#1a4a8a' : RED_DARK, fontSize: 15, fontWeight: 600 }}>
                    {message.text}
                  </div>
                )}

                {/* ══ MASTER ONLY: PIN Management ══ */}
                {isMaster && (
                  <div style={{ background: WHITE, border: `1px solid ${BORDER_GREY}`, borderLeft: `5px solid ${NAVY}`, borderRadius: 8, padding: '22px 24px', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                    <h2 style={{ margin: '0 0 4px', fontSize: 18, color: NAVY }}>🔑 Admin PIN Management</h2>
                    <p style={{ margin: '0 0 18px', fontSize: 14, color: MID_GREY }}>Only the master admin can manage PINs. Secondary admins cannot access this section.</p>

                    {pinMsg && (
                      <div style={{ padding: '10px 14px', borderRadius: 6, marginBottom: 16, background: pinMsg.type === 'success' ? GREEN_BG : RED_LIGHT, border: `1px solid ${pinMsg.type === 'success' ? GREEN_BORDER : RED_BORDER}`, color: pinMsg.type === 'success' ? GREEN : RED_DARK, fontSize: 14, fontWeight: 600 }}>
                        {pinMsg.text}
                      </div>
                    )}

                    {/* Change master PIN */}
                    <div style={{ background: NAVY_LIGHT, border: `1px solid #c0d0e0`, borderRadius: 8, padding: '16px 18px', marginBottom: 20 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 10 }}>Change Your Master PIN</div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        <div style={{ flex: '1 1 180px' }}>
                          <input
                            type="password"
                            value={newMasterPin}
                            onChange={e => { setNewMasterPin(e.target.value); setMasterPinErr('') }}
                            onKeyDown={e => e.key === 'Enter' && handleChangeMasterPin()}
                            placeholder="New PIN (4–8 digits)"
                            style={inputStyle(masterPinErr ? RED : BORDER_GREY)}
                            autoComplete="new-password"
                          />
                          {masterPinErr && <div style={{ color: RED_DARK, fontSize: 13, marginTop: 5, fontWeight: 600 }}>{masterPinErr}</div>}
                        </div>
                        <button onClick={handleChangeMasterPin} style={{ padding: '11px 20px', borderRadius: 7, border: 'none', background: NAVY, color: WHITE, fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                          Update PIN
                        </button>
                      </div>
                    </div>

                    {/* Secondary admins list */}
                    <div style={{ fontSize: 15, fontWeight: 700, color: CHARCOAL, marginBottom: 12 }}>
                      Secondary Admins ({adminConfig.secondaryAdmins.length})
                    </div>

                    {adminConfig.secondaryAdmins.length === 0 ? (
                      <p style={{ fontSize: 14, color: MID_GREY, marginBottom: 16 }}>No secondary admins yet. Add one below.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                        {adminConfig.secondaryAdmins.map(admin => (
                          <div key={admin.id} style={{ background: WHITE, border: `1px solid ${BORDER_GREY}`, borderRadius: 8, padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 700, fontSize: 15, color: CHARCOAL, flex: 1 }}>🔐 {admin.name}</span>
                              <button
                                onClick={() => handleRemoveSecAdmin(admin.id)}
                                style={{ padding: '5px 12px', borderRadius: 5, border: `1px solid ${RED_BORDER}`, background: RED_LIGHT, color: RED_DARK, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                              >
                                Remove Admin
                              </button>
                            </div>
                            {/* Reset PIN inline */}
                            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                              <div style={{ flex: '1 1 180px' }}>
                                <input
                                  type="password"
                                  value={resetPinValues[admin.id] || ''}
                                  onChange={e => setResetPinValues(prev => ({ ...prev, [admin.id]: e.target.value }))}
                                  onKeyDown={e => e.key === 'Enter' && handleResetSecPin(admin.id)}
                                  placeholder="New PIN for this admin (4–8 digits)"
                                  style={inputStyle(resetPinErrors[admin.id] ? RED : BORDER_GREY, { fontSize: 14 })}
                                  autoComplete="new-password"
                                />
                                {resetPinErrors[admin.id] && <div style={{ color: RED_DARK, fontSize: 12, marginTop: 4, fontWeight: 600 }}>{resetPinErrors[admin.id]}</div>}
                              </div>
                              <button
                                onClick={() => handleResetSecPin(admin.id)}
                                style={{ padding: '11px 16px', borderRadius: 7, border: `1px solid ${NAVY}`, background: NAVY_LIGHT, color: NAVY, fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                              >
                                Reset PIN
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add new secondary admin */}
                    <div style={{ background: GREEN_BG, border: `1px solid ${GREEN_BORDER}`, borderRadius: 8, padding: '16px 18px' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: GREEN, marginBottom: 10 }}>Add a New Secondary Admin</div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        <div style={{ flex: '2 1 160px' }}>
                          <input
                            type="text"
                            value={newAdminName}
                            onChange={e => { setNewAdminName(e.target.value); setNewAdminErr('') }}
                            placeholder="Admin name (e.g. Jane Smith)"
                            style={inputStyle(newAdminErr ? RED : BORDER_GREY, { fontSize: 14 })}
                            autoComplete="off"
                          />
                        </div>
                        <div style={{ flex: '1 1 140px' }}>
                          <input
                            type="password"
                            value={newAdminPin}
                            onChange={e => { setNewAdminPin(e.target.value); setNewAdminErr('') }}
                            onKeyDown={e => e.key === 'Enter' && handleAddSecondaryAdmin()}
                            placeholder="PIN (4–8 digits)"
                            style={inputStyle(newAdminErr ? RED : BORDER_GREY, { fontSize: 14 })}
                            autoComplete="new-password"
                          />
                        </div>
                        <button
                          onClick={handleAddSecondaryAdmin}
                          style={{ padding: '11px 20px', borderRadius: 7, border: 'none', background: GREEN, color: WHITE, fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                        >
                          Add Admin
                        </button>
                      </div>
                      {newAdminErr && <div style={{ color: RED_DARK, fontSize: 13, marginTop: 8, fontWeight: 600 }}>{newAdminErr}</div>}
                    </div>
                  </div>
                )}

                {/* ══ Booking Overview (all admins) ══ */}
                <div style={{ background: WHITE, border: `1px solid ${BORDER_GREY}`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ background: NAVY, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: 18, color: WHITE, flex: 1 }}>📋 All Bookings</h2>
                    <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.3)' }}>
                      {CLUBS.map((club, i) => (
                        <button key={club} onClick={() => setAdminActiveClub(i)} style={{ padding: '7px 16px', border: 'none', background: adminActiveClub === i ? 'rgba(255,255,255,0.25)' : 'transparent', color: WHITE, fontWeight: adminActiveClub === i ? 700 : 400, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>
                          {club.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                      Total: {Object.keys(bookings).length} booking{Object.keys(bookings).length !== 1 ? 's' : ''}
                    </div>
                  </div>

                  <div style={{ padding: '16px 20px' }}>
                    {/* Stats */}
                    {(() => {
                      const club         = CLUBS[adminActiveClub]
                      const clubBookings = Object.entries(bookings).filter(([, v]) => v.club === club)
                      const totalSlots   = SLOTS.filter(s => !s.cleaning).length * SHEETS_PER_SLOT
                      return (
                        <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
                          <div style={{ background: GREEN_BG, border: `1px solid ${GREEN_BORDER}`, borderRadius: 8, padding: '10px 18px', fontSize: 15, color: GREEN, fontWeight: 700 }}>✅ {clubBookings.length} booked</div>
                          <div style={{ background: ICE_BLUE, border: `1px solid ${ICE_BORDER}`, borderRadius: 8, padding: '10px 18px', fontSize: 15, color: '#1a5276', fontWeight: 700 }}>🧊 {totalSlots - clubBookings.length} available</div>
                        </div>
                      )
                    })()}

                    {/* Slot grid */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {SLOTS.map(slot => {
                        const club = CLUBS[adminActiveClub]
                        if (slot.cleaning) {
                          return (
                            <div key={slot.id} style={{ borderRadius: 7, padding: '10px 14px', background: AMBER_BG, border: `1px solid ${AMBER_BORDER}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 18 }}>🧹</span>
                              <span style={{ fontWeight: 700, color: AMBER, fontSize: 14 }}>{slot.label}</span>
                              <span style={{ color: AMBER, fontSize: 13 }}>— Ice cleaning</span>
                            </div>
                          )
                        }
                        const slotEntries = getSlotBookings(club, slot.id)
                        const sheetsLeft  = SHEETS_PER_SLOT - slotEntries.length
                        return (
                          <div key={slot.id} style={{ borderRadius: 7, border: `1px solid ${BORDER_GREY}`, overflow: 'hidden' }}>
                            <div style={{ background: LIGHT_GREY, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${BORDER_GREY}` }}>
                              <span style={{ fontWeight: 700, fontSize: 15, color: CHARCOAL, minWidth: 180 }}>{slot.label}</span>
                              <span style={{ fontSize: 13, color: sheetsLeft === 0 ? RED_DARK : sheetsLeft <= 1 ? '#c06000' : GREEN, fontWeight: 600 }}>
                                {sheetsLeft === 0 ? 'Full' : `${sheetsLeft} sheet${sheetsLeft !== 1 ? 's' : ''} available`}
                              </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
                              {[1,2,3,4].map(sheetNum => {
                                const entry = slotEntries.find(([k]) => k.endsWith(`::${sheetNum}`))
                                return (
                                  <div key={sheetNum} style={{ padding: '10px 12px', borderRight: sheetNum < 4 ? `1px solid ${BORDER_GREY}` : 'none', background: entry ? RED_LIGHT : WHITE }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: entry ? RED_DARK : MID_GREY, marginBottom: 4 }}>Sheet {sheetNum}</div>
                                    {entry ? (
                                      <>
                                        <div style={{ fontSize: 12, color: CHARCOAL, marginBottom: 4, wordBreak: 'break-all' }}>{entry[1].email}</div>
                                        {entry[1].assignedByAdmin && <div style={{ fontSize: 11, color: NAVY, marginBottom: 4, fontStyle: 'italic' }}>Admin assigned</div>}
                                        <button onClick={() => adminCancel(entry[0])} style={{ width: '100%', padding: '5px 0', border: `1px solid ${RED_BORDER}`, borderRadius: 5, background: WHITE, color: RED_DARK, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                          Cancel
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>Available</div>
                                        <button
                                          onClick={() => { setAssignModal({ club, slotId: slot.id, slotLabel: slot.label, sheet: sheetNum }); setAssignEmail(''); setAssignError('') }}
                                          style={{ width: '100%', padding: '5px 0', border: `1px solid ${NAVY}`, borderRadius: 5, background: NAVY_LIGHT, color: NAVY, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                                        >
                                          Assign
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 28, textAlign: 'center', fontSize: 13, color: '#aaa', paddingBottom: 20 }}>
                  Canadian Stick Curling Association · Admin Portal · National Championship 2026
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Assign Modal ── */}
        {assignModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
            <div style={{ background: WHITE, borderRadius: 12, padding: '28px 28px 24px', maxWidth: 420, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
              <h3 style={{ margin: '0 0 4px', color: NAVY, fontSize: 18 }}>Manually Assign Sheet</h3>
              <p style={{ margin: '0 0 16px', color: MID_GREY, fontSize: 14 }}>
                <strong>{assignModal.slotLabel}</strong> · {assignModal.club} · Sheet {assignModal.sheet}
              </p>
              <label style={{ fontSize: 14, fontWeight: 700, color: CHARCOAL, display: 'block', marginBottom: 7 }}>Skip's Email Address</label>
              <input
                type="email"
                value={assignEmail}
                onChange={e => { setAssignEmail(e.target.value); setAssignError('') }}
                onKeyDown={e => e.key === 'Enter' && adminAssign()}
                placeholder="skip@example.com"
                style={inputStyle(assignError ? RED : BORDER_GREY)}
                autoComplete="off"
              />
              {assignError && <div style={{ color: RED_DARK, fontSize: 13, marginTop: 6, fontWeight: 600 }}>{assignError}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button onClick={adminAssign} style={{ flex: 1, padding: '11px 0', borderRadius: 7, border: 'none', background: NAVY, color: WHITE, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>Confirm Assignment</button>
                <button onClick={() => setAssignModal(null)} style={{ flex: 1, padding: '11px 0', borderRadius: 7, border: `1px solid ${BORDER_GREY}`, background: LIGHT_GREY, color: MID_GREY, fontWeight: 600, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  BOOKING VIEW
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', width: '100%', background: LIGHT_GREY, fontFamily: "'Arial',sans-serif", color: CHARCOAL }}>

      {/* ── Header ── */}
      <div style={{ width: '100%', background: `linear-gradient(135deg,${RED_DARK} 0%,${RED} 100%)`, boxShadow: '0 3px 12px rgba(0,0,0,0.25)' }}>
        <div style={{ background: RED_DARK, padding: '8px 28px', fontSize: 12, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Canadian Stick Curling Association
        </div>
        <div style={{ padding: '20px 28px 22px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 48, lineHeight: 1 }}>🥌</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 'clamp(20px,4vw,32px)', fontWeight: 700, color: WHITE }}>National Stick Curling Championship</h1>
            <p style={{ margin: '5px 0 0', color: 'rgba(255,255,255,0.85)', fontSize: 'clamp(14px,2vw,17px)' }}>Practice Ice Booking — March 25, 2026</p>
            <p style={{ margin: '3px 0 0', color: 'rgba(255,255,255,0.65)', fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Wolfville &amp; Windsor Curling Clubs · 4 Sheets Per Time Slot</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 6, padding: '8px 16px', fontSize: 14, color: WHITE, fontWeight: 600, whiteSpace: 'nowrap' }}>
              📅 March 25, 2026 Only
            </div>
            <button onClick={() => setView('admin')} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, padding: '6px 14px', fontSize: 12, color: 'rgba(255,255,255,0.75)', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em' }}>
              ⚙️ Admin
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ width: '100%', padding: '24px 20px', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>

          {/* Instructions */}
          <div style={{ background: WHITE, border: `2px solid ${RED}`, borderRadius: 10, marginBottom: 20, overflow: 'hidden' }}>
            <div style={{ background: RED, padding: '12px 20px', fontSize: 17, fontWeight: 700, color: WHITE }}>📋 How to Book Your Practice Ice Time</div>
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { n: '1', t: "Enter the skip's email address below and click the red \"Set Email\" button." },
                { n: '2', t: 'Choose your preferred curling club — click either the Wolfville or Windsor tab.' },
                { n: '3', t: 'Browse the time slots. Each slot shows how many of the 4 sheets are still available.' },
                { n: '4', t: 'Click "Book a Sheet" on the time you want. You will be assigned the next available sheet number.' },
                { n: '5', t: 'Each team may only book one session. To change your time, click "Cancel Booking" and then choose a new slot.' },
              ].map(({ n, t }) => (
                <div key={n} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 34, height: 34, borderRadius: '50%', background: RED, color: WHITE, fontWeight: 700, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</div>
                  <div style={{ fontSize: 16, color: CHARCOAL, lineHeight: 1.55, paddingTop: 6 }}>{t}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Email input */}
          <div style={{ background: WHITE, border: `1px solid ${BORDER_GREY}`, borderRadius: 10, padding: '20px 22px', marginBottom: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <label style={{ display: 'block', fontSize: 17, fontWeight: 700, color: CHARCOAL, marginBottom: 4 }}>Step 1: Enter Skip's Email Address</label>
            <p style={{ margin: '0 0 12px', fontSize: 15, color: MID_GREY }}>This is how your booking will be identified. Use the same email if you need to return and cancel.</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <input
                type="email"
                value={emailInput}
                onChange={e => { setEmailInput(e.target.value); setEmailError('') }}
                onKeyDown={e => e.key === 'Enter' && handleSetEmail()}
                placeholder="skip@example.com"
                style={{ flex: '1 1 220px', padding: '13px 16px', borderRadius: 7, border: `2px solid ${emailError ? RED : BORDER_GREY}`, background: WHITE, color: CHARCOAL, fontSize: 20, fontFamily: 'inherit', outline: 'none' }}
                autoComplete="email"
              />
              <button
                onClick={handleSetEmail}
                style={{ padding: '13px 28px', borderRadius: 7, border: 'none', background: enteredEmail === emailInput.trim().toLowerCase() && enteredEmail ? RED_DARK : RED, color: WHITE, fontWeight: 700, cursor: 'pointer', fontSize: 18, fontFamily: 'inherit' }}
              >
                {enteredEmail && enteredEmail === emailInput.trim().toLowerCase() ? '✓ Email Set' : 'Set Email'}
              </button>
            </div>
            {emailError && <div style={{ color: RED_DARK, fontSize: 14, marginTop: 8, fontWeight: 600 }}>⚠️ {emailError}</div>}
            {enteredEmail && !emailError && (
              <div style={{ marginTop: 12, fontSize: 16, color: MID_GREY }}>
                ✅ Booking as: <strong style={{ color: CHARCOAL }}>{enteredEmail}</strong>
                {myBookingEntry && (
                  <div style={{ marginTop: 6, color: GREEN, fontSize: 16, fontWeight: 600 }}>
                    ✅ Booking confirmed — Sheet {myBookingEntry[1].sheet}: <strong>{myBookingEntry[1].slotLabel}</strong> at <strong>{myBookingEntry[1].club}</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Message */}
          {message && (
            <div style={{ padding: '14px 20px', borderRadius: 8, marginBottom: 18, background: message.type === 'success' ? GREEN_BG : message.type === 'info' ? '#eef4ff' : RED_LIGHT, border: `1px solid ${message.type === 'success' ? GREEN_BORDER : message.type === 'info' ? '#99b8e8' : RED_BORDER}`, color: message.type === 'success' ? GREEN : message.type === 'info' ? '#1a4a8a' : RED_DARK, fontSize: 16, fontWeight: 600 }}>
              {message.text}
            </div>
          )}

          {/* Club Tabs */}
          <div style={{ fontSize: 17, fontWeight: 700, color: CHARCOAL, marginBottom: 10 }}>Step 2: Choose a Curling Club</div>
          <div style={{ display: 'flex', borderRadius: '10px 10px 0 0', overflow: 'hidden', border: `1px solid ${BORDER_GREY}`, borderBottom: 'none' }}>
            {CLUBS.map((club, i) => (
              <button key={club} onClick={() => setActiveTab(i)} style={{ flex: 1, padding: '15px 20px', border: 'none', borderBottom: activeTab === i ? `3px solid ${RED}` : '3px solid transparent', background: activeTab === i ? WHITE : LIGHT_GREY, color: activeTab === i ? RED : MID_GREY, fontSize: 'clamp(14px,2vw,17px)', fontWeight: activeTab === i ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                🥌 {club}
              </button>
            ))}
          </div>

          {/* Slots */}
          <div style={{ background: WHITE, border: `1px solid ${BORDER_GREY}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: CHARCOAL, marginBottom: 14 }}>Step 3: Pick a Time Slot and Click "Book a Sheet"</div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: MID_GREY, fontSize: 16 }}>Loading ice time...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {SLOTS.map(slot => {
                  const club = CLUBS[activeTab]
                  if (slot.cleaning) {
                    return (
                      <div key={slot.id} style={{ borderRadius: 8, padding: '14px 18px', background: AMBER_BG, border: `1px solid ${AMBER_BORDER}`, display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ fontSize: 22 }}>🧹</div>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: AMBER }}>{slot.label}</div>
                          <div style={{ fontSize: 14, color: AMBER, marginTop: 2 }}>Ice cleaning in progress — no bookings available during this time</div>
                        </div>
                      </div>
                    )
                  }
                  const slotEntries  = getSlotBookings(club, slot.id)
                  const sheetsLeft   = SHEETS_PER_SLOT - slotEntries.length
                  const isFull       = sheetsLeft === 0
                  const mySheetEntry = slotEntries.find(([, v]) => v.email === enteredEmail.toLowerCase())
                  const isSavingSlot = saving === `${club}::${slot.id}`
                  return (
                    <div key={slot.id} style={{ borderRadius: 8, border: `1px solid ${mySheetEntry ? GREEN_BORDER : isFull ? RED_BORDER : ICE_BORDER}`, background: mySheetEntry ? GREEN_BG : isFull ? RED_LIGHT : ICE_BLUE, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', transition: 'all 0.15s' }}>
                      <div style={{ minWidth: 170 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: mySheetEntry ? GREEN : isFull ? RED_DARK : CHARCOAL }}>{slot.label}</div>
                        {mySheetEntry && <div style={{ fontSize: 13, color: GREEN, fontWeight: 600, marginTop: 2 }}>✅ Your booking — Sheet {mySheetEntry[1].sheet}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 7, alignItems: 'center', flex: 1 }}>
                        {[1,2,3,4].map(sn => {
                          const e    = slotEntries.find(([k]) => k.endsWith(`::${sn}`))
                          const isMe = e && e[1].email === enteredEmail.toLowerCase()
                          return (
                            <div key={sn} style={{ width: 44, height: 44, borderRadius: 6, border: `2px solid ${isMe ? GREEN : e ? RED_BORDER : BORDER_GREY}`, background: isMe ? GREEN : e ? RED_LIGHT : WHITE, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: isMe ? WHITE : e ? RED_DARK : MID_GREY }}>
                              <div style={{ fontSize: 14 }}>{isMe ? '✓' : e ? '🔒' : ''}</div>
                              <div>S{sn}</div>
                            </div>
                          )
                        })}
                        <div style={{ fontSize: 14, color: isFull ? RED_DARK : sheetsLeft === 1 ? '#c06000' : GREEN, fontWeight: 600, marginLeft: 4 }}>
                          {isFull ? 'Full' : `${sheetsLeft} sheet${sheetsLeft !== 1 ? 's' : ''} left`}
                        </div>
                      </div>
                      <div style={{ minWidth: 145 }}>
                        {mySheetEntry ? (
                          <button onClick={() => handleCancel(mySheetEntry[0])} style={{ width: '100%', padding: '9px 0', border: `1px solid ${RED_BORDER}`, borderRadius: 6, background: RED_LIGHT, color: RED_DARK, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel Booking</button>
                        ) : isFull ? (
                          <div style={{ textAlign: 'center', fontSize: 14, color: RED_DARK, fontWeight: 600, padding: '9px 0' }}>No sheets left</div>
                        ) : myBookingEntry ? (
                          <div style={{ textAlign: 'center', fontSize: 13, color: MID_GREY, padding: '9px 0' }}>Already booked elsewhere</div>
                        ) : (
                          <button onClick={() => handleBook(club, slot)} disabled={!!isSavingSlot} style={{ width: '100%', padding: '9px 0', border: `1px solid ${RED}`, borderRadius: 6, background: RED, color: WHITE, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                            {isSavingSlot ? 'Booking...' : 'Book a Sheet'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 18, marginTop: 14, fontSize: 15, color: MID_GREY, flexWrap: 'wrap', alignItems: 'center' }}>
            {[[GREEN, 'Your booking'], [RED_LIGHT, 'Taken'], [ICE_BLUE, 'Available'], [AMBER_BG, 'Ice cleaning']].map(([bg, label]) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 16, height: 16, borderRadius: 3, background: bg, border: `1px solid ${BORDER_GREY}`, display: 'inline-block' }} />
                {label}
              </span>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 13, fontStyle: 'italic', color: '#aaa' }}>Auto-refreshes every 5 seconds</span>
          </div>

          {/* Reminders */}
          <div style={{ marginTop: 20, padding: '18px 22px', background: WHITE, border: `1px solid ${BORDER_GREY}`, borderLeft: `5px solid ${RED}`, borderRadius: 8, fontSize: 15, color: CHARCOAL, lineHeight: 1.85, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <strong style={{ color: RED, fontSize: 16 }}>⚠️ Important Reminders</strong><br />
            • Each team may only book <strong>one 30-minute session</strong> on March 25th<br />
            • You may choose <strong>either Wolfville or Windsor</strong> Curling Club<br />
            • Each time slot has <strong>4 sheets available</strong> — up to 4 teams can book the same time<br />
            • Ice cleaning is at <strong>10:30–11:00 AM</strong> and <strong>1:00–1:30 PM</strong> — no bookings during these times<br />
            • Your booking is tied to your email — <strong>use the same email to return and cancel</strong><br />
            • To change your time or club, click <strong>"Cancel Booking"</strong>, then choose a new slot
          </div>

          <div style={{ marginTop: 28, textAlign: 'center', fontSize: 13, color: '#aaa', paddingBottom: 20 }}>
            Canadian Stick Curling Association · National Championship 2026
          </div>
        </div>
      </div>
    </div>
  )
}
