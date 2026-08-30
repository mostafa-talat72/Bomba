import dgram from "dgram";
import os from "os";
import { EventEmitter } from "events";
import { getDeviceId, getDeviceInfo } from "../../utils/deviceIdentity.js";
import syncConfig from "../../config/syncConfig.js";
import Logger from "../../middleware/logger.js";

const DEFAULT_PORT = 41234;

function getLocalIP() {
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
        for (const iface of ifaces[name] || []) {
            if (iface.family === "IPv4" && !iface.internal) return iface.address;
        }
    }
    return "127.0.0.1";
}

function getBroadcastAddresses() {
    const ifaces = os.networkInterfaces();
    const addrs = new Set(["255.255.255.255"]);
    for (const name of Object.keys(ifaces)) {
        for (const iface of ifaces[name] || []) {
            if (iface.family === "IPv4" && !iface.internal) {
                const parts = iface.address.split(".").map(Number);
                const maskParts = (iface.netmask || "255.255.255.0").split(".").map(Number);
                const bcast = parts.map((p, i) => (p | (~maskParts[i] & 255))).join(".");
                addrs.add(bcast);
            }
        }
    }
    // also use configured broadcast
    if (syncConfig.lanSync?.broadcastAddress) addrs.add(syncConfig.lanSync.broadcastAddress);
    return [...addrs];
}

class LanDiscovery extends EventEmitter {
    constructor() {
        super();
        this.deviceId = getDeviceId();
        this.hostname = os.hostname();
        this.localIP = getLocalIP();
        this.port = syncConfig.lanSync?.syncPort || parseInt(process.env.PORT || "5000", 10);
        this.discoveryPort = syncConfig.lanSync?.discoveryPort || DEFAULT_PORT;
        this.heartbeatIntervalMs = syncConfig.lanSync?.heartbeatInterval || 3000;
        this.electionTimeoutMs = syncConfig.lanSync?.electionTimeout || 10000;

        this.socket = null;
        this.role = "searching"; // searching | primary | secondary
        this.primaryInfo = null; // { deviceId, address, port, hostname, lastSeen }
        this.peers = new Map(); // deviceId -> { deviceId, address, port, hostname, lastSeen, role }
        this.heartbeatTimer = null;
        this.electionTimer = null;
        this.announceTimer = null;
        this.isRunning = false;
        this.electionInProgress = false;
        this.electionCandidates = new Map();
        this.electionCollectTimer = null;
    }

    async start() {
        if (this.isRunning) return;
        if (!syncConfig.lanSync?.enabled) {
            Logger.info("[LanDiscovery] LAN sync disabled, skipping discovery");
            return;
        }
        this.isRunning = true;
        Logger.info(`[LanDiscovery] Starting discovery deviceId=${this.deviceId} ip=${this.localIP} port=${this.port} dPort=${this.discoveryPort}`);

        this.socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

        this.socket.on("error", (err) => {
            Logger.error("[LanDiscovery] socket error:", err.message);
        });

        this.socket.on("message", (msg, rinfo) => {
            try {
                const data = JSON.parse(msg.toString());
                if (data.deviceId === this.deviceId) return; // ignore self
                this.handleMessage(data, rinfo);
            } catch {}
        });

        await new Promise((resolve, reject) => {
            this.socket.bind(this.discoveryPort, () => {
                try {
                    this.socket.setBroadcast(true);
                    this.socket.setMulticastTTL(128);
                    // Try multicast join for 224.0.0.251
                    try { this.socket.addMembership("224.0.0.251"); } catch {}
                } catch {}
                resolve();
            });
            this.socket.once("error", reject);
        });

        Logger.info(`[LanDiscovery] UDP bound on ${this.discoveryPort}`);

        // Start discovery phase
        await this.discoverPrimary();
    }

    async discoverPrimary() {
        this.role = "searching";
        this.primaryInfo = null;
        Logger.info("[LanDiscovery] Discovering primary...");

        // Send DISCOVER 3 times
        for (let i = 0; i < 3; i++) {
            this.broadcast({ type: "DISCOVER", deviceId: this.deviceId, hostname: this.hostname, address: this.localIP, port: this.port, timestamp: Date.now() });
            await new Promise(r => setTimeout(r, 500));
            if (this.primaryInfo) break;
        }

        // Wait a bit for ANNOUNCE response
        await new Promise(r => setTimeout(r, 1000));

        if (this.primaryInfo && this.primaryInfo.deviceId !== this.deviceId) {
            // Found primary -> become secondary
            this.becomeSecondary(this.primaryInfo);
        } else {
            // No primary -> become primary
            this.becomePrimary();
        }
    }

