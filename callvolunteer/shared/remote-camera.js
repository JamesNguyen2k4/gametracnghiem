const RTC_CONFIG = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" }
    ]
  };
  
  export function createPeerConnection({ onIceCandidate, onRemoteStream } = {}) {
    const pc = new RTCPeerConnection(RTC_CONFIG);
  
    pc.onicecandidate = (event) => {
      if (event.candidate && typeof onIceCandidate === "function") {
        onIceCandidate(event.candidate);
      }
    };
  
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream && typeof onRemoteStream === "function") {
        onRemoteStream(stream);
      }
    };
  
    return pc;
  }
  
  export async function addLocalStream(pc, stream) {
    if (!pc || !stream) return;
  
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });
  }
  
  export async function createOffer(pc) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    return offer;
  }
  
  export async function createAnswer(pc) {
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return answer;
  }
  
  export async function setRemoteDescription(pc, sdp) {
    if (!pc || !sdp) return;
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }
  
  export async function addIceCandidate(pc, candidate) {
    if (!pc || !candidate) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.warn("ICE candidate error:", error);
    }
  }
  
  export function closePeerConnection(pc) {
    if (!pc) return;
  
    try {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.close();
    } catch (error) {
      console.warn("closePeerConnection error:", error);
    }
  }