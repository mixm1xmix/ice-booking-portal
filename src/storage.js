/**
 * storage.js
 *
 * A localStorage adapter that mirrors the window.storage API used in the
 * Claude artifact environment, so the main component needs zero changes
 * to its storage call-sites.
 *
 * NOTE: localStorage is per-browser / per-device. For a real multi-user
 * deployment where bookings must be shared across devices, replace this
 * file with a backend API (e.g. Supabase, Firebase, or a simple Express
 * server) that exposes the same get / set / delete / list interface.
 */

export const storage = {
  async get(key) {
    try {
      const value = localStorage.getItem(key)
      if (value === null) throw new Error('Key not found')
      return { key, value }
    } catch (e) {
      throw e
    }
  },

  async set(key, value) {
    try {
      localStorage.setItem(key, value)
      return { key, value }
    } catch (e) {
      console.error('storage.set failed', e)
      return null
    }
  },

  async delete(key) {
    try {
      localStorage.removeItem(key)
      return { key, deleted: true }
    } catch (e) {
      return null
    }
  },

  async list(prefix = '') {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix))
    return { keys, prefix }
  },
}
