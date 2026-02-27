/* ═══════════════════════════════════════════════════════
   Auth System — localStorage-based multi-user auth
   ═══════════════════════════════════════════════════════ */

import type { UserAccount, UserProfile, UsersRegistry } from '../types/user';

const REGISTRY_KEY = 'neuro-users-registry';
const SESSION_KEY = 'neuro-current-user';

/* ─── Password hash (local-only, not for production auth) ─── */
function simpleHash(str: string): string {
  // FNV-1a-inspired hash — better distribution than djb2
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // Add salt-like prefix to prevent trivial rainbow table
  return 'fnv_' + (hash >>> 0).toString(36);
}

/* ─── Registry management ─────────────────────────────── */

function loadRegistry(): UsersRegistry {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) return { users: [] };
    return JSON.parse(raw) as UsersRegistry;
  } catch {
    return { users: [] };
  }
}

function saveRegistry(reg: UsersRegistry) {
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(reg));
}

/* ─── Seed default users if empty or hash format changed ── */
const HASH_VERSION = 'fnv_';

export function seedDefaultUsers() {
  const reg = loadRegistry();
  // Re-seed if registry is empty OR hash format has been upgraded
  const needsReseed = reg.users.length === 0
    || reg.users.some((u) => !u.credentials.passwordHash.startsWith(HASH_VERSION));
  if (!needsReseed) return;

  // Preserve existing profiles when re-seeding
  const existingProfiles: Record<string, typeof reg.users[0]['profile']> = {};
  for (const u of reg.users) {
    existingProfiles[u.credentials.username] = u.profile;
  }

  const defaults: Array<{ username: string; password: string }> = [
    { username: 'Gui', password: 'guigui' },
    { username: 'bruno', password: 'teste132' },
  ];

  reg.users = [];
  for (const d of defaults) {
    reg.users.push({
      credentials: { username: d.username, passwordHash: simpleHash(d.password) },
      profile: existingProfiles[d.username] ?? null,
    });
  }
  saveRegistry(reg);
}

/* ─── Auth operations ─────────────────────────────────── */

export function login(username: string, password: string): UserAccount | null {
  const reg = loadRegistry();
  const hash = simpleHash(password);
  const user = reg.users.find(
    (u) => u.credentials.username.toLowerCase() === username.toLowerCase() && u.credentials.passwordHash === hash,
  );
  if (!user) return null;
  localStorage.setItem(SESSION_KEY, user.credentials.username);
  return user;
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
}

export function getCurrentUser(): UserAccount | null {
  const username = localStorage.getItem(SESSION_KEY);
  if (!username) return null;
  const reg = loadRegistry();
  return reg.users.find((u) => u.credentials.username === username) ?? null;
}

export function getCurrentUsername(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function isLoggedIn(): boolean {
  return !!localStorage.getItem(SESSION_KEY);
}

/* ─── Profile operations ──────────────────────────────── */

export function saveProfile(username: string, profile: UserProfile) {
  const reg = loadRegistry();
  const user = reg.users.find((u) => u.credentials.username === username);
  if (user) {
    user.profile = profile;
    saveRegistry(reg);
  }
}

export function getProfile(username: string): UserProfile | null {
  const reg = loadRegistry();
  const user = reg.users.find((u) => u.credentials.username === username);
  return user?.profile ?? null;
}

export function addAIMemory(username: string, memory: string) {
  const reg = loadRegistry();
  const user = reg.users.find((u) => u.credentials.username === username);
  if (user?.profile) {
    if (!user.profile.aiMemory) user.profile.aiMemory = [];
    user.profile.aiMemory.push(memory);
    // Keep last 50 memories
    if (user.profile.aiMemory.length > 50) {
      user.profile.aiMemory = user.profile.aiMemory.slice(-50);
    }
    saveRegistry(reg);
  }
}
