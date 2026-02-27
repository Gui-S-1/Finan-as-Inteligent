/* ═══════════════════════════════════════════════════════
   Auth System — localStorage-based multi-user auth
   ═══════════════════════════════════════════════════════ */

import type { UserAccount, UserProfile, UsersRegistry } from '../types/user';

const REGISTRY_KEY = 'neuro-users-registry';
const SESSION_KEY = 'neuro-current-user';

/* ─── Simple password hash (not cryptographic, local only) ─── */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(36);
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

/* ─── Seed default users if empty ─────────────────────── */
export function seedDefaultUsers() {
  const reg = loadRegistry();
  if (reg.users.length > 0) return;
  const defaults: Array<{ username: string; password: string }> = [
    { username: 'Gui', password: 'guigui' },
    { username: 'bruno', password: 'teste132' },
  ];
  for (const d of defaults) {
    reg.users.push({
      credentials: { username: d.username, passwordHash: simpleHash(d.password) },
      profile: null,
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
