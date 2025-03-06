// src/App.tsx
import { useState } from "react";
import "./App.css";
import Player from "./components/Player";

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <h1>Eyevinn Event Sink sample</h1>
      <div className="card">
        <Player src="https://eyevinnlab-devguide.minio-minio.auto.prod.osaas.io/devguide/VINN/52e124b8-ebe8-4dfe-9b59-8d33abb359ca/index.m3u8" />
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
      </div>
    </>
  );
}

export default App;