    becomePrimary() {
        if (this.role === "primary") return;
        this.role = "primary";
        this.primaryInfo = { deviceId: this.deviceId, address: this.localIP, port: this.port, hostname: this.hostname, lastSeen: Date.now() };
        Logger.info(`[LanDiscovery] 🏆 Became PRIMARY deviceId=${this.deviceId}`);
        this.emit("became-primary", { deviceId: this.deviceId, address: this.localIP, port: this.port });

        // Announce immediately and periodically
        this.broadcast({ type: "ANNOUNCE_PRIMARY", deviceId: this.deviceId, hostname: this.hostname, address: this.localIP, port: this.port, timestamp: Date.now() });
        this.broadcast({ type: "COORDINATOR", deviceId: this.deviceId, hostname: this.hostname, address: this.localIP, port: this.port, timestamp: Date.now() });

        if (this.announceTimer) clearInterval(this.announceTimer);
        this.announceTimer = setInterval(() => {
            this.broadcast({ type: "ANNOUNCE_PRIMARY", deviceId: this.deviceId, hostname: this.hostname, address: this.localIP, port: this.port, timestamp: Date.now() });
        }, 5000);
        if (this.announceTimer.unref) this.announceTimer.unref();

        this.startHeartbeat();
        this.startElectionTimeout(); // even primary monitors for split-brain
    }

    becomeSecondary(primaryInfo) {
        const wasPrimary = this.role === "primary";
        this.role = "secondary";
        this.primaryInfo = { ...primaryInfo, lastSeen: Date.now() };
        this.peers.set(primaryInfo.deviceId, { ...primaryInfo, lastSeen: Date.now(), role: "primary" });
        Logger.info(`[LanDiscovery] Became SECONDARY -> primary ${primaryInfo.deviceId} @ ${primaryInfo.address}:${primaryInfo.port}`);
        if (wasPrimary) {
            if (this.announceTimer) { clearInterval(this.announceTimer); this.announceTimer = null; }
            if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
        }
        this.emit("became-secondary", this.primaryInfo);
        this.startHeartbeatCheck();
        this.startElectionTimeout();
    }

    startHeartbeat() {
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(() => {
            if (this.role === "primary") {
                this.broadcast({ type: "HEARTBEAT", deviceId: this.deviceId, hostname: this.hostname, address: this.localIP, port: this.port, timestamp: Date.now() });
            }
        }, this.heartbeatIntervalMs);
        if (this.heartbeatTimer.unref) this.heartbeatTimer.unref();
    }

    startHeartbeatCheck() {
        // Secondary checks primary heartbeat; if timeout -> election
        // Handled via electionTimeout periodic check below
    }

    startElectionTimeout() {
        if (this.electionTimer) clearInterval(this.electionTimer);
        this.electionTimer = setInterval(() => {
            if (this.role === "secondary" && this.primaryInfo) {
                const since = Date.now() - (this.primaryInfo.lastSeen || 0);
                if (since > this.electionTimeoutMs) {
                    Logger.warn(`[LanDiscovery] Primary heartbeat timeout (${since}ms) -> starting election`);
                    this.emit("primary-lost", this.primaryInfo);
                    this.startElection();
                }
            }
            // Primary also checks for split-brain: if we see another primary with smaller deviceId, step down
            // This is handled in handleMessage when receiving another primary's heartbeat/announce

            // Cleanup stale peers
            const now = Date.now();
            for (const [id, p] of this.peers.entries()) {
                if (now - p.lastSeen > this.electionTimeoutMs * 2) {
                    this.peers.delete(id);
                }
            }
        }, 3000);
        if (this.electionTimer.unref) this.electionTimer.unref();
    }

    startElection() {
        if (this.electionInProgress) return;
        this.electionInProgress = true;
        this.electionCandidates.clear();
        this.electionCandidates.set(this.deviceId, { deviceId: this.deviceId, address: this.localIP, port: this.port, hostname: this.hostname });

        Logger.info(`[LanDiscovery] 🗳️ Starting election deviceId=${this.deviceId}`);

        // Broadcast ELECTION
        this.broadcast({ type: "ELECTION", deviceId: this.deviceId, hostname: this.hostname, address: this.localIP, port: this.port, timestamp: Date.now() });

        // Collect candidates for 2s then decide winner (smallest deviceId)
        if (this.electionCollectTimer) clearTimeout(this.electionCollectTimer);
        this.electionCollectTimer = setTimeout(() => {
            this.finishElection();
        }, 2500);
        if (this.electionCollectTimer.unref) this.electionCollectTimer.unref();
    }

