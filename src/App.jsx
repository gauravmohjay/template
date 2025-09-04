import React from "react";
import EgressHelper from "@livekit/egress-sdk";
import RoomPage from "./RoomPage";
import "./App.css";

function App() {
  return (
    <div className="container">
      <RoomPage
        url={EgressHelper.getLiveKitURL()}
        token={EgressHelper.getAccessToken()}
        layout={EgressHelper.getLayout()}
      />
    </div>
  );
}

export default App;
