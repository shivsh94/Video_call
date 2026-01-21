class PeerService {
    constructor() {
        this.peers = new Map(); // Store multiple peer connections
    }

    createPeer(userId) {
        if (!this.peers.has(userId)) {
            const peer = new RTCPeerConnection({
                iceServers: [
                    {
                        urls: [
                            'stun:stun.l.google.com:19302',
                            'stun:global.stun.twilio.com:3478',
                        ],
                    },
                ]
            });
            this.peers.set(userId, peer);
        }
        return this.peers.get(userId);
    }

    getPeer(userId) {
        return this.peers.get(userId);
    }

    removePeer(userId) {
        const peer = this.peers.get(userId);
        if (peer) {
            peer.close();
            this.peers.delete(userId);
        }
    }

    async getAnswer(userId, offer) {
        const peer = this.createPeer(userId);
        await peer.setRemoteDescription(offer);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        return answer;
    }

    async setRemoteDescription(userId, answer) {
        const peer = this.getPeer(userId);
        if (peer) {
            await peer.setRemoteDescription(new RTCSessionDescription(answer));
        }
    }

    async getOffer(userId) {
        const peer = this.createPeer(userId);
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        return offer;
    }

    addTrack(userId, track, stream) {
        const peer = this.getPeer(userId);
        if (peer) {
            peer.addTrack(track, stream);
        }
    }
}

export default new PeerService();