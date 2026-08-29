// Debounce utility function
const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
};

// Create debounced emitters with 100ms delay
const createDebouncedEmitters = (io) => {
    const debouncedEmitters = new Map();
    
    const getDebouncedEmitter = (eventName) => {
        if (!debouncedEmitters.has(eventName)) {
            debouncedEmitters.set(
                eventName,
                debounce((data) => {
                    io.emit(eventName, data);
                }, 100)
            );
        }
        return debouncedEmitters.get(eventName);
    };
    
    return getDebouncedEmitter;
};

export const setupSocketIO = (io) => {
    // Initialize debounced emitters
    const getDebouncedEmitter = createDebouncedEmitters(io);
    
    io.on("connection", (socket) => {
        const userRole = socket.data.role;
        const userOrg = socket.data.organization;
        
        // Auto-join organization room
        if (userOrg) {
            socket.join(`org-${userOrg}`);
        }
        
        // Join user to their role room — only if role matches actual JWT role
        socket.on("join-role", (role) => {
            if (role === userRole || (role === "admin" && userRole === "admin")) {
                socket.join(role);
            }
        });

        // Join specific rooms
        socket.on("join-room", (room) => {
            socket.join(room);
        });

        // Session events — scoped to organization
        socket.on("session-started", (data) => {
            socket.to(`org-${userOrg}`).emit("session-update", {
                type: "started",
                session: data,
            });
        });

        socket.on("session-ended", (data) => {
            socket.to(`org-${userOrg}`).emit("session-update", {
                type: "ended",
                session: data,
            });
        });

        socket.on("session-paused", (data) => {
            socket.to(`org-${userOrg}`).emit("session-update", {
                type: "paused",
                session: data,
            });
        });

        socket.on("controllers-changed", (data) => {
            socket.to(`org-${userOrg}`).emit("session-update", {
                type: "controllers-changed",
                session: data,
            });
        });

        // Order events — scoped to organization
        socket.on("order-created", (data) => {
            io.to(`org-${userOrg}`).emit("new-order", data);
            socket.to(`org-${userOrg}`).emit("order-update", {
                type: "created",
                order: data,
            });
        });

        socket.on("order-status-changed", (data) => {
            socket.to(`org-${userOrg}`).emit("order-update", {
                type: "status-changed",
                order: data,
            });

            if (data.status === "ready") {
                io.to(`org-${userOrg}`).emit("order-ready", data);
            }
        });

        // Inventory events — scoped to organization
        socket.on("inventory-low-stock", (data) => {
            io.to(`org-${userOrg}`).emit("low-stock-alert", data);
        });

        socket.on("inventory-updated", (data) => {
            socket.to(`org-${userOrg}`).emit("inventory-update", data);
        });

        // Bill events — scoped to organization
        socket.on("bill-created", (data) => {
            socket.to(`org-${userOrg}`).emit("bill-update", {
                type: "created",
                bill: data,
            });
        });

        socket.on("payment-received", (data) => {
            socket.to(`org-${userOrg}`).emit("bill-update", {
                type: "payment-received",
                bill: data,
            });
        });

        // System notifications — scoped to organization
        socket.on("system-notification", (data) => {
            io.to(`org-${userOrg}`).emit("notification", data);
        });

        // Disconnect event
        socket.on("disconnect", () => {
        });
    });

    // Helper: normalize organizationId (may be ObjectId or populated object)
    const normalizeOrg = (orgId) => {
        if (!orgId) return undefined;
        if (typeof orgId === 'object' && orgId._id) return String(orgId._id);
        return String(orgId);
    };
    // Helper functions to emit events from controllers — scoped by organizationId
    io.notifySessionUpdate = (type, session, organizationId) => {
        const org = normalizeOrg(organizationId);
        const target = org ? `org-${org}` : undefined;
        if (target) io.to(target).emit("session-update", { type, session });
        else io.emit("session-update", { type, session });
    };

    io.notifyOrderUpdate = (type, order, organizationId) => {
        const org = normalizeOrg(organizationId);
        const target = org ? `org-${org}` : undefined;
        const emit = (event, data) => target ? io.to(target).emit(event, data) : io.emit(event, data);
        emit("order-update", { type, order });

        if (type === "created") {
            emit("new-order", order);
        } else if (order.status === "ready") {
            emit("order-ready", order);
        }
    };

    io.notifyInventoryUpdate = (item, organizationId) => {
        const org = normalizeOrg(organizationId);
        const target = org ? `org-${org}` : undefined;
        const emit = (event, data) => target ? io.to(target).emit(event, data) : io.emit(event, data);
        emit("inventory-update", item);

        if (item.isLowStock) {
            emit("low-stock-alert", item);
        }
    };

    io.notifyBillUpdate = (type, bill, organizationId) => {
        const org = normalizeOrg(organizationId);
        const target = org ? `org-${org}` : undefined;
        if (target) io.to(target).emit("bill-update", { type, bill });
        else io.emit("bill-update", { type, bill });
    };

    io.sendNotification = (message, type = "info", targetRole = null, organizationId = null) => {
        const notification = {
            message,
            type,
            timestamp: new Date(),
        };

        if (targetRole && organizationId) {
            io.to(`org-${organizationId}`).emit("notification", notification);
        } else {
            io.emit("notification", notification);
        }
    };

    // Debounced table status update to reduce event frequency
    io.notifyTableStatusUpdate = (data, organizationId) => {
        const org = normalizeOrg(organizationId);
        const target = org ? `org-${org}` : undefined;
        if (target) io.to(target).emit("table-status-update", data);
        else io.emit("table-status-update", data);
    };

    // ── Generic real-time sync for remaining schemas (ثانوية — لحظية) ──────
    io.notifyMenuUpdate = (type, item, organizationId) => {
        const org = normalizeOrg(organizationId);
        const target = org ? `org-${org}` : undefined;
        if (target) io.to(target).emit("menu-update", { type, item });
        else io.emit("menu-update", { type, item });
    };
    io.notifyCostUpdate = (type, cost, organizationId) => {
        const org = normalizeOrg(organizationId);
        const target = org ? `org-${org}` : undefined;
        if (target) io.to(target).emit("cost-update", { type, cost });
        else io.emit("cost-update", { type, cost });
    };
    io.notifyDeviceUpdate = (type, device, organizationId) => {
        const org = normalizeOrg(organizationId);
        const target = org ? `org-${org}` : undefined;
        if (target) io.to(target).emit("device-update", { type, device });
        else io.emit("device-update", { type, device });
    };
    io.notifyTableUpdate = (type, table, organizationId) => {
        const org = normalizeOrg(organizationId);
        const target = org ? `org-${org}` : undefined;
        if (target) io.to(target).emit("table-update", { type, table });
        else io.emit("table-update", { type, table });
    };
    io.notifyTableSectionUpdate = (type, section, organizationId) => {
        const org = normalizeOrg(organizationId);
        const target = org ? `org-${org}` : undefined;
        if (target) io.to(target).emit("table-section-update", { type, section });
        else io.emit("table-section-update", { type, section });
    };
    io.notifySettingsUpdate = (settings, organizationId) => {
        const org = normalizeOrg(organizationId);
        const target = org ? `org-${org}` : undefined;
        if (target) io.to(target).emit("settings-update", settings);
        else io.emit("settings-update", settings);
    };
};
