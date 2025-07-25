const parseArgs = require('./argument-parser');
global.args = parseArgs({
    executable: [['e', 't', 'default'], null, 'The NXT Executable file to run.'],
    fading: [['f'], true, 'If the emulator should also emulate NXT LCD fading'],
    colorOn: [['F'], '0,0,0,255', 'The color that should be used for pixels that are turned on, as a RGBA CSV'],
    colorOff: [['B'], '18,41,18,255', 'The color that should be used for the background/turned off pixels, as a RGBA CSV']
}, process.argv);

const { render, decodeBinnary } = require('nxtRICfileUtil');
const fs = require('fs');
const path = require('path');
const VirtualMachine = require('./virtual-machine');
const syscalls = require('./node-calls');
require('./render');

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
    const vm = new VirtualMachine();
    vm.syscalls = syscalls(vm, path.dirname(args.executable));
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
    vm.load(data, process.argv[2]);
    let inter;
    inter = setInterval(() => {
        vm.step();
        if (vm.runQueue.length <= 0) return clearInterval(inter);
    }, 0);
}