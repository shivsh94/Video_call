import React, { useCallback, useEffect, useState } from 'react';
import { useSocket } from '../context/SocketProvider';
import peer from '../service/peer';
import { Video, Phone, UserCheck, UserX, Users } from 'lucide-react';

const Room = () => {
    const socket = useSocket();
    const [remotePeers, setRemotePeers] = useState(new Map()); // Map of userId -> {email, stream}
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
            newPeers.set(id, { email, stream: null });
            return newPeers;
        });

        // Get user media if not already available
        if (!myStream) {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            setMyStream(stream);
        }

        // Create offer for the new user
        const offer = await peer.getOffer(id);
        socket.emit("user:call", { to: id, offer });
    }, [socket, myStream]);

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
        console.log("Incoming call from:", from);

        // Get user media if not already available
        if (!myStream) {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            setMyStream(stream);
        }

        const ans = await peer.getAnswer(from, offer);
        socket.emit("call:accepted", { to: from, answer: ans });

        // Add to remote peers if not already there
        setRemotePeers((prev) => {
            if (!prev.has(from)) {
                const newPeers = new Map(prev);
                newPeers.set(from, { email: 'Unknown', stream: null });
                return newPeers;
            }
            return prev;
        });
    }, [socket, myStream]);

    const sendStreams = useCallback((userId) => {
        if (!myStream) return;
        for (const track of myStream.getTracks()) {
            peer.addTrack(userId, track, myStream);
        }
    }, [myStream]);

    const handleCallAccepted = useCallback(async ({ from, answer }) => {
        await peer.setRemoteDescription(from, answer);
        console.log("Call accepted from:", from);
        sendStreams(from);
    }, [sendStreams]);

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

    // Setup track listeners for each peer
    useEffect(() => {
        remotePeers.forEach((peerData, userId) => {
            const peerConnection = peer.getPeer(userId);
            if (peerConnection && !peerData.stream) {
                peerConnection.ontrack = (ev) => {
                    console.log("GOT TRACKS from:", userId);
                    setRemotePeers((prev) => {
                        const newPeers = new Map(prev);
                        const existing = newPeers.get(userId);
                        if (existing) {
                            newPeers.set(userId, { ...existing, stream: ev.streams[0] });
                        }
                        return newPeers;
                    });
                };

                peerConnection.onnegotiationneeded = () => {
                    handleNegotiationNeeded(userId);
                };
            }
        });
    }, [remotePeers, handleNegotiationNeeded]);

    // Auto send streams when myStream becomes available
    useEffect(() => {
        if (myStream) {
            remotePeers.forEach((peerData, userId) => {
                sendStreams(userId);
            });
        }
    }, [myStream, remotePeers, sendStreams]);

    useEffect(() => {
        if (!socket) return;
        
        socket.on("room:users", handleRoomUsers);
        socket.on("user:joined", handleUserJoined);
        socket.on("user:left", handleUserLeft);
        socket.on("incoming:call", handleIncomingCall);
        socket.on("call:accepted", handleCallAccepted);
        socket.on("peer:nego:needed", handleNegoNeedIncoming);
        socket.on("peer:nego:final", handleNegoFinal);

        return () => {
            socket.off("room:users", handleRoomUsers);
            socket.off("user:joined", handleUserJoined);
            socket.off("user:left", handleUserLeft);
            socket.off("incoming:call", handleIncomingCall);
            socket.off("call:accepted", handleCallAccepted);
            socket.off("peer:nego:needed", handleNegoNeedIncoming);
            socket.off("peer:nego:final", handleNegoFinal);
        };
    }, [socket, handleRoomUsers, handleUserJoined, handleUserLeft, handleIncomingCall, handleCallAccepted, handleNegoNeedIncoming, handleNegoFinal]);

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
                    {Array.from(remotePeers.entries()).map(([userId, peerData]) => (
                        peerData.stream && (
                            <div key={userId} className="w-full">
                                <div className="relative">
                                    <video
                                        ref={(video) => video && (video.srcObject = peerData.stream)}
                                        autoPlay
                                        className="w-full rounded-xl bg-gray-800"
                                        style={{ transform: "scaleX(-1)" }}
                                    />
                                    <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-1 rounded-lg">
                                        <span className="text-sm font-medium">{peerData.email}</span>
                                    </div>
                                </div>
                            </div>
                        )
                    ))}
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
