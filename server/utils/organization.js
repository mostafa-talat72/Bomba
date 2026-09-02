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

/**
 * Keep legacy controllers that still use `{ organization: id }` compatible
 * with records stored using either ObjectId or string organization values.
 */
export function installOrganizationQueryCompatibility() {
    const queryPrototype = mongoose.Query.prototype;
    if (queryPrototype.__organizationCompatibilityInstalled) return;

    const originalExec = queryPrototype.exec;
    queryPrototype.exec = function (...args) {
        const filter = this.getFilter?.();
        const organization = filter?.organization;
        const isObjectId = organization instanceof mongoose.Types.ObjectId;
        const isPlainValue =
            organization != null &&
            (typeof organization !== "object" ||
                isObjectId ||
                organization?._id != null);

        if (isPlainValue) {
            const { organization: ignoredOrganization, ...rest } = filter;
            this.setQuery({
                ...rest,
                ...organizationFilter(organization),
            });
        }

        return originalExec.apply(this, args);
    };

    Object.defineProperty(queryPrototype, "__organizationCompatibilityInstalled", {
        value: true,
        configurable: false,
        enumerable: false,
        writable: false,
    });
}

installOrganizationQueryCompatibility();
