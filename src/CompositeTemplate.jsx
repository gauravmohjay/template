import React, { useEffect, useState } from "react";
import {
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import EgressHelper from "@livekit/egress-sdk";
import "./CompositeTemplate.css";

const FRAME_DECODE_TIMEOUT = 5000;

export default function CompositeTemplate({ layout: initialLayout }) {
  const room = useRoomContext();
  const [layout] = useState(initialLayout);
  const [hasStarted, setHasStarted] = useState(false);

  const allTracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare, Track.Source.Unknown],
    { onlySubscribed: true }
  );

  // Link the room with egress lifecycle helper
  useEffect(() => {
    if (room) {
      EgressHelper.setRoom(room);
    }
  }, [room]);

  // Trigger recording start only when ready
  useEffect(() => {
    if (hasStarted) return;

    const startTime = Date.now();

    const interval = setInterval(async () => {
      let hasVideoTracks = false;
      let hasSubscribedTracks = false;
      let decodedFrames = false;

      for (const participant of room.remoteParticipants.values()) {
        for (const pub of participant.trackPublications.values()) {
          if (pub.isSubscribed) hasSubscribedTracks = true;
          if (pub.kind === Track.Kind.Video && pub.videoTrack) {
            hasVideoTracks = true;
            const stats = await pub.videoTrack.getRTCStatsReport();
            if (stats.size) {
              for (const [, report] of stats) {
                if (report.type === "inbound-rtp" && report.framesDecoded > 0) {
                  decodedFrames = true;
                }
              }
            }
          }
        }
      }

      const elapsed = Date.now() - startTime;
      if (
        decodedFrames || // video frames flowing
        (!hasVideoTracks && hasSubscribedTracks && elapsed > 500) || // no video, tracks subscribed
        (elapsed > FRAME_DECODE_TIMEOUT && hasSubscribedTracks) // fallback timeout
      ) {
        EgressHelper.startRecording();
        setHasStarted(true);
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [room, hasStarted]);

  const filteredTracks = allTracks.filter(
    (t) =>
      t.publication.kind === Track.Kind.Video &&
      t.participant.identity !== room.localParticipant.identity
  );

  return (
    <div className={`room-container ${layout.endsWith("-light") ? "light" : "dark"}`}>
      <GridLayout tracks={filteredTracks}>
        <ParticipantTile showPlaceholder />
      </GridLayout>
      <RoomAudioRenderer />
    </div>
  );
}
