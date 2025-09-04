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
  const [hasStarted, setHasStarted] = useState(false);

  const allTracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare, Track.Source.Unknown],
    { onlySubscribed: true }
  );

  // Set the room for EgressHelper - this is crucial
  useEffect(() => {
    if (room) {
      EgressHelper.setRoom(room);
    }
  }, [room]);

  // Start recording when ready - following LiveKit's pattern
  useEffect(() => {
    if (hasStarted || !room) return;

    const startTime = Date.now();

    const checkReadiness = setInterval(async () => {
      let hasVideoTracks = false;
      let hasSubscribedTracks = false;
      let decodedFrames = false;

      // Check all participants for readiness
      const allParticipants = [
        room.localParticipant,
        ...Array.from(room.remoteParticipants.values())
      ];

      for (const participant of allParticipants) {
        for (const pub of participant.trackPublications.values()) {
          if (pub.isSubscribed) hasSubscribedTracks = true;
          
          if (pub.kind === Track.Kind.Video && pub.videoTrack) {
            hasVideoTracks = true;
            
            try {
              const stats = await pub.videoTrack.getRTCStatsReport();
              for (const [, report] of stats) {
                if (report.type === "inbound-rtp" && report.framesDecoded > 0) {
                  decodedFrames = true;
                  break;
                }
              }
            } catch (err) {
              console.warn("Could not get video stats:", err);
            }
          }
        }
      }

      const elapsed = Date.now() - startTime;
      
      // Conditions for starting recording
      const shouldStart = 
        decodedFrames || // video frames are flowing
        (!hasVideoTracks && hasSubscribedTracks && elapsed > 500) || // audio only
        elapsed > FRAME_DECODE_TIMEOUT; // timeout fallback

      if (shouldStart) {
        console.log("START_RECORDING"); // This is the key signal LiveKit looks for!
        EgressHelper.startRecording();
        setHasStarted(true);
        clearInterval(checkReadiness);
      }
    }, 100);

    return () => clearInterval(checkReadiness);
  }, [room, hasStarted]);

  // Filter tracks based on layout type
  const getFilteredTracks = () => {
    if (layout === "single-speaker") {
      // For single-speaker layout, typically show only the speaking participant
      return allTracks.filter(t => t.publication.kind === Track.Kind.Video);
    } else {
      // For grid layout, show all video tracks except local participant's camera
      // (unless it's a screen share)
      return allTracks.filter((t) => {
        if (t.publication.kind !== Track.Kind.Video) return false;
        
        // Include screen shares from anyone
        if (t.source === Track.Source.ScreenShare) return true;
        
        // For regular camera feeds, exclude local participant
        return t.participant.identity !== room?.localParticipant?.identity;
      });
    }
  };

  const filteredTracks = getFilteredTracks();

  // Handle cleanup when component unmounts
  useEffect(() => {
    return () => {
      if (hasStarted) {
        console.log("END_RECORDING"); // Signal to end recording
      }
    };
  }, [hasStarted]);

  return (
    <div className={`room-container ${layout?.endsWith("-light") ? "light" : "dark"}`}>
      <GridLayout tracks={filteredTracks}>
        <ParticipantTile showPlaceholder={true} />
      </GridLayout>
      <RoomAudioRenderer />
    </div>
  );
}