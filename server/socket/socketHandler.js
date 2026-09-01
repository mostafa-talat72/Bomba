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
        
        // Auto-join organization room (support both dash and colon for compatibility)
        if (userOrg) {
            socket.join(`org-${userOrg}`);
            socket.join(`org:${userOrg}`);
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
    // emit to both dash and colon rooms and support both hyphen and colon event names for instant <100ms sync
    const emitToOrgBothRooms = (event, data, org) => {
        const dashRoom = org ? `org-${org}` : null;
        const colonRoom = org ? `org:${org}` : null;
        if (dashRoom) {
            io.to(dashRoom).emit(event, data);
            io.to(colonRoom).emit(event, data);
        } else {
            io.emit(event, data);
        }
    };
    io.notifySessionUpdate = (type, session, organizationId) => {
        const org = normalizeOrg(organizationId);
        const targetDash = org ? `org-${org}` : undefined;
        const targetColon = org ? `org:${org}` : undefined;
        const doEmit = (event, data) => {
            if (org) { io.to(targetDash).emit(event, data); io.to(targetColon).emit(event, data); }
            else io.emit(event, data);
        };
        doEmit("session-update", { type, session });
        // colon-style for instant frontend listeners
        doEmit("session:updated", session);
        if (type === "started") doEmit("session:created", session);
        if (type === "ended") doEmit("session:ended", session);
    };

    io.notifyOrderUpdate = (type, order, organizationId) => {
        const org = normalizeOrg(organizationId);
        const targetDash = org ? `org-${org}` : undefined;
        const targetColon = org ? `org:${org}` : undefined;
        const emit = (event, data) => {
            if (org) { io.to(targetDash).emit(event, data); io.to(targetColon).emit(event, data); }
            else io.emit(event, data);
        };
        emit("order-update", { type, order });

        // colon-style instant events
        if (type === "created") {
            emit("order:created", order);
        } else if (type === "deleted") {
            emit("order:deleted", { _id: order._id || order.id });
        } else {
            emit("order:updated", order);
        }

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
        const targetDash = org ? `org-${org}` : undefined;
        const targetColon = org ? `org:${org}` : undefined;
        const doEmit = (event, data) => {
            if (org) { io.to(targetDash).emit(event, data); io.to(targetColon).emit(event, data); }
            else io.emit(event, data);
        };
        doEmit("bill-update", { type, bill });
        // colon-style instant
        doEmit("bill:updated", bill);
        doEmit("bill:created", bill);
        // also emit payment-specific for compatibility
        if (type === "payment-received" || type === "partial-payment" || type === "paid") {
            doEmit("payment-received", { bill, type });
            doEmit("partial-payment-received", { bill, type });
        }
        // if bill has table, also emit table status change
        if (bill && bill.table) {
            const tid = bill.table._id || bill.table.id || bill.table;
            if (tid) {
                const newStatus = (bill.status === 'paid' || bill.status === 'cancelled') ? 'empty' : 'occupied';
                doEmit("table-status-update", { tableId: tid, status: newStatus });
                doEmit("table:statusChanged", { tableId: tid, status: newStatus });
            }
        }
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

    // Table status update — instant, scoped, emits both hyphen and colon events to dash & colon rooms
    io.notifyTableStatusUpdate = (data, organizationId) => {
        const org = normalizeOrg(organizationId);
        const targetDash = org ? `org-${org}` : undefined;
        const targetColon = org ? `org:${org}` : undefined;
        const doEmit = (event, payload) => {
            if (org) { io.to(targetDash).emit(event, payload); io.to(targetColon).emit(event, payload); }
            else io.emit(event, payload);
        };
        doEmit("table-status-update", data);
        doEmit("table:statusChanged", data);
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
        const targetDash = org ? `org-${org}` : undefined;
        const targetColon = org ? `org:${org}` : undefined;
        const doEmit = (event, payload) => {
            if (org) { io.to(targetDash).emit(event, payload); io.to(targetColon).emit(event, payload); }
            else io.emit(event, payload);
        };
        doEmit("table-update", { type, table });
        // colon-style
        if (type === "created") doEmit("table:created", table);
        else if (type === "updated") doEmit("table:updated", table);
        else if (type === "deleted") doEmit("table:deleted", { _id: (table && (table._id || table.id)) || table });
        // generic table:updated for all mutations
        doEmit("table:updated", table);
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
