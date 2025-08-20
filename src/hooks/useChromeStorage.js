import { useEffect, useState, useCallback } from "react";

const hasChromeStorage = () => {
  try {
    return typeof chrome !== "undefined" && chrome.storage?.local;
  } catch {
    return false;
  }
};

export function useChromeStorage(key, initialValue) {
  const [value, setValue] = useState(initialValue);
  const [loaded, setLoaded] = useState(false);

  // load once
  useEffect(() => {
    if (!hasChromeStorage()) {
      setLoaded(true);
      return;
    }
    chrome.storage.local.get(key, (res) => {
      if (res && Object.prototype.hasOwnProperty.call(res, key)) {
        setValue(res[key]);
      }
      setLoaded(true);
    });
  }, [key]);

  // save when value changes
  const save = useCallback(
    (next) => {
      setValue(next);
      if (hasChromeStorage()) {
        chrome.storage.local.set({ [key]: next });
      } else {
        localStorage.setItem(key, JSON.stringify(next));
      }
    },
    [key]
  );

  return { value, setValue: save, loaded };
}
