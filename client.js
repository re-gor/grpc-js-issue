const protoLoader = require('@grpc/proto-loader');
const grpc = require('@grpc/grpc-js');
const minimist = require('minimist');

const argv = minimist(process.argv.slice(2), {
    default: {
        packages: 1,
        interval: 10,
    }
});

let {port, packages, interval} = argv;


/**
 * Setup client by service.proto file
 *
 * It will send `--packages` count of messages with `--interval` ms interval.
 *
 * In the end of the response it will log timings of each chunk
 */
(async () => {
    const definition = protoLoader.loadSync(__dirname + '/service.proto', {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: false,
        oneofs: true,
    });
    const runtimePackage = grpc.loadPackageDefinition(definition);

    const client = new runtimePackage.some.myService(`[::]:${port}`, grpc.credentials.createInsecure());

    const call = client.myHandler();

    const timings = [];
    let msg = 0;

    const start = performance.now();

    const intervalId = setInterval(() => {
        if (!packages--) {
            clearInterval(intervalId);
            call.end();
            return;
        }
        const number = ++msg;
        console.log('send message', number);
        call.write({
            number,
        });
    }, interval)

    let chunk_id = 0;
    call.on('data', (d) => {
        console.log('Got response chunk', d.number);
        timings.push({id: chunk_id++, time: performance.now() - start});
    });

    return new Promise((resolve, reject) => {
        call.on('end', (error) => {
            if (error) {
                console.error('Response failed', error);
                reject(error);
            }
            console.log('Response finished');
            console.log('Timings', timings);
            resolve();
        })
    });
})();
