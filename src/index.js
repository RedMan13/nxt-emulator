const parseArgs = require('./argument-parser');
global.args = parseArgs({
    executable: [['e', 'default'], null, 'The NXT Executable file to run.'],
    fading: [['f'], false, 'If the emulator should also emulate NXT LCD fading'],
    colorOn: [['F'], '0,0,0,255', 'The color that should be used for pixels that are turned on, as a RGBA CSV'],
    colorOff: [['B'], '18,41,18,255', 'The color that should be used for the background/turned off pixels, as a RGBA CSV'],
    capture: [['c'], false, 'If we should be using captured frames from the NXT instead of running the executable, if a file is provided anyways the file will be uploaded to the NXT and ran'],
    target: [['t'], null, 'Sets up a connection with an NXT brick over USB, if unset it will just be the first recognisable devices, otherwise it is one of usb device id, bluetooth address, or NXT name'],
    list: [['l'], null, 'List all NXT devices that can be connected'],
    // 260 seems to be about the maximum speed the nxt will respond to us 
    pollRate: [['p'], 260, 'The milisecond interval that we should poll the NXT screen at']
}, process.argv);

const { render, decodeBinnary } = require('nxtRICfileUtil');
const fs = require('fs');
const path = require('path');
const VirtualMachine = require('./virtual-machine');
const syscalls = require('./node-calls');
const NXTCommunication = require('./nxt-communication');

