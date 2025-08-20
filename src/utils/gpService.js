import * as XLSX from "xlsx";

const GP_STORAGE_KEY = "gpAccountsV1";

/* ---------- chrome storage helpers with localStorage fallback ---------- */

function hasChromeStorage() {
  try {
    return (
      typeof chrome !== "undefined" && chrome.storage && chrome.storage.local
    );
  } catch {
    return false;
  }
}

function storageGetRaw(key) {
  return new Promise((resolve) => {
    if (hasChromeStorage()) {
      try {
        chrome.storage.local.get(key, (res) => {
          resolve(res);
        });
      } catch (err) {
        // fallback to localStorage on unexpected chrome error
        const raw = localStorage.getItem(key);
        resolve(raw ? JSON.parse(raw) : {});
      }
    } else {
      const raw = localStorage.getItem(key);
      resolve(raw ? JSON.parse(raw) : {});
    }
  });
}

function storageSetRaw(obj) {
  return new Promise((resolve) => {
    if (hasChromeStorage()) {
      try {
        chrome.storage.local.set(obj, () => resolve());
      } catch (err) {
        // fallback to localStorage
        const key = Object.keys(obj)[0];
        localStorage.setItem(key, JSON.stringify(obj[key]));
        resolve();
      }
    } else {
      const key = Object.keys(obj)[0];
      localStorage.setItem(key, JSON.stringify(obj[key]));
      resolve();
    }
  });
}

/* ---------- mapping helpers ---------- */

/**
 * Map a parsed row (object) from XLSX to our canonical GP house structure.
 * Accepts flexible header names in case sheet varies slightly.
 */
function mapRowToGp(row = {}, status = null) {
  const house = (
    row["DB House Name"] ||
    row["DB-House-Name"] ||
    row["House"] ||
    ""
  )
    .toString()
    .trim();
  const id = (
    row["GP Login ID"] ||
    row["GP LoginID"] ||
    row["GP_Login_ID"] ||
    ""
  )
    .toString()
    .trim();
  const password = (
    row["GP Password"] ||
    row["GP_Password"] ||
    row["GP Password "] ||
    ""
  )
    .toString()
    .trim();

  if (!house) return null;

  const done = Boolean(status?.items?.[house]?.["GP"]);

  return {
    house,
    accounts: [
      {
        type: "GP",
        id,
        password,
        done,
      },
    ],
  };
}

/* ---------- public API ---------- */

/**
 * loadGpFromStorage
 * Reads stored GP accounts from chrome.storage.local (or localStorage fallback).
 * Returns an array of { house, accounts: [...] } or [].
 */
export async function loadGpFromStorage() {
  const res = await storageGetRaw(GP_STORAGE_KEY);
  // chrome.storage returns { gpAccountsV1: [...] } if present
  if (
    res &&
    typeof res === "object" &&
    Object.prototype.hasOwnProperty.call(res, GP_STORAGE_KEY)
  ) {
    return res[GP_STORAGE_KEY] || [];
  }
  // fallback direct object stored in localStorage
  if (res && Array.isArray(res)) return res;
  if (res && res[GP_STORAGE_KEY]) return res[GP_STORAGE_KEY];
  return [];
}

/**
 * setGpAccounts
 * Persist the provided gpAccounts array to chrome.storage.local (or localStorage).
 * gpAccounts should be an array of { house, accounts: [...] }.
 */
export async function setGpAccounts(gpAccounts = []) {
  if (!Array.isArray(gpAccounts))
    throw new Error("gpAccounts must be an array");
  await storageSetRaw({ [GP_STORAGE_KEY]: gpAccounts });
}

/**
 * fetchAndMapGpSheet
 * Fetches XLSX from a published Google Sheets XLSX URL, parses rows and maps them to GP shape.
 * Returns the mapped array (but does not persist automatically unless save=true).
 *
 * @param {string} url - public Google Sheets xlsx URL (output=xlsx)
 * @param {Object|null} status - optional status object used to set `done` flags for houses (same shape as your status store)
 * @param {boolean} [save=false] - if true, will also save the mapped result into storage via setGpAccounts
 */
