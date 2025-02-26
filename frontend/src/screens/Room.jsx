import React, { use, useCallback, useEffect, useState } from 'react';
import ReactPlayer from 'react-player';
import { useSocket } from '../context/SocketProvider';
import peer from '../service/peer';
import { Video, Phone, UserCheck, UserX } from 'lucide-react';

const Room = () => {
    const socket = useSocket();
    const [remoteSocketId, setRemoteSocketId] = useState(null);
    const [myStream, setMyStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);

   
    const handleRoomJoin = useCallback(
        (data) => {
            console.log("Room joined:", data.name);
            setRemoteSocketId(data.id);
        },
        []
    );

    const handleCall = useCallback(async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true,audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100,
          },});
        const offer = await peer.getOffer();
        socket.emit("user:call", { to: remoteSocketId, offer });
        setMyStream(stream);
    }, [remoteSocketId, socket]);

    const handleIncomingCall = useCallback(async ({ from, offer }) => {
        setRemoteSocketId(from);
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100,
          },});
        setMyStream(stream);
        console.log("Incoming call from:", from);
        console.log("Offer:", offer);
        const ans = await peer.getAnswer(offer);
        socket.emit("call:accepted", { to: from, answer: ans });
    }, [socket]);

    const sendStreams = useCallback(() => {
        for (const track of myStream.getTracks()) {
            peer.peer.addTrack(track, myStream);
        }
    }, [myStream]);

    const handleCallAccepted = useCallback(async ({ from, answer }) => {
        peer.setRemoteDescription(answer);
        console.log("Call accepted from:", from);
        sendStreams();
    }, [sendStreams]);

    const handleNegotiationNeeded = useCallback(async () => {
        const offer = await peer.getOffer();
        socket.emit("peer:nego:needed", { to: remoteSocketId, offer });
    }, [remoteSocketId, socket]);

    useEffect(() => {
        peer.peer.addEventListener("negotiationneeded", handleNegotiationNeeded);
        return () => {
            peer.peer.removeEventListener("negotiationneeded", handleNegotiationNeeded);
        };
    }, [handleNegotiationNeeded]);

    const handleNegoNeedIncoming = useCallback(async ({ from, offer }) => {
        const ans = await peer.getAnswer(offer);
        socket.emit("peer:nego:done", { to: from, answer: ans });
    }, [socket]);

    const handleNegoFinal = useCallback(async ({ answer }) => {
        await peer.setRemoteDescription(answer);
    }, []);

    useEffect(() => {
        peer.peer.addEventListener("track", async ev => {
            const remoteStream = ev.streams
            console.log("GOT TRACKS")
            setRemoteStream(remoteStream[0]);
        });
    }, []);

    useEffect(() => {
        if (!socket) return;
        socket.on("user:join", handleRoomJoin);
        socket.on("incoming:call", handleIncomingCall);
        socket.on("call:accepted", handleCallAccepted);
        socket.on("peer:nego:needed", handleNegoNeedIncoming);
        socket.on("peer:nego:final", handleNegoFinal);

        return () => {
            socket.off("user:join", handleRoomJoin);
            socket.off("incoming:call", handleIncomingCall);
            socket.off("call:accepted", handleCallAccepted);
            socket.off("peer:nego:needed", handleNegoNeedIncoming);
            socket.off("peer:nego:final", handleNegoFinal);
        };
    }, [socket, handleRoomJoin, handleIncomingCall]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Header Section */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl md:text-4xl font-bold mb-6">Video Chat Room</h1>
                    
                    <div className="flex items-center justify-center gap-2 mb-6">
                        {remoteSocketId ? (
                            <div className="flex items-center gap-2 text-green-400">
                                <UserCheck size={24} />
                                <span className="text-lg">Connected</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-gray-400">
                                <UserX size={24} />
                                <span className="text-lg">Waiting for Other User </span>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-4 justify-center">
                        {myStream && (
                            <button 
                                onClick={sendStreams}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
                            >
                                <Video size={20} />
                                <span>Send Stream</span>
                            </button>
                        )}

                        {remoteSocketId && (
                            <button 
                                onClick={handleCall}
                                className="flex items-center gap-2 border-2 border-amber-400 text-amber-400 hover:bg-amber-400/10 px-4 py-2 rounded-lg transition-colors"
                            >
                                <Phone size={20} />
                                <span>Call</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Video Streams Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Local Stream */}
                    {myStream && (
                        <div className="w-full">
                            <h2 className="text-xl font-semibold mb-4 text-center">My Video</h2>
                            <div className="rounded-xl overflow-hidden bg-gray-800 shadow-lg">
                                <div style={{ transform: "scaleX(-1)" }} className="aspect-video">
                                    <ReactPlayer
                                        url={myStream}
                                        playing={true}
                                        controls={true}
                                        width="100%"
                                        height="100%"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Remote Stream */}
                    {remoteStream && (
                        <div className="w-full">
                            <h2 className="text-xl font-semibold mb-4 text-center">Remote Video</h2>
                            <div className="rounded-xl overflow-hidden bg-gray-800 shadow-lg">
                                <div style={{ transform: "scaleX(-1)" }} className="aspect-video">
                                    <ReactPlayer
                                        url={remoteStream}
                                        playing={true}
                                        controls={true}
                                        width="100%"
                                        height="100%"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Room;