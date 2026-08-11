const DB_NAME = "flowfit-session-drafts";
const DB_VERSION = 1;
const STORE_NAME = "drafts";

const warnStorageFailure = (operation, error) => {
  console.warn(`[FlowFit][aluno][armazenamento opcional] Falha ao ${operation}.`, error);
};

const openDatabase = () => new Promise((resolve, reject) => {
  if (!globalThis.indexedDB) {
    resolve(null);
    return;
  }
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "scopeId" });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const transact = async (mode, operation) => {
  const database = await openDatabase();
  if (!database) return null;
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
};

export const SessionDraftStorage = {
  async requestPersistence() {
    try {
      const storage = globalThis.navigator?.storage;
      if (typeof storage?.persist !== "function") return false;
      return await storage.persist();
    } catch (error) {
      warnStorageFailure("solicitar persistência", error);
      return false;
    }
  },
  async load(scopeId) {
    try {
      const row = await transact("readonly", (store) => store.get(String(scopeId)));
      return row?.session && typeof row.session === "object" ? row.session : null;
    } catch (error) {
      warnStorageFailure("carregar rascunho", error);
      return null;
    }
  },
  async save(scopeId, session) {
    try {
      if (!session) return this.remove(scopeId);
      await transact("readwrite", (store) => store.put({ scopeId: String(scopeId), session, updatedAt: new Date().toISOString() }));
      return true;
    } catch (error) {
      warnStorageFailure("salvar rascunho", error);
      return false;
    }
  },
  async remove(scopeId) {
    try {
      await transact("readwrite", (store) => store.delete(String(scopeId)));
      return true;
    } catch (error) {
      warnStorageFailure("remover rascunho", error);
      return false;
    }
  }
};
