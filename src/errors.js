class StructureError extends Error {
    constructor(msg) { super(msg); }
}
class VersionError extends StructureError {
    constructor(msg) { super(msg); }
}

module.exports = {
    StructureError,
    VersionError
}