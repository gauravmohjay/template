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


const FRAME_DECODE_TIMEOUT = 5000;

export default function CompositeTemplate({ layout: initialLayout }) {
  const room = useRoomContext();
  const [layout] = useState(initialLayout);
  const [startCalled, setStartCalled] = useState(false);

  const allTracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare, Track.Source.Unknown],
    {
      onlySubscribed: true,
    }
  );

  useEffect(() => {
    EgressHelper.setRoom(room);
  }, [room]);

  useEffect(() => {
    if (startCalled) return;

    const startTime = Date.now();

    const interval = setInterval(async () => {
      let hasVideoTracks = false;
      let hasSubscribedTracks = false;
      let hasDecodedFrames = false;

      for (const participant of room.remoteParticipants.values()) {
        for (const publication of participant.trackPublications.values()) {
          if (publication.isSubscribed) {
            hasSubscribedTracks = true;
          }
          if (publication.kind === Track.Kind.Video && publication.videoTrack) {
            hasVideoTracks = true;
            const stats = await publication.videoTrack.getRTCStatsReport();
            if (stats.size > 0) {
              for (const [, report] of stats) {
                if (report.type === "inbound-rtp" && report.framesDecoded > 0) {
                  hasDecodedFrames = true;
                  break;
                }
              }
            }
          }
        }
      }

      const timeElapsed = Date.now() - startTime;

      if (
        hasDecodedFrames ||
        (!hasVideoTracks && hasSubscribedTracks && timeElapsed > 500) ||
        (timeElapsed > FRAME_DECODE_TIMEOUT && hasSubscribedTracks)
      ) {
        EgressHelper.startRecording();
        setStartCalled(true);
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [room, startCalled]);

  const filteredTracks = allTracks.filter(
    (track) =>
      track.publication.kind === Track.Kind.Video &&
      track.participant.identity !== room.localParticipant.identity
  );

  return (
    <div className={`room-container ${layout.startsWith("light") ? "light" : "dark"}`}>
      <GridLayout tracks={filteredTracks}>
        <ParticipantTile showPlaceholder />
      </GridLayout>
      <RoomAudioRenderer />
    </div>
  );
}
