import React from "react";
import EgressHelper from "@livekit/egress-sdk";
import RoomPage from "./RoomPage";
import "./App.css";

export default function App() {
  // Get parameters from URL query string - this is how LiveKit passes them
  const urlParams = new URLSearchParams(window.location.search);
  const url = urlParams.get('url') || EgressHelper.getLiveKitURL();
  const token = urlParams.get('token') || EgressHelper.getAccessToken();
  const layout = urlParams.get('layout') || EgressHelper.getLayout() || 'grid';

  console.log('App initialized with:', { url, token, layout });

  return (
    <div className="container">
      <RoomPage
        url={url}
        token={token}
        layout={layout}
      />
    </div>
  );
}