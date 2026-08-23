import { getSupabase } from "../../core/supabase.js?v=build-20260823-3";
import { authRepository } from "./auth-repository.js?v=build-20260812-6";

const TABLE = "student_profiles";
const BUCKET = "flowfit-student-avatars";
const PROFILE_COLUMNS = "user_id, display_name, phone, avatar_path, created_at, updated_at";
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const SIGNED_URL_REUSE_MS = 50 * 60 * 1000;
const signedAvatarUrls = new Map();
let signedUrlCacheGeneration = 0;

const normalizeText = (value) => String(value ?? "").trim();

const normalizeProfile = (row = {}) => ({
  userId: normalizeText(row.user_id || row.userId),
  displayName: normalizeText(row.display_name || row.displayName),
  phone: normalizeText(row.phone),
  avatarPath: normalizeText(row.avatar_path || row.avatarPath),
  avatarUrl: normalizeText(row.avatarUrl),
  createdAt: normalizeText(row.created_at || row.createdAt),
  updatedAt: normalizeText(row.updated_at || row.updatedAt)
});

const isMissingFeature = (error) => {
  const details = [error?.code, error?.message, error?.details, error?.hint].filter(Boolean).join(" ");
  return /\b(42P01|PGRST205)\b/i.test(details)
    || /(relation|table).*student_profiles.*(does not exist|not found)/i.test(details)
    || /could not find.*student_profiles.*schema cache/i.test(details)
    || /(bucket|flowfit-student-avatars).*(does not exist|not found)/i.test(details);
};

const cachedSignedUrl = (path) => {
  const cached = signedAvatarUrls.get(path);
  if (!cached || cached.expiresAt <= Date.now()) {
    signedAvatarUrls.delete(path);
    return "";
  }
  return cached.url;
};

const rememberSignedUrl = (path, url) => {
  if (!path || !url) return;
  signedAvatarUrls.set(path, { url, expiresAt: Date.now() + SIGNED_URL_REUSE_MS });
};

const signAvatarPaths = async (client, paths = [], { force = false } = {}) => {
  const generation = signedUrlCacheGeneration;
  const uniquePaths = [...new Set(paths.map(normalizeText).filter(Boolean))];
  const urls = new Map();
  const missing = [];

  uniquePaths.forEach((path) => {
    const cached = force ? "" : cachedSignedUrl(path);
    if (cached) urls.set(path, cached);
    else missing.push(path);
  });

  if (!missing.length) return { urls, error: null };

  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrls(missing, SIGNED_URL_TTL_SECONDS);
  if (error) return { urls, error };

  (data || []).forEach((item, index) => {
    const path = normalizeText(item?.path) || missing[index];
    const url = normalizeText(item?.signedUrl || item?.signedURL);
    if (!path || !url || item?.error) return;
    if (generation !== signedUrlCacheGeneration) return;
    rememberSignedUrl(path, url);
    urls.set(path, url);
  });
  return { urls, error: null };
};

const resolveAuthContext = async (provided) => provided || authRepository.getAuthContext();

export const effectiveStudentName = (student = {}) => normalizeText(student.displayName) || normalizeText(student.name) || "Aluno";

export const applyStudentProfile = (student, profile) => {
  if (!student) return student;
  const normalized = normalizeProfile(profile);
  if (!normalized.userId || normalized.userId !== normalizeText(student.studentUserId)) return student;
  return {
    ...student,
    displayName: normalized.displayName,
    phone: normalized.phone,
    avatarPath: normalized.avatarPath,
    photoUrl: normalized.avatarUrl || "",
    studentProfileUpdatedAt: normalized.updatedAt
  };
};

