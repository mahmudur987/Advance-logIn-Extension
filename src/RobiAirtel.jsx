import { useCallback, useEffect, useState } from "react";
import { useChromeStorage } from "./hooks/useChromeStorage";
import * as XLSX from "xlsx";
function areAllAccountsDone(houseData) {
  if (!houseData || !houseData.accounts) return false;
  return houseData.accounts.every((acc) => acc.done === true);
}
const SHEET_XLSX_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRcel_HqXnbFwYeQOdzaIL-fO0sY8a5xY2pKszkHrceYqhy-jPPv91qcvjp0VE6hg/pub?output=xlsx";

const ACCOUNTS_KEY = "accountsDataV1";
const STATUS_KEY = "loginStatusV1";

const todayKey = (() => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
})();

export default function RobiAirtel() {
  const {
    value: accounts,
    setValue: setAccounts,
    loaded: accountsLoaded,
  } = useChromeStorage(ACCOUNTS_KEY, []);
  const {
    value: status,
    setValue: setStatus,
    loaded: statusLoaded,
  } = useChromeStorage(STATUS_KEY, { date: todayKey, items: {} });

  const [houseIndex, setHouseIndex] = useState(0);
  const [accountIndex, setAccountIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  // ensure status date is today
  useEffect(() => {
    if (!statusLoaded) return;
    if (!status?.date || status.date !== todayKey) {
      setStatus({ date: todayKey, items: {} });
    }
  }, [statusLoaded, status, setStatus]);
  const getDone = (houseName, type) =>
    Boolean(status?.items?.[houseName]?.[type]);
  const houses =
    accounts
      .map((h, i) => {
        return {
          ...h,
          accounts: h.accounts.map((a, j) => {
            return {
              ...a,
              done: getDone(h.house, a.type),
            };
          }),
        };
      })
      .sort((a, b) => {
        const aDoneAll = a.accounts.every((acc) => acc.done);
        const bDoneAll = b.accounts.every((acc) => acc.done);

        // If a is done and b is not, a goes after b → return 1
        // If b is done and a is not, b goes after a → return -1
        // Otherwise keep order → return 0
        if (aDoneAll && !bDoneAll) return 1;
        if (!aDoneAll && bDoneAll) return -1;
        return 0;
      }) || [];
  const currentHouse = houses[houseIndex];
  const currentAcc = currentHouse?.accounts.find((x) => x.id === accountIndex);

  useEffect(() => {
    const currentAccountIndex = currentHouse?.accounts.sort((a, b) => {
      const aDone = a.done;
      const bDone = b.done;

      // If a is done and b is not, a goes after b → return 1
      // If b is done and a is not, b goes after a → return -1
      // Otherwise keep order → return 0
      if (aDone && !bDone) return 1;
      if (!aDone && bDone) return -1;
      return 0;
    })[0]?.id;

    console.log(currentAccountIndex);

    setAccountIndex(currentAccountIndex);
  }, [currentHouse]);

  const toggleDone = (houseName, type) => {
    const next = structuredClone(status || { date: todayKey, items: {} });
    if (!next.items[houseName])
      next.items[houseName] = {
        "Robi PretUps": false,
        "Airtel PretUps": false,
      };
    next.items[houseName][type] = !next.items[houseName][type];
    setStatus(next);
  };

  const refreshFromSheet = useCallback(async () => {
    setBusy(true);
    try {
      const resp = await fetch(SHEET_XLSX_URL); // <-- use your XLSX URL const
      if (!resp.ok) throw new Error("Failed to fetch sheet");
      const ab = await resp.arrayBuffer();
      const wb = XLSX.read(ab, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];

      // Use first row as headers → array of objects
      const rows = XLSX.utils.sheet_to_json(ws, {
        defval: "",
        blankrows: false,
        raw: false, // parse as text; remove if you want raw types
        // NOTE: do NOT set `header` here, default uses header row correctly
      });

      const mapped = rows
        .map((r) => {
          const house = (r["DB House Name"] || "").trim();
          const robiId = (r["Robi PretUps Login ID"] || "").trim();
          const robiPw = (r["Robi PretUps Password"] || "").trim();
          const airtelId = (r["Airtel PretUps Login ID"] || "").trim();
          const airtelPw = (r["Airtel PretUps Password"] || "").trim();
          if (!house) return null; // skip empty rows

          return {
            house,
            accounts: [
              {
                type: "Robi PretUps",
                id: robiId,
                password: robiPw,
              },
              {
                type: "Airtel PretUps",
                id: airtelId,
                password: airtelPw,
              },
            ],
          };
        })
        .filter(Boolean);

      setAccounts(mapped); // <-- persist via chrome.storage through your hook
    } catch (e) {
      console.error(e);
      alert("Refresh failed");
    } finally {
      setBusy(false);
    }
  }, [setAccounts]);

  const fillLogin = async () => {
    if (!currentAcc) return;
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id) throw new Error("No active tab");
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        world: "MAIN",
        args: [currentAcc.id, currentAcc.password],
        func: (id, password) => {
          const isVisible = (el) =>
            el &&
            el.offsetParent !== null &&
            getComputedStyle(el).visibility !== "hidden" &&
            !el.disabled;
          const first = (sels) =>
            sels.map((s) => document.querySelector(s)).find(isVisible);
          const setVal = (el, val) => {
            if (!el) return;
            const proto =
              el.tagName === "INPUT"
                ? HTMLInputElement.prototype
                : HTMLTextAreaElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
            el.focus();
            setter.call(el, val || "");
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
            el.blur?.();
          };
          const U = [
            'input[name="username"]',
            'input[name="userName"]',
            'input[name="login"]',
            'input[name="loginId"]',
            'input[name="userId"]',
            'input[id*="user"]',
            'input[id*="login"]',
            'input[placeholder*="User"]',
            'input[placeholder*="Login"]',
            'input[type="tel"]',
            'input[type="number"]',
            'input[type="text"]',
          ];
          const P = [
            'input[name="password"]',
            'input[id*="pass"]',
            'input[type="password"]',
          ];
          setVal(first(U), id);
          setVal(first(P), password);
        },
      });
      // mark done
      const houseName = currentHouse?.house;
      if (houseName) {
        const next = structuredClone(status);
        if (!next.items[houseName])
          next.items[houseName] = {
            "Robi PretUps": false,
            "Airtel PretUps": false,
          };
        next.items[houseName][currentAcc.type] = true;
        setStatus(next);
        console.log("next", currentAcc);
      }

      console.log(houseName);
    } catch (e) {
      console.error(e);
      alert("Autofill failed");
    }
  };

  // initial: load from storage; then user can refresh
  useEffect(() => {
    // if no accounts yet, try auto-refresh once
    if (accountsLoaded && (!accounts || accounts.length === 0)) {
      refreshFromSheet();
    }
  }, [accountsLoaded, accounts]);

  return (
    <div className="flex flex-col gap-2 w-[390px] mx-auto p-1 bg-purple-200 ">
      <div className=" text-gray-500 flex justify-between items-center">
        <h1 className="text-base font-bold ">
          Login Helper (R +A)
          <span className="text-sm ml-1 block">{todayKey}</span>
        </h1>

        {/* Controls */}
        <div className="flex gap-2">
          <button
            onClick={refreshFromSheet}
            disabled={busy}
            className="px-3 py-2 rounded-xl bg-gray-900 text-white text-sm disabled:opacity-50"
          >
            {busy ? "Refreshing…" : "Refresh Sheet"}
          </button>
          <button
            onClick={() => setStatus({ date: todayKey, items: {} })}
            className="px-3 py-2 rounded-xl bg-gray-100 text-sm"
          >
            Reset Today
          </button>
        </div>
      </div>
      {/* Status board */}
      <div className="mt-2 max-h-56 overflow-auto border rounded-xl p-2">
        {houses.length === 0 && (
          <div className="text-gray-500 text-sm">No data yet…</div>
        )}
        {houses.map((h, i) => {
          const status = areAllAccountsDone(h);
          return (
            <div
              key={i}
              className={` ${
                status ? "hidden" : "grid"
              } grid-cols-[1fr_auto_auto] items-center gap-2 py-1 border-b last:border-b-0 `}
            >
              <div className="text-sm font-medium">{h.house}</div>
              {["Robi PretUps", "Airtel PretUps"].map((t) => (
                <button
                  key={t}
                  onClick={() => toggleDone(h.house, t)}
                  className={`px-3 py-1 rounded-full text-xs border ${
                    getDone(h.house, t)
                      ? "bg-green-100 hidden"
                      : "bg-orange-100"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      {/* Dropdowns */}
      <select
        value={houseIndex}
        onChange={(e) => {
          setHouseIndex(Number(e.target.value));
          setAccountIndex(0);
        }}
        className="w-full px-2 py-2 rounded-lg border text-sm"
      >
        {houses.map((h, i) => (
          <option key={i} value={i}>
            {h.house || "Unnamed"}
          </option>
        ))}
      </select>

      <select
        value={accountIndex}
        onChange={(e) => setAccountIndex(e.target.value)}
        className="w-full px-2 py-2 rounded-lg border text-sm"
        style={{
          background:
            currentHouse && getDone(currentHouse.house, currentAcc?.type)
              ? "#dcfce7"
              : "#ffedd5",
        }}
      >
        {(currentHouse?.accounts || [])
          .sort((a, b) => {
            return a.done === b.done ? 0 : a.done ? 1 : -1;
          })
          .map((a, i) => (
            <option key={i} value={a.id}>
              {a.type} (
              <span className="font-bold">{a.done ? "Done" : "Pending"}</span>)
            </option>
          ))}
      </select>

      {/* Credentials preview */}
      <div className="text-sm">
        <div>
          <span className="font-semibold">Login Id:</span>{" "}
          <span className="break-all">{currentAcc?.id || "N/A"}</span>
        </div>
        <div>
          <span className="font-semibold">Password:</span>{" "}
          <span className="break-all">{currentAcc?.password || "N/A"}</span>
        </div>
      </div>

      <button
        onClick={fillLogin}
        className="w-full py-2 rounded-xl bg-blue-600 text-white text-sm"
      >
        Fill Login
      </button>
    </div>
  );
}
