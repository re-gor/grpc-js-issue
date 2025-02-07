const { fork } = require('node:child_process');
const minimist = require('minimist')

const argv = minimist(process.argv.slice(2), {default: {
    port: 16200
}});

if (argv.help || argv.h) {
    console.log(
`
node ./index.js [options]
Options:
    --help|-h        : this message

    Server arguments
    --patched        : if write should be patched. \`call.write\` => \`call.call.sendMessage\`
    --chunks <num>   : how many chunks produce by each render. default: 10
    --duration <num> : how much time each render spends. default: 10
    --port <num>     : port to start server. default: 16200
    --daemon         : if server should stay alive after client finish its request. default: false

    Client arguments
    The next pair is programmed in the client but it is ignored by server actually
    --packages <num> : how many packages should client send. default: 1
    --interval <num> : interval between packages in milliseconds. default: 10
`
);
    return;
}

function copyArgs() {
    return Object.entries(argv).reduce((acc, [k, v]) => {
        acc.push(`--${k}`);
        acc.push(v);

        return acc;
    }, []);
}

const serverArgv = copyArgs();
const clientArgv = copyArgs();

function forkLog(file, args, prefix) {
    const child = fork(file, args, { silent: true });

    const stdout = makeGreen('stdout');
    child.stdout.on('data', (data) => {
        console.log(`${prefix} ${stdout}: ${data}`);
    });

    const stderr = makeRed('stderr');
    child.stderr.on('data', (data) => {
        console.error(`${prefix} ${stderr}: ${data}`);
    });

    child.on('close', (code) => {
        console.log(`${prefix} child process exited with code ${code}`);
    });
}

const makeRed = s => "\033[31m" + s + '\033[0m';
const makeGreen = s =>  "\033[32m" + s + '\033[0m';
const makeMagenta = s => '\033[35m' + s + '\033[0m';
const makeBlue = s => '\033[36m' + s + '\033[0m';

forkLog('./server.js', serverArgv, makeBlue('[SERVER]'));
setTimeout(() => forkLog('./client.js', clientArgv, makeMagenta('[CLIENT]')), 0);
