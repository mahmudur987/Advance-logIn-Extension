// App.jsx
import React from "react";
import { useChromeStorage } from "./hooks/useChromeStorage";
import GpManager from "./Gp";
import RobiAirtel from "./RobiAirtel";

const App = () => {
  // persist view in chrome.storage.local so it doesn't reset when popup opens
  const {
    value: view,
    setValue: setView,
    loaded,
  } = useChromeStorage("popupViewV1", true);

  // optional: you can still show a tiny loader until storage loads
  if (!loaded) return <div className="p-3">Loading…</div>;

  return (
    <div className="p-2">
      <button
        className="bg-red-300 hover:bg-red-500 p-1 rounded-md mb-2"
        onClick={() => {
          if (
            window.confirm(
              `Are you sure you want to switch to ${
                view ? "GP" : "Robi/Airtel"
              }?`
            )
          ) {
            setView(!view);
          }
        }}
      >
        Switch to {view ? "GP" : "Robi/Airtel"}
      </button>

      {view ? <RobiAirtel /> : <GpManager />}
    </div>
  );
};

export default App;
