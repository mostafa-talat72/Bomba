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

    // Helper functions to emit events from controllers — scoped by organizationId
    io.notifySessionUpdate = (type, session, organizationId) => {
        const target = organizationId ? `org-${organizationId}` : undefined;
        io.to(target).emit("session-update", { type, session });
    };

    io.notifyOrderUpdate = (type, order, organizationId) => {
        const target = organizationId ? `org-${organizationId}` : undefined;
        io.to(target).emit("order-update", { type, order });

        if (type === "created") {
            io.to(target).emit("new-order", order);
        } else if (order.status === "ready") {
            io.to(target).emit("order-ready", order);
        }
    };

    io.notifyInventoryUpdate = (item, organizationId) => {
        const target = organizationId ? `org-${organizationId}` : undefined;
        io.to(target).emit("inventory-update", item);

        if (item.isLowStock) {
            io.to(target).emit("low-stock-alert", item);
        }
    };

    io.notifyBillUpdate = (type, bill, organizationId) => {
        const target = organizationId ? `org-${organizationId}` : undefined;
        io.to(target).emit("bill-update", { type, bill });
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
        const target = organizationId ? `org-${organizationId}` : undefined;
        io.to(target).emit("table-status-update", data);
    };
};
