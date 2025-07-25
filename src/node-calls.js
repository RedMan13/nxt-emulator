const { SystemCalls } = require('./virtual-machine');
const fs = require('fs');
const path = require('path')

/** @enum */
const FileStatus = {
    SUCCESS: 0x0000,
    IN_PROGRESS: 0x0001,
    REQ_PIN: 0x0002,
    NO_MORE_HANDLES: 0x8100,
    NO_SPACE: 0x8200,
    NO_MORE_FILES: 0x8300,
    EOF_EXPECTED: 0x8400,
    END_OF_FILE: 0x8500,
    NOT_LINEAR_FILE: 0x8600,
    FILE_NOT_FOUND: 0x8700,
    HANDLE_ALREADY_CLOSED: 0x8800,
    NO_LINEAR_SPACE: 0x8900,
    UNDEFINED_ERROR: 0x8A00,
    FILE_IS_BUSY: 0x8B00,
    NO_WRITE_BUFFERS: 0x8C00,
    APPEND_NOT_POSSIBLE: 0x8D00,
    FILE_IS_FULL: 0x8E00,
    FILE_EXISTS: 0x8F00,
    MODULE_NOT_FOUND: 0x9000,
    OUT_OF_BOUNDERY: 0x9100,
    ILLEGAL_FILENAME: 0x9200,
    ILLEGAL_HANDLE: 0x9300,
    BT_BUSY: 0x9400,
    BT_CONNECT_FAIL: 0x9500,
    BT_TIMEOUT: 0x9600,
    FILE_TX_TIMEOUT: 0x9700,
    FILE_TX_DST_EXISTS: 0x9800,
    FILE_TX_SRC_MISSING: 0x9900,
    FILE_TX_STREAM_ERROR: 0x9A00,
    FILE_TX_CLOSE_ERROR: 0x9B00
}
function convertNodeError(err) {
    switch (err.code) {
    case 'EBUSY':
        return FileStatus.FILE_IS_BUSY;
    case 'ERROR_OUTOFMEMORY':
    case 'ERROR_HANDLE_DISK_FULL':
    case 'ENOSPC':
    case 'EDQUOT':
        return FileStatus.NO_MORE_FILES;
    case 'EEXIST':
        return FileStatus.FILE_EXISTS;
    case 'EFBIG':
        return FileStatus.FILE_IS_FULL;
    case 'ERROR_TOO_MANY_OPEN_FILES':
    case 'EMFILE':
        return FileStatus.NO_MORE_HANDLES;
    case 'ENAMETOOLONG':
        return FileStatus.ILLEGAL_FILENAME;
    case 'ERROR_PATH_NOT_FOUND':
    case 'ERROR_FILE_NOT_FOUND':
    case 'ENOENT':
        return FileStatus.FILE_NOT_FOUND;
    case 'ERROR_NOT_ENOUGH_MEMORY':
    case 'ENOMEM':
        return FileStatus.NO_SPACE;
    default: return FileStatus.UNDEFINED_ERROR;
    }
}

const fileHandles = {};
const start = Date.now();
module.exports = function(vm, rootDir) {
    return {
        [SystemCalls.GetStartTick](ret) { ret.value = vm.start; },
        [SystemCalls.RandomNumber](ret) { ret.value = Math.floor(Math.random() * 65536); },
        [SystemCalls.FileClose](ret, handle) {
            ret.value = FileStatus.SUCCESS;
            try {
                if (!(handle.value in fileHandles)) {
                    ret.value = FileStatus.ILLEGAL_HANDLE;
                    return;
                }
                fs.closeSync(handle.value);
            } catch (err) {
                ret.value = convertNodeError(err);
                return;
            }
        },
        [SystemCalls.FileDelete](ret, handle) {
            ret.value = FileStatus.SUCCESS;
            try {
                if (!(handle.value in fileHandles)) {
                    ret.value = FileStatus.ILLEGAL_HANDLE;
                    return;
                }
                fs.closeSync(handle.value);
                fs.rmSync(fileHandles[handle.value]);
            } catch (err) {
                ret.value = convertNodeError(err);
                return;
            }
        },
        [SystemCalls.FileOpenAppend](ret, handle, filename, length) {
            ret.value = FileStatus.SUCCESS;
            try {
                filename = path.resolve(rootDir, filename.asString());
                if (!filename.startsWith(path.resolve(rootDir))) {
                    ret.value = FileStatus.ILLEGAL_FILENAME;
                    return;
                }
                const info = fs.statSync(filename);
                if (info.isDirectory()) {
                    ret.value = FileStatus.ILLEGAL_FILENAME;
                    return;
                }
                length.value = info.size;
                const handleNum = fs.openSync(filename, 'a');
                handle.value = handleNum;
                fileHandles[handleNum] = filename;
            } catch (err) {
                ret.value = convertNodeError(err);
                return;
            }
        },
        [SystemCalls.FileOpenRead](ret, handle, filename, length) {
            ret.value = FileStatus.SUCCESS;
            try {
                filename = path.resolve(rootDir, filename.asString());
                if (!filename.startsWith(path.resolve(rootDir))) {
                    ret.value = FileStatus.ILLEGAL_FILENAME;
                    return;
                }
                const info = fs.statSync(filename);
                if (info.isDirectory()) {
                    ret.value = FileStatus.ILLEGAL_FILENAME;
                    return;
                }
                length.value = info.size;
                const handleNum = fs.openSync(filename, 'r');
                handle.value = handleNum;
                fileHandles[handleNum] = filename;
            } catch (err) {
                ret.value = convertNodeError(err);
                return;
            }
        },
        [SystemCalls.FileOpenWrite](ret, handle, filename, length) {
            ret.value = FileStatus.SUCCESS;
            try {
                filename = path.resolve(rootDir, filename.asString());
                if (!filename.startsWith(path.resolve(rootDir))) {
                    ret.value = FileStatus.ILLEGAL_FILENAME;
                    return;
                }
                const info = fs.statSync(filename);
                if (info.isDirectory()) {
                    ret.value = FileStatus.ILLEGAL_FILENAME;
                    return;
                }
                length.value = info.size;
                const handleNum = fs.openSync(filename, 'r+');
                handle.value = handleNum;
                fileHandles[handleNum] = filename;
            } catch (err) {
                ret.value = convertNodeError(err);
                return;
            }
        },
        [SystemCalls.FileRead](ret, handle, out, length) {
            ret.value = FileStatus.SUCCESS;
            try {
                if (!(handle.value in fileHandles)) {
                    ret.value = FileStatus.ILLEGAL_HANDLE;
                    return;
                }
                const buffer = Buffer.alloc(length.value);
                fs.readSync(handle.value, buffer, 0, length.value);
                // idk, it quite literaly cant change but might aswell anyways
                length.value = buffer.length;
                out.value = [...buffer];
            } catch (err) {
                ret.value = convertNodeError(err);
                return;
            }
        }
    }
}