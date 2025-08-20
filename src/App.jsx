import { useState } from "react";
import GpManager from "./Gp";
import RobiAirtel from "./RobiAirtel";

const App = () => {
  const [view, setView] = useState(true);

  return (
    <div>
      <button
        className="bg-red-300 hover:bg-red-500 p-1 rounded-md"
        onClick={() => {
          alert("Switching to " + (view ? "GP" : "Robi/Airtel") + " view");
          setView(!view);
        }}
      >
        Switch
      </button>
      {view && <RobiAirtel />}

      {!view && <GpManager />}
    </div>
  );
};

export default App;