    finishElection() {
        const candidates = [...this.electionCandidates.values()];
        candidates.sort((a, b) => a.deviceId.localeCompare(b.deviceId));
        const winner = candidates[0];
        Logger.info(`[LanDiscovery] Election candidates: ${candidates.map(c => c.deviceId).join(", ")} -> winner ${winner.deviceId}`);

        this.electionInProgress = false;
        this.electionCandidates.clear();

        if (winner.deviceId === this.deviceId) {
            Logger.info(`[LanDiscovery] 🏆 Won election -> becoming PRIMARY`);
            this.becomePrimary();
            this.broadcast({ type: "COORDINATOR", deviceId: this.deviceId, hostname: this.hostname, address: this.localIP, port: this.port, timestamp: Date.now() });
            this.emit("election-won", winner);
        } else {
            Logger.info(`[LanDiscovery] Lost election -> primary is ${winner.deviceId}`);
            this.becomeSecondary(winner);
            this.emit("election-lost", winner);
        }
    }

    handleMessage(data, rinfo) {
        const addr = data.address || rinfo.address;
        const port = data.port || this.port;
        const deviceId = data.deviceId;

        // Update peer
        if (deviceId) {
            this.peers.set(deviceId, { deviceId, address: addr, port, hostname: data.hostname || "unknown", lastSeen: Date.now(), role: data.type === "HEARTBEAT" || data.type === "ANNOUNCE_PRIMARY" || data.type === "COORDINATOR" ? "primary" : "secondary" });
        }

        switch (data.type) {
            case "DISCOVER": {
                // If we are primary, respond
                if (this.role === "primary") {
                    this.sendTo({ type: "ANNOUNCE_PRIMARY", deviceId: this.deviceId, hostname: this.hostname, address: this.localIP, port: this.port, timestamp: Date.now() }, rinfo.address, rinfo.port);
                }
                break;
            }
            case "ANNOUNCE_PRIMARY":
            case "COORDINATOR": {
                // Someone claims to be primary
                if (this.role === "searching") {
                    // During discovery, remember primary
                    this.primaryInfo = { deviceId, address: addr, port, hostname: data.hostname, lastSeen: Date.now() };
                } else if (this.role === "secondary") {
                    // Update primary info and refresh heartbeat timer
                    if (!this.primaryInfo || this.primaryInfo.deviceId === deviceId) {
                        this.primaryInfo = { deviceId, address: addr, port, hostname: data.hostname, lastSeen: Date.now() };
                    } else {
                        // Another primary appeared -> split-brain resolution
                        const winner = [this.primaryInfo.deviceId, deviceId].sort()[0];
                        if (winner !== this.primaryInfo.deviceId) {
                            Logger.warn(`[LanDiscovery] Split-brain detected, switching primary to ${deviceId}`);
                            this.primaryInfo = { deviceId, address: addr, port, hostname: data.hostname, lastSeen: Date.now() };
                            this.emit("primary-changed", this.primaryInfo);
                        }
                    }
                } else if (this.role === "primary" && deviceId !== this.deviceId) {
                    // Two primaries -> smaller deviceId wins
                    const winner = [this.deviceId, deviceId].sort()[0];
                    if (winner !== this.deviceId) {
                        Logger.warn(`[LanDiscovery] Split-brain primary conflict: ${deviceId} wins, stepping down`);
                        this.becomeSecondary({ deviceId, address: addr, port, hostname: data.hostname, lastSeen: Date.now() });
                    } else {
                        Logger.warn(`[LanDiscovery] Split-brain: we win over ${deviceId}, staying primary`);
                    }
                }
                break;
            }
            case "HEARTBEAT": {
                if (this.role === "secondary" && this.primaryInfo && this.primaryInfo.deviceId === deviceId) {
                    this.primaryInfo.lastSeen = Date.now();
                    this.primaryInfo.address = addr;
                    this.primaryInfo.port = port;
                } else if (this.role === "searching") {
                    this.primaryInfo = { deviceId, address: addr, port, hostname: data.hostname, lastSeen: Date.now() };
                } else if (this.role === "primary" && deviceId !== this.deviceId) {
                    // Another primary heartbeat -> split-brain
                    const winner = [this.deviceId, deviceId].sort()[0];
                    if (winner !== this.deviceId) {
                        Logger.warn(`[LanDiscovery] Heartbeat split-brain, stepping down`);
                        this.becomeSecondary({ deviceId, address: addr, port, hostname: data.hostname, lastSeen: Date.now() });
                    }
                }
                // For secondary discovery during election, record heartbeat as candidate
                if (this.electionInProgress) {
                    this.electionCandidates.set(deviceId, { deviceId, address: addr, port, hostname: data.hostname });
                }
                break;
            }
            case "ELECTION": {
                // Another device started election -> participate
                this.electionCandidates.set(deviceId, { deviceId, address: addr, port, hostname: data.hostname });
                if (!this.electionInProgress) {
                    // Join election
                    this.electionInProgress = true;
                    this.electionCandidates.set(this.deviceId, { deviceId: this.deviceId, address: this.localIP, port: this.port, hostname: this.hostname });
                    this.broadcast({ type: "ELECTION", deviceId: this.deviceId, hostname: this.hostname, address: this.localIP, port: this.port, timestamp: Date.now() });
                    if (this.electionCollectTimer) clearTimeout(this.electionCollectTimer);
                    this.electionCollectTimer = setTimeout(() => this.finishElection(), 2500);
                    if (this.electionCollectTimer.unref) this.electionCollectTimer.unref();
                } else {
                    // Already in election, just add candidate
                }
                break;
            }
            case "COORDINATOR": {
                // Election finished by another device
                if (this.electionInProgress) {
                    // Cancel our election and accept winner
                    if (this.electionCollectTimer) clearTimeout(this.electionCollectTimer);
                    this.electionInProgress = false;
                    this.electionCandidates.clear();
                    if (deviceId === this.deviceId) {
                        this.becomePrimary();
                    } else {
                        this.becomeSecondary({ deviceId, address: addr, port, hostname: data.hostname, lastSeen: Date.now() });
                    }
                } else if (this.role !== "primary" || deviceId !== this.deviceId) {
                    // Accept coordinator if we are secondary/searching
                    if (this.role === "searching" || this.role === "secondary") {
                        // If coordinator is not our current primary, switch
                        if (!this.primaryInfo || this.primaryInfo.deviceId !== deviceId) {
                            this.primaryInfo = { deviceId, address: addr, port, hostname: data.hostname, lastSeen: Date.now() };
                            if (this.role !== "secondary") this.becomeSecondary(this.primaryInfo);
                            else {
                                this.primaryInfo.lastSeen = Date.now();
                                this.emit("primary-changed", this.primaryInfo);
                            }
                        }
                    }
                }
                break;
            }
        }
    }