export const studentProfileRepository = {
  async fetchOwnProfile({ authContext: providedAuthContext, createIfMissing = true } = {}) {
    const authContext = await resolveAuthContext(providedAuthContext);
    const client = await getSupabase();
    const userId = normalizeText(authContext?.user?.id);
    if (!client || !userId) return { synced: false, reason: "not-authenticated", profile: null };

    try {
      let { data, error } = await client
        .from(TABLE)
        .select(PROFILE_COLUMNS)
        .eq("user_id", userId)
        .maybeSingle();

      if (!error && !data && createIfMissing) {
        const created = await client
          .from(TABLE)
          .upsert({ user_id: userId }, { onConflict: "user_id" })
          .select(PROFILE_COLUMNS)
          .maybeSingle();
        data = created.data;
        error = created.error;
      }
      if (error) return { synced: false, error, reason: isMissingFeature(error) ? "migration-required" : "profile-read-failed", profile: null };

      const profile = data ? normalizeProfile(data) : null;
      if (profile?.avatarPath) {
        const signed = await signAvatarPaths(client, [profile.avatarPath]);
        profile.avatarUrl = signed.urls.get(profile.avatarPath) || "";
      }
      return { synced: true, profile };
    } catch (error) {
      return { synced: false, error, reason: "profile-read-failed", profile: null };
    }
  },

  async fetchLinkedProfiles(studentUserIds = [], { authContext: providedAuthContext } = {}) {
    const ids = [...new Set(studentUserIds.map(normalizeText).filter(Boolean))];
    if (!ids.length) return { synced: true, profiles: [], byUserId: new Map() };
    const authContext = await resolveAuthContext(providedAuthContext);
    const client = await getSupabase();
    if (!client || !authContext?.user) return { synced: false, reason: "not-authenticated", profiles: [], byUserId: new Map() };

    try {
      const { data, error } = await client
        .from(TABLE)
        .select(PROFILE_COLUMNS)
        .in("user_id", ids);
      if (error) return { synced: false, error, reason: isMissingFeature(error) ? "migration-required" : "profile-read-failed", profiles: [], byUserId: new Map() };

      const profiles = (data || []).map(normalizeProfile);
      const signed = await signAvatarPaths(client, profiles.map((profile) => profile.avatarPath));
      profiles.forEach((profile) => {
        profile.avatarUrl = signed.urls.get(profile.avatarPath) || "";
      });
      return {
        synced: true,
        profiles,
        byUserId: new Map(profiles.map((profile) => [profile.userId, profile]))
      };
    } catch (error) {
      return { synced: false, error, reason: "profile-read-failed", profiles: [], byUserId: new Map() };
    }
  },

  async saveOwnProfile({ displayName = "", phone = "", authContext: providedAuthContext } = {}) {
    const authContext = await resolveAuthContext(providedAuthContext);
    const client = await getSupabase();
    const userId = normalizeText(authContext?.user?.id);
    if (!client || !userId) return { synced: false, reason: "not-authenticated", profile: null };

    const safeDisplayName = normalizeText(displayName).slice(0, 80);
    const safePhone = normalizeText(phone).slice(0, 30);
    try {
      const { data, error } = await client
        .from(TABLE)
        .upsert({ user_id: userId, display_name: safeDisplayName, phone: safePhone }, { onConflict: "user_id" })
        .select(PROFILE_COLUMNS)
        .maybeSingle();
      if (error) return { synced: false, error, reason: isMissingFeature(error) ? "migration-required" : "profile-write-failed", profile: null };
      const profile = normalizeProfile(data);
      if (profile.avatarPath) profile.avatarUrl = cachedSignedUrl(profile.avatarPath);
      return { synced: true, profile };
    } catch (error) {
      return { synced: false, error, reason: "profile-write-failed", profile: null };
    }
  },

  async uploadOwnAvatar(blob, { authContext: providedAuthContext } = {}) {
    const authContext = await resolveAuthContext(providedAuthContext);
    const client = await getSupabase();
    const userId = normalizeText(authContext?.user?.id);
    if (!client || !userId) return { synced: false, reason: "not-authenticated", profile: null };
    if (!(blob instanceof Blob) || blob.type !== "image/webp" || blob.size > 1048576) {
      return { synced: false, reason: "invalid-avatar", profile: null };
    }

    const avatarPath = `${userId}/avatar.webp`;
    try {
      const upload = await client.storage.from(BUCKET).upload(avatarPath, blob, {
        upsert: true,
        contentType: "image/webp",
        cacheControl: "3600"
      });
      if (upload.error) return { synced: false, error: upload.error, reason: isMissingFeature(upload.error) ? "migration-required" : "avatar-upload-failed", profile: null };

      const saved = await client
        .from(TABLE)
        .upsert({ user_id: userId, avatar_path: avatarPath }, { onConflict: "user_id" })
        .select(PROFILE_COLUMNS)
        .maybeSingle();
      if (saved.error) return { synced: false, error: saved.error, reason: "profile-write-failed", profile: null };

      signedAvatarUrls.delete(avatarPath);
      const signed = await signAvatarPaths(client, [avatarPath], { force: true });
      const profile = normalizeProfile(saved.data);
      profile.avatarUrl = signed.urls.get(avatarPath) || "";
      return { synced: true, profile };
    } catch (error) {
      return { synced: false, error, reason: "avatar-upload-failed", profile: null };
    }
  },

  async removeOwnAvatar({ authContext: providedAuthContext } = {}) {
    const authContext = await resolveAuthContext(providedAuthContext);
    const client = await getSupabase();
    const userId = normalizeText(authContext?.user?.id);
    if (!client || !userId) return { synced: false, reason: "not-authenticated", profile: null };
    const avatarPath = `${userId}/avatar.webp`;

    try {
      const saved = await client
        .from(TABLE)
        .upsert({ user_id: userId, avatar_path: null }, { onConflict: "user_id" })
        .select(PROFILE_COLUMNS)
        .maybeSingle();
      if (saved.error) return { synced: false, error: saved.error, reason: "profile-write-failed", profile: null };
      const removed = await client.storage.from(BUCKET).remove([avatarPath]);
      signedAvatarUrls.delete(avatarPath);
      return {
        synced: !removed.error,
        error: removed.error || null,
        reason: removed.error ? "avatar-remove-failed" : undefined,
        profile: normalizeProfile(saved.data)
      };
    } catch (error) {
      return { synced: false, error, reason: "avatar-remove-failed", profile: null };
    }
  },

  clearSignedUrlCache() {
    signedUrlCacheGeneration += 1;
    signedAvatarUrls.clear();
  }
};