(async () => {
    // check if we need to go do nothing and just list devices
    if (args.list) {
        const devices = await NXTCommunication.listDevices();
        if (devices.length <= 0) console.log('No NXT devices accessable');
        for (const device of devices) {
            const comm = new NXTCommunication(device);
            const info = await comm.deviceInfo();
            comm.makeError(info);
            console.log('usbAddress:', device.device.deviceAddress, '\tbtAddress:', info.bluetoothAddress, '\tname:', info.name);
        }
        process.exit(0);
    }

    // setup the VM, we may not need it but it will definitly be helpful
    const document = require('./render');
    const root = path.dirname(args.executable ?? process.cwd() + '/rizz');
    const vm = new VirtualMachine();
    vm.syscalls = syscalls(vm, root);
    // bind draw calls
    vm.syscalls[VirtualMachine.SystemCalls.DrawCircle] = (ret, pos, rad, opts) =>
        render.draw('Circle', opts.value, pos.get(0), pos.get(1), rad.value);
    vm.syscalls[VirtualMachine.SystemCalls.DrawLine] = (ret, pos1, pos2, opts) =>
        render.draw('Line', opts.value, pos1.get(0), pos1.get(1), pos2.get(0), pos2.get(1));
    vm.syscalls[VirtualMachine.SystemCalls.DrawPicture] = (ret, pos, file, args, opts) => {
        const ctx = decodeBinnary(fs.readFileSync(file.asString()));
        render.draw('RICDraw', opts.value, pos.get(0), pos.get(1), ctx, args);
    }
    vm.syscalls[VirtualMachine.SystemCalls.DrawPoint] = (ret, pos, opts) =>
        render.draw('Pixel', opts.value, pos.get(0), pos.get(1));
    vm.syscalls[VirtualMachine.SystemCalls.DrawRect] = (ret, pos, size, opts) =>
        render.draw('Rectangle', opts.value, pos.get(0), pos.get(1), size.get(0) +1, size.get(1) +1);
    vm.syscalls[VirtualMachine.SystemCalls.DrawText] = (ret, pos, text, opts) =>
        render.draw('TextBox', opts.value, pos.get(0), pos.get(1), text.asString());
    
    // setup communications if needed
    if (args.target) {
        /** @type {NXTCommunication} */
        let comms;
        let info;
        if (typeof args.target === 'string') {
            const devices = await NXTCommunication.listDevices();
            for (const toCheck of devices) {
                comms = new NXTCommunication(toCheck, root, vm); await comms.ready;
                comms.enableFileAccess = false;
                if (args.target == toCheck.device.deviceAddress) break;
                info = await comms.deviceInfo();
                if (info.bluetoothAddress === args.target) break;
                if (info.name === args.target) break;
            }
        }
        comms ??= new NXTCommunication(null, root, vm); await comms.ready;
        info ??= await comms.deviceInfo();
        console.log('Connected to', info.name);
        if (args.capture) {
            if (args.executable) {
                await comms.downloadFile('nxtea-copy.rxe', fs.readFileSync(args.executable));
                await comms.startProgram('nxtea-copy.rxe');
            }
            const { moduleID: displayId, handle: display } = await comms.findModule('Display.*');
            await comms.closeModule(display);
            if (!comms.checkModule(displayId, { id: NXTCommunication.ModuleIds.display }))
                throw new Error('Could not get the display module from the NXT');
            const { moduleID: uiID, handle: ui } = await comms.findModule('Ui.*');
            await comms.closeModule(ui);
            if (!comms.checkModule(uiID, { id: NXTCommunication.ModuleIds.ui }))
                console.warn('Could not get the UI module from the NXT, window inputs will be dissabled');
            else {
                document.on('keydown', async e => {
                    let buttonCode;
                    let buttonKey
                    switch (e.code) {
                    default: return;
                    case 'ArrowUp':
                    case 'Enter':
                    case 'KeyW': buttonCode = 2; buttonKey = 3; break;
                    case 'ArrowDown':
                    case 'Escape':
                    case 'KeyS':
                        buttonCode = 4;
                        buttonKey = 0;
                        // stop any running programs, as thats what exit normally does
                        comms.stopProgram(true);
                        break;
                    case 'ArrowLeft':
                    case 'KeyA': buttonCode = 1; buttonKey = 2; break;
                    case 'ArrowRight':
                    case 'KeyD': buttonCode = 3; buttonKey = 1; break;
                    }
                    await comms.writeIOMap(uiID, 28, 1, Buffer.from([buttonCode]));
                });
            }
            (async function getFrame() {
                const start = Date.now();
                let offset = 119;
                let requested = 800;
                while (requested > 0) {
                    const { data, length } = await comms.readIOMap(displayId, offset, requested);
                    let x = 0;
                    let y = 0;
                    for (let i = 0; i < length; i++) {
                        // the array is height/width inside the NXT
                        y = Math.floor(((offset + i) - 119) / 100);
                        x = ((offset + i) - 119) % 100;
                        if (!render.frame[x]) break;
                        render.frame[x][render.height - ((y * 8) +8)] = (data[i] >> 7) & 1;
                        render.frame[x][render.height - ((y * 8) +7)] = (data[i] >> 6) & 1;
                        render.frame[x][render.height - ((y * 8) +6)] = (data[i] >> 5) & 1;
                        render.frame[x][render.height - ((y * 8) +5)] = (data[i] >> 4) & 1;
                        render.frame[x][render.height - ((y * 8) +4)] = (data[i] >> 3) & 1;
                        render.frame[x][render.height - ((y * 8) +3)] = (data[i] >> 2) & 1;
                        render.frame[x][render.height - ((y * 8) +2)] = (data[i] >> 1) & 1;
                        render.frame[x][render.height - ((y * 8) +1)] = data[i] & 1;
                    }
                    offset += length;
                    requested -= length;
                }
                const toWait = args.pollRate - (Date.now() - start);
                if (toWait < 0) console.warn(`Could not complete frame grab in time, took ${Math.abs(toWait)}MS to long`);
                // we HAVE to keep proper order, or else we get a completely uninteligable result
                setTimeout(getFrame, toWait);
            })();
        }
    } else {
        // finally, check if we even have a file to load
        if (!fs.existsSync(args.executable)) {
            let osc = false;
            setInterval(() => {
                osc = !osc;
                render.clear('whole');
                render.draw('Rectangle', osc ? 0b100000 : 0b000000, 0, 31, 100, 11);
                render.draw('TextBox', osc ? 0b000100 : 0b000000, 2, 32, 'No File Provided');
            }, 1000);
        } else {
            const data = fs.readFileSync(args.executable);
            vm.load(data, args.executable);
            let inter;
            inter = setInterval(() => {
                vm.step();
                if (vm.runQueue.length <= 0) return clearInterval(inter);
            }, 0);
        }
    }
})();