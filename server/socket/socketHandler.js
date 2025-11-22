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
        // Join user to their role room
        socket.on("join-role", (role) => {
            socket.join(role);
        });

        // Join specific rooms
        socket.on("join-room", (room) => {
            socket.join(room);
        });

        // Session events
        socket.on("session-started", (data) => {
            socket.broadcast.emit("session-update", {
                type: "started",
                session: data,
            });
        });

        socket.on("session-ended", (data) => {
            socket.broadcast.emit("session-update", {
                type: "ended",
                session: data,
            });
        });

        socket.on("session-paused", (data) => {
            socket.broadcast.emit("session-update", {
                type: "paused",
                session: data,
            });
        });

        socket.on("controllers-changed", (data) => {
            socket.broadcast.emit("session-update", {
                type: "controllers-changed",
                session: data,
            });
        });

        // Order events
        socket.on("order-created", (data) => {
            // Notify kitchen staff
            io.to("kitchen").emit("new-order", data);
            // Notify all staff
            socket.broadcast.emit("order-update", {
                type: "created",
                order: data,
            });
        });

        socket.on("order-status-changed", (data) => {
            socket.broadcast.emit("order-update", {
                type: "status-changed",
                order: data,
            });

            // Send specific notifications based on status
            if (data.status === "ready") {
                io.to("staff").emit("order-ready", data);
            }
        });

        // Inventory events
        socket.on("inventory-low-stock", (data) => {
            io.to("admin").emit("low-stock-alert", data);
        });

        socket.on("inventory-updated", (data) => {
            socket.broadcast.emit("inventory-update", data);
        });

        // Bill events
        socket.on("bill-created", (data) => {
            socket.broadcast.emit("bill-update", {
                type: "created",
                bill: data,
            });
        });

        socket.on("payment-received", (data) => {
            socket.broadcast.emit("bill-update", {
                type: "payment-received",
                bill: data,
            });
        });

        // System notifications
        socket.on("system-notification", (data) => {
            io.emit("notification", data);
        });

        // Disconnect event
        socket.on("disconnect", () => {});
    });

    // Helper functions to emit events from controllers
    io.notifySessionUpdate = (type, session) => {
        io.emit("session-update", { type, session });
    };

    io.notifyOrderUpdate = (type, order) => {
        io.emit("order-update", { type, order });

        if (type === "created") {
            io.to("kitchen").emit("new-order", order);
        } else if (order.status === "ready") {
            io.to("staff").emit("order-ready", order);
        }
    };

    io.notifyInventoryUpdate = (item) => {
        io.emit("inventory-update", item);

        if (item.isLowStock) {
            io.to("admin").emit("low-stock-alert", item);
        }
    };

    io.notifyBillUpdate = (type, bill) => {
        io.emit("bill-update", { type, bill });
    };

    io.sendNotification = (message, type = "info", targetRole = null) => {
        const notification = {
            message,
            type,
            timestamp: new Date(),
        };

        if (targetRole) {
            io.to(targetRole).emit("notification", notification);
        } else {
            io.emit("notification", notification);
        }
    };

    // Debounced table status update to reduce event frequency
    io.notifyTableStatusUpdate = getDebouncedEmitter("table-status-update");
};
