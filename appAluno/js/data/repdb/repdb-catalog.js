export const REPDB_VERSION = "2026.8.0";
export const REPDB_PACKAGE = "@repdb/exercises";
export const REPDB_CDN_ORIGIN = "https://cdn.jsdelivr.net";
export const REPDB_CDN_BASE = `${REPDB_CDN_ORIGIN}/npm/${REPDB_PACKAGE}@${REPDB_VERSION}/`;
export const REPDB_CATALOG_URL = `${REPDB_CDN_BASE}exercises.json`;

const REPDB_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REPDB_IMAGE_PATTERN = /^images\/flat\/[a-z0-9]+(?:-[a-z0-9]+)*-(?:start|peak|main)\.webp$/;
const POSE_NAMES = ["start", "peak", "main"];

const BODY_PART_LABELS = Object.freeze({
  back: "Costas",
  calves: "Panturrilhas",
  chest: "Peito",
  core: "Core",
  forearms: "Antebraços",
  full_body: "Corpo inteiro",
  glutes: "Glúteos",
  hamstrings: "Posteriores",
  lower_arms: "Antebraços",
  lower_body: "Membros inferiores",
  neck: "Pescoço",
  quadriceps: "Quadríceps",
  shoulders: "Ombros",
  upper_arms: "Braços",
  upper_body: "Membros superiores"
});

const EQUIPMENT_LABELS = Object.freeze({
  ab_wheel: "Roda abdominal",
  air_bike: "Air bike",
  assisted_pullup_machine: "Máquina assistida",
  barbell: "Barra",
  bench: "Banco",
  bodyweight: "Peso corporal",
  cable: "Cabo",
  dip_machine: "Máquina de mergulho",
  dumbbell: "Halter",
  ez_bar: "Barra EZ",
  kettlebell: "Kettlebell",
  machine: "Máquina",
  medicine_ball: "Medicine ball",
  none: "Sem equipamento",
  pull_up_bar: "Barra fixa",
  resistance_band: "Elástico",
  smith_machine: "Smith",
  stability_ball: "Bola suíça",
  trap_bar: "Trap bar"
});

let catalogPromise = null;

const normalizeSearchText = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[_-]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const isPlainObject = (value) => Boolean(value)
  && typeof value === "object"
  && !Array.isArray(value);

const normalizePosePaths = (poses) => {
  if (!isPlainObject(poses)) return {};
  return POSE_NAMES.reduce((normalized, pose) => {
    const path = String(poses[pose] || "").trim();
    if (REPDB_IMAGE_PATTERN.test(path)) normalized[pose] = path;
    return normalized;
  }, {});
};

export const normalizeRepdbMetadata = (value) => {
  if (!isPlainObject(value) || value.provider !== "repdb") return {};
  const version = String(value.version || "").trim();
  const exerciseId = String(value.exerciseId || value.exercise_id || "").trim();
  const poses = normalizePosePaths(value.poses);
  if (version !== REPDB_VERSION || !REPDB_ID_PATTERN.test(exerciseId) || !Object.keys(poses).length) return {};
  return { provider: "repdb", version, exerciseId, poses };
};

export const isRepdbMetadata = (value) => normalizeRepdbMetadata(value).provider === "repdb";

export const repdbAssetUrl = (path, version = REPDB_VERSION) => {
  const normalizedPath = String(path || "").trim();
  if (version !== REPDB_VERSION || !REPDB_IMAGE_PATTERN.test(normalizedPath)) return "";
  return `${REPDB_CDN_ORIGIN}/npm/${REPDB_PACKAGE}@${version}/${normalizedPath}`;
};

export const getRepdbPoseUrls = (metadata) => {
  const normalized = normalizeRepdbMetadata(metadata);
  if (!normalized.provider) return {};
  return Object.fromEntries(Object.entries(normalized.poses)
    .map(([pose, path]) => [pose, repdbAssetUrl(path, normalized.version)])
    .filter(([, url]) => Boolean(url)));
};

export const getRepdbPosterUrl = (metadata) => {
  const poses = getRepdbPoseUrls(metadata);
  return poses.peak || poses.main || poses.start || "";
};

export const createRepdbMetadata = (exercise) => {
  const exerciseId = String(exercise?.id || "").trim();
  const poses = normalizePosePaths(exercise?.images?.flat);
  return normalizeRepdbMetadata({
    provider: "repdb",
    version: REPDB_VERSION,
    exerciseId,
    poses
  });
};

const normalizeCatalogExercise = (exercise) => {
  const metadata = createRepdbMetadata(exercise);
  if (!metadata.provider) return null;
  const primaryMuscles = Array.isArray(exercise.primary_muscles) ? exercise.primary_muscles : [];
  const searchText = normalizeSearchText([
    exercise.id,
    exercise.name_en,
    exercise.name_es,
    exercise.body_part,
    exercise.equipment,
    ...primaryMuscles
  ].join(" "));
  return Object.freeze({
    id: metadata.exerciseId,
    name: String(exercise.name_en || exercise.id).trim(),
    bodyPart: String(exercise.body_part || "").trim(),
    equipment: String(exercise.equipment || (exercise.is_bodyweight ? "bodyweight" : "none")).trim(),
    primaryMuscles,
    metadata,
    posterUrl: getRepdbPosterUrl(metadata),
    poseCount: Object.keys(metadata.poses).length,
    searchText
  });
};

export const loadRepdbCatalog = async ({ force = false } = {}) => {
  if (force) catalogPromise = null;
  if (catalogPromise) return catalogPromise;
  catalogPromise = (async () => {
    const response = await fetch(REPDB_CATALOG_URL, { cache: "force-cache" });
    if (!response.ok) throw new Error(`repdb_catalog_http_${response.status}`);
    const payload = await response.json();
    if (Number(payload?.schema_version || 0) < 3 || !Array.isArray(payload?.exercises)) {
      throw new Error("repdb_catalog_invalid");
    }
    const exercises = payload.exercises.map(normalizeCatalogExercise).filter(Boolean);
    if (!exercises.length) throw new Error("repdb_catalog_empty");
    return Object.freeze({
      version: REPDB_VERSION,
      exercises: Object.freeze(exercises),
      byId: new Map(exercises.map((exercise) => [exercise.id, exercise]))
    });
  })().catch((error) => {
    catalogPromise = null;
    throw error;
  });
  return catalogPromise;
};

export const filterRepdbExercises = (exercises, { query = "", bodyPart = "", equipment = "" } = {}) => {
  const normalizedQuery = normalizeSearchText(query);
  return (Array.isArray(exercises) ? exercises : []).filter((exercise) => (
    (!normalizedQuery || exercise.searchText.includes(normalizedQuery))
    && (!bodyPart || exercise.bodyPart === bodyPart)
    && (!equipment || exercise.equipment === equipment)
  ));
};

const titleFromKey = (value) => String(value || "")
  .replace(/_/g, " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const repdbBodyPartLabel = (value) => BODY_PART_LABELS[value] || titleFromKey(value);
export const repdbEquipmentLabel = (value) => EQUIPMENT_LABELS[value] || titleFromKey(value);

export const getRepdbFilterValues = (exercises, field) => [...new Set(
  (Array.isArray(exercises) ? exercises : []).map((exercise) => exercise[field]).filter(Boolean)
)].sort((a, b) => {
  const label = field === "bodyPart" ? repdbBodyPartLabel(a) : repdbEquipmentLabel(a);
  const other = field === "bodyPart" ? repdbBodyPartLabel(b) : repdbEquipmentLabel(b);
  return label.localeCompare(other, "pt-BR");
});

