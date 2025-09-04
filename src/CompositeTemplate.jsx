import React, { useEffect, useState } from "react";
import {
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "./CompositeTemplate.css";

const FRAME_DECODE_TIMEOUT = 5000;
const START_RECORDING_DELAY = 2000; // 2 second delay

export default function CompositeTemplate({ layout: initialLayout }) {
  const room = useRoomContext();
  const [layout] = useState(initialLayout);
  const [hasStarted, setHasStarted] = useState(false);

  const allTracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare, Track.Source.Unknown],
    { onlySubscribed: true }
  );

  // Send start signal to egress
  const sendStartSignal = () => {
    console.log("Sending start signal to egress...");
    
    // Method 1: Using postMessage to parent window
    if (window.parent) {
      window.parent.postMessage({ type: "egress_start" }, "*");
    }
    
    // Method 2: Using global function if available
    if (window.startEgress) {
      window.startEgress();
    }
    
    // Method 3: Using fetch to notify (if you have an endpoint)
    // fetch('/api/egress/start', { method: 'POST' }).catch(console.error);
    
    setHasStarted(true);
  };

  // Trigger recording start when ready
  useEffect(() => {
    if (hasStarted || !room) return;

    const startTime = Date.now();
    let intervalId;

    // Wait for room to be properly connected
    const waitForRoom = () => {
      if (room.state !== "connected") {
        setTimeout(waitForRoom, 100);
        return;
      }

      intervalId = setInterval(async () => {
        let hasVideoTracks = false;
        let hasSubscribedTracks = false;
        let decodedFrames = false;
        let participantCount = 0;

        // Check all participants (including local for screen recording)
        const allParticipants = [
          room.localParticipant,
          ...Array.from(room.remoteParticipants.values())
        ];

        for (const participant of allParticipants) {
          if (participant.trackPublications.size > 0) {
            participantCount++;
          }

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
        
        // More lenient conditions for starting
        const shouldStart = 
          decodedFrames || // video frames are flowing
          (!hasVideoTracks && hasSubscribedTracks && elapsed > 1000) || // audio only case
          (participantCount > 0 && elapsed > START_RECORDING_DELAY) || // participants present
          elapsed > FRAME_DECODE_TIMEOUT; // fallback timeout

        console.log("Egress start check:", {
          elapsed,
          hasVideoTracks,
          hasSubscribedTracks,
          decodedFrames,
          participantCount,
          shouldStart
        });

        if (shouldStart) {
          sendStartSignal();
          clearInterval(intervalId);
        }
      }, 200);
    };

    waitForRoom();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [room, hasStarted]);

  // For screen recording, we might want to show the host's screen
  const filteredTracks = allTracks.filter((t) => {
    if (layout === "single-speaker") {
      // For single-speaker (screen recording), include screen shares and cameras
      return t.publication.kind === Track.Kind.Video;
    } else {
      // For grid layout, exclude local participant's camera (but include screen shares)
      return t.publication.kind === Track.Kind.Video && 
        (t.source === Track.Source.ScreenShare || 
         t.participant.identity !== room?.localParticipant?.identity);
    }
  });

  console.log("Filtered tracks:", filteredTracks.length, "Layout:", layout);

  return (
    <div className={`room-container ${layout?.endsWith("-light") ? "light" : "dark"}`}>
      <GridLayout tracks={filteredTracks}>
        <ParticipantTile showPlaceholder={true} />
      </GridLayout>
      <RoomAudioRenderer />
    </div>
  );
}