export async function fetchAndMapGpSheet(url, status = null, save = false) {
  if (!url) throw new Error("No URL provided for GP sheet");
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Failed to fetch GP sheet: " + resp.status);
  const ab = await resp.arrayBuffer();
  const wb = XLSX.read(ab, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];

  // parse sheet to array of objects using header row
  const rows = XLSX.utils.sheet_to_json(ws, {
    header: XLSX.utils.sheet_to_json(ws, { raw: true })[0],
  });
  console.log(rows);
  const mapped = rows.map((r) => mapRowToGp(r, status)).filter(Boolean);

  if (save) {
    await setGpAccounts(mapped);
  }
  return mapped;
}

/**
 * refreshGpFromSheetAndStore
 * Convenience wrapper: loads status from storage (if present), fetches sheet, maps and stores GP accounts.
 * Returns mapped array.
 *
 * @param {string} url - sheet xlsx url
 */
export async function refreshGpFromSheetAndStore(url) {
  // try to get status from storage so we can set done flags
  let status = null;
  try {
    const sRes = await storageGetRaw("loginStatusV1");
    if (sRes && sRes["loginStatusV1"]) status = sRes["loginStatusV1"];
    else if (sRes && sRes.date) status = sRes; // fallback if stored directly
  } catch (e) {
    // ignore; status will be null
  }

  const mapped = await fetchAndMapGpSheet(url, status, true);
  return mapped;
}

/**
 * mergeGpIntoExisting
 * Merge gpMapped array into an existing accounts array (by house).
 * - If replace=true, incoming GP entries replace any existing house entry with same name.
 * - If replace=false, incoming GP entry will be appended if house not present; existing houses preserve their accounts.
 *
 * Returns the merged array (pure, non-mutating).
 */
export function mergeGpIntoExisting(
  existing = [],
  gpMapped = [],
  opts = { replace: true }
) {
  if (!Array.isArray(existing)) existing = [];
  if (!Array.isArray(gpMapped)) gpMapped = [];
  const { replace = true } = opts;

  const map = new Map();
  for (const e of existing) {
    if (!e || !e.house) continue;
    map.set(e.house, {
      ...e,
      accounts: Array.isArray(e.accounts) ? [...e.accounts] : [],
    });
  }

  for (const inc of gpMapped) {
    if (!inc || !inc.house) continue;
    if (!map.has(inc.house)) {
      map.set(inc.house, {
        ...inc,
        accounts: Array.isArray(inc.accounts) ? [...inc.accounts] : [],
      });
    } else {
      if (replace) {
        map.set(inc.house, {
          ...inc,
          accounts: Array.isArray(inc.accounts) ? [...inc.accounts] : [],
        });
      } else {
        // append GP account types only if they don't exist already
        const exist = map.get(inc.house);
        const existTypes = new Set((exist.accounts || []).map((a) => a.type));
        const toAdd = (inc.accounts || []).filter(
          (a) => !existTypes.has(a.type)
        );
        exist.accounts = [...exist.accounts, ...toAdd];
        map.set(inc.house, exist);
      }
    }
  }

  // preserve order of existing houses, then append any new incoming houses
  const result = [];
  const added = new Set();
  for (const e of existing) {
    if (!e || !e.house) continue;
    const merged = map.get(e.house);
    if (merged) {
      result.push(merged);
      added.add(e.house);
    }
  }
  for (const inc of gpMapped) {
    if (!inc || !inc.house) continue;
    if (!added.has(inc.house)) {
      result.push(map.get(inc.house));
      added.add(inc.house);
    }
  }
  return result;
}

/* ---------- small utility: toggle done flag for a GP house (updates status store) ---------- */

/**
 * toggleGpDone
 * Toggles the 'GP' done flag for a given house in the global status store (loginStatusV1).
 * Returns the new status object.
 */
export async function toggleGpDone(houseName) {
  if (!houseName) throw new Error("houseName required");
  // read current status
  const sRaw = await storageGetRaw("loginStatusV1");
  let status = null;
  if (sRaw && sRaw["loginStatusV1"]) status = sRaw["loginStatusV1"];
  else if (sRaw && sRaw.date) status = sRaw;
  else
    status = {
      date: (() => {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
          d.getDate()
        )}`;
      })(),
      items: {},
    };

  if (!status.items[houseName]) status.items[houseName] = {};
  status.items[houseName]["GP"] = !Boolean(status.items[houseName]["GP"]);

  await storageSetRaw({ ["loginStatusV1"]: status });
  return status;
}

/* ---------- export default helpers (optional) ---------- */
export default {
  loadGpFromStorage,
  setGpAccounts,
  fetchAndMapGpSheet,
  refreshGpFromSheetAndStore,
  mergeGpIntoExisting,
  toggleGpDone,
};