    broadcast(obj) {
        if (!this.socket) return;
        const msg = Buffer.from(JSON.stringify(obj));
        const bcasts = getBroadcastAddresses();
        for (const addr of bcasts) {
            try {
                this.socket.send(msg, 0, msg.length, this.discoveryPort, addr, (err) => {
                    if (err) Logger.warn(`[LanDiscovery] broadcast to ${addr} failed: ${err.message}`);
                });
            } catch (e) {
                Logger.warn(`[LanDiscovery] broadcast error: ${e.message}`);
            }
        }
    }

    sendTo(obj, address, port) {
        if (!this.socket) return;
        const msg = Buffer.from(JSON.stringify(obj));
        this.socket.send(msg, 0, msg.length, port, address, () => {});
    }

    getStatus() {
        return {
            enabled: !!syncConfig.lanSync?.enabled,
            deviceId: this.deviceId,
            role: this.role,
            localIP: this.localIP,
            port: this.port,
            primary: this.primaryInfo,
            peers: [...this.peers.values()],
            electionInProgress: this.electionInProgress,
        };
    }

    async stop() {
        this.isRunning = false;
        if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
        if (this.electionTimer) { clearInterval(this.electionTimer); this.electionTimer = null; }
        if (this.announceTimer) { clearInterval(this.announceTimer); this.announceTimer = null; }
        if (this.electionCollectTimer) { clearTimeout(this.electionCollectTimer); this.electionCollectTimer = null; }
        if (this.socket) {
            try { this.socket.close(); } catch {}
            this.socket = null;
        }
        Logger.info("[LanDiscovery] Stopped");
    }
}

const lanDiscovery = new LanDiscovery();
export default lanDiscovery;
