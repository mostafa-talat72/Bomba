import mongoose from "mongoose";

/**
 * Return an organization's id regardless of whether the value is an ObjectId,
 * a populated document, or a string from an older request/session.
 *
 * Keeping this conversion at the request boundary prevents queries from
 * accidentally receiving a populated organization object.
 */
export function getOrganizationId(value) {
    const organization = value?.user?.organization ?? value?.organization ?? value;
    const id = organization?._id ?? organization;

    if (id == null || id === "") return null;
    if (id instanceof mongoose.Types.ObjectId) return id;

    const stringId = String(id);
    return mongoose.isValidObjectId(stringId)
        ? new mongoose.Types.ObjectId(stringId)
        : stringId;
}

/**
 * Match both the canonical ObjectId representation and legacy documents that
 * stored the same organization id as a string. The $expr branch is deliberate:
 * Mongoose otherwise casts string values in $or/$in filters to ObjectIds.
 */
export function organizationFilter(value, field = "organization") {
    const id = getOrganizationId(value);
    if (id == null) return { $expr: { $eq: [1, 0] } };

    const stringId = String(id);
    return {
        // Nest the $or so callers can safely add their own $or search clause.
        $and: [{
            $or: [
                { [field]: id },
                { $expr: { $eq: [{ $toString: `$${field}` }, stringId] } },
            ],
        }],
    };
}

export const organizationQuery = organizationFilter;

export function sameObjectId(left, right) {
    const leftId = getOrganizationId(left);
    const rightId = getOrganizationId(right);
    return leftId != null && rightId != null && String(leftId) === String(rightId);
}

export function resolvePrintSettings(organization, fallback = {}) {
    const source = organization && typeof organization === 'object' ? organization : {};
    const settings = { ...(source.printSettings || {}), ...fallback };
    const preferredPrinter = Array.isArray(source.devicePrinters)
        ? [...source.devicePrinters]
            .filter((entry) => entry && (entry.printerPath || entry.printerName))
            .sort((a, b) => new Date(b.lastUsed || 0).getTime() - new Date(a.lastUsed || 0).getTime())[0]
        : null;

    if (preferredPrinter) {
        settings.printerType = settings.printerType || 'usb';
        settings.printerDevice = settings.printerDevice || preferredPrinter.printerPath || '';
        settings.printerName = settings.printerName || preferredPrinter.printerName || '';
        if (preferredPrinter.printerPath && !settings.printerDevice) {
            settings.printerDevice = preferredPrinter.printerPath;
        }
        if (preferredPrinter.printerName && !settings.printerName) {
            settings.printerName = preferredPrinter.printerName;
        }
    }

    return settings;
}

function isObjectIdValue(value) {
    return value instanceof mongoose.Types.ObjectId ||
        (typeof value === "string" && mongoose.isValidObjectId(value));
}

function mixedIdentifierCondition(field, value) {
    const values = Array.isArray(value) ? value.filter(isObjectIdValue) : [value];
    if (!values.length) return null;

    const objectIds = values.map((item) =>
        item instanceof mongoose.Types.ObjectId
            ? item
            : new mongoose.Types.ObjectId(String(item))
    );
    const strings = values.map(String);

    return {
        $or: [
            { [field]: { $in: objectIds } },
            { $expr: { $in: [{ $toString: `$${field}` }, strings] } },
        ],
    };
}

function transformMixedIdentifierFilter(filter) {
    if (!filter || typeof filter !== "object" || Array.isArray(filter)) {
        return filter;
    }

    const clauses = [];
    for (const [key, value] of Object.entries(filter)) {
        if (key === "$expr" || key === "$where" || key === "$text") {
            clauses.push({ [key]: value });
            continue;
        }

        if (key === "$or" || key === "$and" || key === "$nor") {
            clauses.push({
                [key]: Array.isArray(value)
                    ? value.map(transformMixedIdentifierFilter)
                    : value,
            });
            continue;
        }

        if (key.startsWith("$")) {
            clauses.push({ [key]: value });
            continue;
        }

        if (isObjectIdValue(value)) {
            clauses.push(mixedIdentifierCondition(key, value));
            continue;
        }

        if (Array.isArray(value) && value.some(isObjectIdValue)) {
            const mixedCondition = mixedIdentifierCondition(key, value);
            const remainingValues = value.filter((item) => !isObjectIdValue(item));
            clauses.push(
                remainingValues.length
                    ? { $or: [mixedCondition, { [key]: { $in: remainingValues } }] }
                    : mixedCondition
            );
            continue;
        }

        if (value && typeof value === "object" && !Array.isArray(value)) {
            const operatorClauses = [];
            for (const [operator, operand] of Object.entries(value)) {
                if ((operator === "$eq" || operator === "$ne") &&
                    isObjectIdValue(operand)) {
                    const condition = mixedIdentifierCondition(key, operand);
                    operatorClauses.push(
                        operator === "$eq" ? condition : { $nor: [condition] }
                    );
                } else if ((operator === "$in" || operator === "$nin") &&
                    Array.isArray(operand) &&
                    operand.some(isObjectIdValue)) {
                    const condition = mixedIdentifierCondition(key, operand);
                    const remainingValues = operand.filter((item) => !isObjectIdValue(item));
                    if (operator === "$in") {
                        operatorClauses.push(
                            remainingValues.length
                                ? { $or: [condition, { [key]: { $in: remainingValues } }] }
                                : condition
                        );
                    } else {
                        operatorClauses.push(
                            remainingValues.length
                                ? { $nor: [condition, { [key]: { $in: remainingValues } }] }
                                : { $nor: [condition] }
                        );
                    }
                } else {
                    operatorClauses.push({ [key]: { [operator]: operand } });
                }
            }
            clauses.push(...operatorClauses);
            continue;
        }

        clauses.push({ [key]: value });
    }

    return clauses.length === 1 ? clauses[0] : { $and: clauses };
}

/**
 * Keep all legacy queries compatible with references stored as either
 * ObjectId or string values, including `_id` and populated relationship ids.
 */
export function installMixedIdentifierQueryCompatibility() {
    const queryPrototype = mongoose.Query.prototype;
    if (queryPrototype.__mixedIdentifierCompatibilityInstalled) return;

    const originalExec = queryPrototype.exec;
    queryPrototype.exec = function (...args) {
        const filter = this.getFilter?.();
        if (filter && typeof filter === "object") {
            this.setQuery(transformMixedIdentifierFilter(filter));
        }

        return originalExec.apply(this, args);
    };

    Object.defineProperty(queryPrototype, "__mixedIdentifierCompatibilityInstalled", {
        value: true,
        configurable: false,
        enumerable: false,
        writable: false,
    });

    const aggregatePrototype = mongoose.Aggregate.prototype;
    const originalAggregateExec = aggregatePrototype.exec;
    aggregatePrototype.exec = function (...args) {
        const pipeline = this.pipeline?.();
        if (Array.isArray(pipeline)) {
            for (const stage of pipeline) {
                if (stage?.$match) {
                    stage.$match = transformMixedIdentifierFilter(stage.$match);
                }
            }
        }
        return originalAggregateExec.apply(this, args);
    };
}

installMixedIdentifierQueryCompatibility();
