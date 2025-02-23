import React from 'react';
import Lobby from '../screens/Lobby.jsx';

const Home = () => {
    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center p-4">
            <div className='w-full h-full flex justify-center items-center'>
                <Lobby />
            </div>
        </div>
    );
}

export default Home;
