import React from "react";
import EgressHelper from "@livekit/egress-sdk";
import RoomPage from "./RoomPage";
import "./App.css";

export default function App() {
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
