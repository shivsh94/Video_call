import React, { use, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketProvider';
import { Mail, Key, LogIn } from 'lucide-react';

const Lobby = () => {
    const [email, setEmail] = useState('');
    const [roomId, setRoomId] = useState('');
    const socket = useSocket();
    const navigate = useNavigate();

    const handleSubmit = useCallback(
        (e) => {
            e.preventDefault();
            if (!socket) {
                console.error("Socket not initialized");
                return;
            }
            if (!email || !roomId) {
                console.error("Email or Room ID is empty!");
                return;
            }

            console.log("Sending join-room event:", { email, roomId });
            socket.emit("room:join", { email, roomId });
        },
        [email, roomId, socket]
    );

    useEffect(() => {
        if (!socket) return;

        const handleRoomJoin = (data) => {
            console.log("Room joined:", data.email);
            navigate(`/room/${data.roomId}`);
        };

        socket.on("room:join", handleRoomJoin);

        return () => {
            socket.off("room:join", handleRoomJoin);
        };
    }, [socket]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <h1 className="text-3xl md:text-4xl font-bold text-center mb-8">
                    Welcome to Video Chat
                </h1>

                <div className="bg-gray-800 rounded-xl shadow-xl p-6 md:p-8">
                    <h2 className="text-xl md:text-2xl font-semibold text-center mb-6">
                        Join a Room
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Mail size={20} className="text-gray-400" />
                                    </div>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Enter your email"
                                        className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Room ID
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Key size={20} className="text-gray-400" />
                                    </div>
                                    <input
                                        type="text"
                                        value={roomId}
                                        onChange={(e) => setRoomId(e.target.value)}
                                        placeholder="Enter room ID"
                                        className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors text-white"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors font-medium"
                        >
                            <LogIn size={20} />
                            Join Room
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Lobby;