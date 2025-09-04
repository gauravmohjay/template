import React, { useState } from "react";
import { LiveKitRoom } from "@livekit/components-react";
import CompositeTemplate from "./CompositeTemplate";

export default function RoomPage({ url, token, layout }) {
  const [error, setError] = useState();

  if (!url || !token) {
    return <div className="error">Missing url or token</div>;
  }

  return (
    <LiveKitRoom serverUrl={url} token={token} onError={setError}>
      {error ? <div className="error">{error.message}</div> : <CompositeTemplate layout={layout} />}
    </LiveKitRoom>
  );
}
