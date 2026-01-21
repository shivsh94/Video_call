import React, { useCallback, useEffect, useState } from 'react';
import { useSocket } from '../context/SocketProvider';
import peer from '../service/peer';
import { Video, Phone, UserCheck, UserX, Users } from 'lucide-react';

const Room = () => {
    const socket = useSocket();
    const [remotePeers, setRemotePeers] = useState(new Map()); // Map of userId -> {email, stream, tracksAdded}
    const [myStream, setMyStream] = useState(null);

    // Handle existing users in the room
    const handleRoomUsers = useCallback((data) => {
        console.log("Existing users in room:", data.users);
        // We'll receive user:joined events for initiating connections
    }, []);

    // Handle new user joining
    const handleUserJoined = useCallback(async ({ email, id }) => {
        console.log("User joined:", email, id);
        
        setRemotePeers((prev) => {
            const newPeers = new Map(prev);
            newPeers.set(id, { email, stream: null, tracksAdded: false });
            return newPeers;
        });

        // Get user media if not already available
        let stream = myStream;
        if (!stream) {
            stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            setMyStream(stream);
        }

        // Create peer and setup track listener IMMEDIATELY
        const peerConnection = peer.createPeer(id);
        console.log("Created peer connection for:", id, peerConnection);
        
        // Monitor ICE connection state
        peerConnection.oniceconnectionstatechange = () => {
            console.log("ICE connection state for", id, ":", peerConnection.iceConnectionState);
        };
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("Sending ICE candidate to:", id);
                socket.emit("ice:candidate", { to: id, candidate: event.candidate });
            }
        };
        
        // Setup track listener FIRST before any other operations
        peerConnection.ontrack = (ev) => {
            console.log("🎥 GOT TRACKS from:", id, "Stream:", ev.streams[0]);
            console.log("Track kind:", ev.track.kind, "Enabled:", ev.track.enabled, "Muted:", ev.track.muted);
            setRemotePeers((prev) => {
                const newPeers = new Map(prev);
                const existing = newPeers.get(id);
                if (existing) {
                    console.log("Setting stream for peer:", id);
                    newPeers.set(id, { ...existing, stream: ev.streams[0] });
                }
                return newPeers;
            });
        };

        // Add our tracks to the connection BEFORE creating offer
        console.log("Adding tracks for peer:", id);
        stream.getTracks().forEach((track) => {
            console.log("Adding track:", track.kind, "to peer:", id);
            peer.addTrack(id, track, stream);
        });

        // Create and send offer LAST
        const offer = await peer.getOffer(id);
        console.log("Sending offer to:", id);
        socket.emit("user:call", { to: id, offer });
    }, [socket]);

    // Handle user leaving
    const handleUserLeft = useCallback(({ email, id }) => {
        console.log("User left:", email, id);
        peer.removePeer(id);
        setRemotePeers((prev) => {
            const newPeers = new Map(prev);
            newPeers.delete(id);
            return newPeers;
        });
    }, []);

    const handleIncomingCall = useCallback(async ({ from, offer }) => {
        console.log("📞 Incoming call from:", from, "with offer");

        // Add to remote peers if not already there
        setRemotePeers((prev) => {
            if (!prev.has(from)) {
                const newPeers = new Map(prev);
                newPeers.set(from, { email: 'Unknown', stream: null, tracksAdded: false });
                return newPeers;
            }
            return prev;
        });

        // Get user media if not already available
        let stream = myStream;
        if (!stream) {
            stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            setMyStream(stream);
        }

        // Create peer connection FIRST (before answering)
        const peerConnection = peer.createPeer(from);
        console.log("Created peer connection for incoming call:", from, peerConnection);
        
        // Monitor ICE connection state
        peerConnection.oniceconnectionstatechange = () => {
            console.log("ICE connection state for", from, ":", peerConnection.iceConnectionState);
        };
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("Sending ICE candidate to:", from);
                socket.emit("ice:candidate", { to: from, candidate: event.candidate });
            }
        };
        
        // Setup track listener IMMEDIATELY
        peerConnection.ontrack = (ev) => {
            console.log("🎥 GOT TRACKS from:", from, "Stream:", ev.streams[0]);
            console.log("Track kind:", ev.track.kind, "Enabled:", ev.track.enabled, "Muted:", ev.track.muted);
            setRemotePeers((prev) => {
                const newPeers = new Map(prev);
                const existing = newPeers.get(from);
                if (existing) {
                    console.log("Setting stream for peer:", from);
                    newPeers.set(from, { ...existing, stream: ev.streams[0] });
                }
                return newPeers;
            });
        };

        // Add our tracks BEFORE answering
        console.log("Adding tracks for peer:", from);
        stream.getTracks().forEach((track) => {
            console.log("Adding track:", track.kind, "to peer:", from);
            peer.addTrack(from, track, stream);
        });

        // Now create answer
        console.log("Creating answer for:", from);
        const ans = await peer.getAnswer(from, offer);
        console.log("Answer created, sending to:", from);

        socket.emit("call:accepted", { to: from, answer: ans });
    }, [socket]);

    const sendStreams = useCallback((userId) => {
        if (!myStream) return;
        
        const peerConnection = peer.getPeer(userId);
        if (!peerConnection) return;
        
        // Check if tracks are already added to avoid duplicate error
        const senders = peerConnection.getSenders();
        if (senders.length > 0) {
            console.log("Tracks already added to peer:", userId);
            return;
        }
        
        for (const track of myStream.getTracks()) {
            peer.addTrack(userId, track, myStream);
        }
        
        // Mark tracks as added
        setRemotePeers((prev) => {
            const newPeers = new Map(prev);
            const existing = newPeers.get(userId);
            if (existing) {
                newPeers.set(userId, { ...existing, tracksAdded: true });
            }
            return newPeers;
        });
    }, [myStream]);

    const handleCallAccepted = useCallback(async ({ from, answer }) => {
        console.log("Call accepted from:", from, "setting remote description");
        await peer.setRemoteDescription(from, answer);
        console.log("Remote description set successfully for:", from);
    }, []);

    const handleNegotiationNeeded = useCallback(async (userId) => {
        const offer = await peer.getOffer(userId);
        socket.emit("peer:nego:needed", { to: userId, offer });
    }, [socket]);

    const handleNegoNeedIncoming = useCallback(async ({ from, offer }) => {
        const ans = await peer.getAnswer(from, offer);
        socket.emit("peer:nego:done", { to: from, answer: ans });
    }, [socket]);

    const handleNegoFinal = useCallback(async ({ from, answer }) => {
        await peer.setRemoteDescription(from, answer);
    }, []);

    // Handle incoming ICE candidates
    const handleIceCandidate = useCallback(async ({ from, candidate }) => {
        console.log("Received ICE candidate from:", from);
        const peerConnection = peer.getPeer(from);
        if (peerConnection) {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                console.log("Added ICE candidate from:", from);
            } catch (err) {
                console.error("Error adding ICE candidate:", err);
            }
        }
    }, []);

    // Setup negotiation listeners for each peer
    useEffect(() => {
        remotePeers.forEach((peerData, userId) => {
            const peerConnection = peer.getPeer(userId);
            if (peerConnection) {
                peerConnection.onnegotiationneeded = () => {
                    handleNegotiationNeeded(userId);
                };
            }
        });
    }, [remotePeers, handleNegotiationNeeded]);

    useEffect(() => {
        if (!socket) return;
        
        socket.on("room:users", handleRoomUsers);
        socket.on("user:joined", handleUserJoined);
        socket.on("user:left", handleUserLeft);
        socket.on("incoming:call", handleIncomingCall);
        socket.on("call:accepted", handleCallAccepted);
        socket.on("peer:nego:needed", handleNegoNeedIncoming);
        socket.on("peer:nego:final", handleNegoFinal);
        socket.on("ice:candidate", handleIceCandidate);

        return () => {
            socket.off("room:users", handleRoomUsers);
            socket.off("user:joined", handleUserJoined);
            socket.off("user:left", handleUserLeft);
            socket.off("incoming:call", handleIncomingCall);
            socket.off("call:accepted", handleCallAccepted);
            socket.off("peer:nego:needed", handleNegoNeedIncoming);
            socket.off("peer:nego:final", handleNegoFinal);
            socket.off("ice:candidate", handleIceCandidate);
        };
    }, [socket, handleRoomUsers, handleUserJoined, handleUserLeft, handleIncomingCall, handleCallAccepted, handleNegoNeedIncoming, handleNegoFinal, handleIceCandidate]);

    // Handle video element updates for remote streams
    useEffect(() => {
        // Small delay to ensure video element is rendered
        const timeoutId = setTimeout(() => {
            remotePeers.forEach((peerData, userId) => {
                if (peerData.stream) {
                    const videoElement = document.getElementById(`remote-video-${userId}`);
                    console.log("Looking for video element:", `remote-video-${userId}`, "Found:", !!videoElement);
                    
                    if (videoElement) {
                        if (videoElement.srcObject !== peerData.stream) {
                            console.log("Setting stream for video element:", userId);
                            videoElement.srcObject = peerData.stream;
                        }
                        
                        // Force play if paused
                        if (videoElement.paused) {
                            console.log("Video paused, attempting to play:", userId);
                            videoElement.play().catch(err => {
                                console.log("Autoplay prevented:", err.message);
                            });
                        }
                    }
                }
            });
        }, 100);

        return () => clearTimeout(timeoutId);
    }, [remotePeers]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Header Section */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl md:text-4xl font-bold mb-6">Video Chat Room</h1>

                    <div className="flex items-center justify-center gap-4 mb-6">
                        <div className="flex items-center gap-2 text-blue-400">
                            <Users size={24} />
                            <span className="text-lg">{remotePeers.size + 1} Participants</span>
                        </div>
                        
                        {remotePeers.size > 0 ? (
                            <div className="flex items-center gap-2 text-green-400">
                                <UserCheck size={24} />
                                <span className="text-lg">Connected</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-gray-400">
                                <UserX size={24} />
                                <span className="text-lg">Waiting for Others</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Video Streams Grid */}
                <div className={`grid gap-4 ${
                    remotePeers.size === 0 ? 'grid-cols-1' :
                    remotePeers.size === 1 ? 'grid-cols-1 md:grid-cols-2' :
                    remotePeers.size === 2 ? 'grid-cols-1 md:grid-cols-3' :
                    remotePeers.size <= 5 ? 'grid-cols-2 md:grid-cols-3' :
                    'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                }`}>
                    {/* Local Stream */}
                    {myStream && (
                        <div className="w-full">
                            <div className="relative">
                                <video
                                    ref={(video) => video && (video.srcObject = myStream)}
                                    autoPlay
                                    muted
                                    className="w-full rounded-xl bg-gray-800"
                                    style={{ transform: "scaleX(-1)" }}
                                />
                                <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-1 rounded-lg">
                                    <span className="text-sm font-medium">You</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Remote Streams */}
                    {Array.from(remotePeers.entries()).map(([userId, peerData]) => {
                        console.log("Rendering peer:", userId, "Has stream:", !!peerData.stream, "Email:", peerData.email);
                        return peerData.stream ? (
                            <div key={userId} className="w-full">
                                <div className="relative">
                                    <video
                                        id={`remote-video-${userId}`}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full rounded-xl bg-gray-800"
                                        style={{ transform: "scaleX(-1)" }}
                                        onCanPlay={(e) => {
                                            console.log("Video can play:", userId);
                                            e.target.muted = false;
                                            e.target.play().catch(console.error);
                                        }}
                                        onLoadedData={(e) => {
                                            console.log("Video loaded data:", userId);
                                        }}
                                    />
                                    <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-1 rounded-lg">
                                        <span className="text-sm font-medium">{peerData.email}</span>
                                    </div>
                                </div>
                            </div>
                        ) : null;
                    })}
                </div>

                {/* Waiting message when alone */}
                {!myStream && remotePeers.size === 0 && (
                    <div className="text-center mt-12">
                        <p className="text-gray-400 text-lg">
                            Waiting for participants to join...
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Room;
