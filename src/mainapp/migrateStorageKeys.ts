// The site was renamed from "Antixor Icy" to "Cold Stone Creamery". Browser storage keys moved
// from the antixor-icy- prefix to cold-stone-, so values saved under the old names are carried
// over once. This keeps visitors signed in and keeps their bag and language choice.
// Imported before the app so every module reads the new keys.
const LEGACY_PREFIX = 'antixor-icy-'
const CURRENT_PREFIX = 'cold-stone-'

function migrate(storage: Storage) {
  const legacyKeys: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key?.startsWith(LEGACY_PREFIX)) legacyKeys.push(key)
  }
  for (const legacyKey of legacyKeys) {
    const value = storage.getItem(legacyKey)
    const currentKey = CURRENT_PREFIX + legacyKey.slice(LEGACY_PREFIX.length)
    if (value !== null && storage.getItem(currentKey) === null) storage.setItem(currentKey, value)
    storage.removeItem(legacyKey)
  }
}

try {
  migrate(localStorage)
  migrate(sessionStorage)
} catch {
  // Storage can be unavailable (private browsing); there is then nothing to carry over.
}
