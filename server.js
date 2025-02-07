const protoLoader = require('@grpc/proto-loader');
const grpc = require('@grpc/grpc-js');
const minimist = require('minimist');

const argv = minimist(process.argv.slice(2), {
    default: {
        patched: false,
        daemon: false,
        chunks: 10,
        duration: 10,
    }
})

const {port, daemon: param_daemon, duration: param_duration, chunks: param_chunks, patched: param_patched} = argv;

/**
 * Just some random string
 */
function getRandString(size=10) {
    function getRandInt() {
        return Math.floor(Math.random() * 26);
    }

    let arr = new Array(size);
    for (let i = 0; i < size; ++i) {
        arr[i] = String.fromCharCode(97 + getRandInt());
    }

    return arr.join('');
}

/**
 * Simulate some synchronous operation
 * Each render is sync operation which lasts `--duration`ms of time
 */
function simulateRender() {
    const stop = performance.now() + param_duration;
    const result = getRandString(1000);

    while (performance.now() < stop) {
        // do sync job
    }

    return result;
}

// Generate some chunks (--chunks count) to render using simulateRender()
function generateReadyChunks(count) {
    const r = new Array(count);
    for (let i = 0; i < count; ++i) {
        r[i] = {ready: true, html: simulateRender()};
    }
    return r;
}

// Will simulate some async operation
const makeTimeout = (result) => new Promise(r => setTimeout(r, 0, result));

//
// widgetA
//        => setTimeout(widgetB)
//                  => setTimeout(widgetC)
//                  => setTimeout(widgetD)
const widgetD = {
    chunks: () => makeTimeout([
        ...generateReadyChunks(param_chunks),
    ])
}

const widgetC = {
    chunks: () => makeTimeout([
        ...generateReadyChunks(param_chunks),
    ])
}

const widgetB = {
    chunks: () => makeTimeout([
        ...generateReadyChunks(param_chunks),
        {ready: false, widget: widgetC},
        {ready: false, widget: widgetD},
        ...generateReadyChunks(param_chunks),
    ])
}

const widgetA = {
    chunks: () => [
        ...generateReadyChunks(param_chunks),
        {ready: false, widget: widgetB},
        ...generateReadyChunks(param_chunks),
    ]
}

async function writeWidget(widget, httpWrite) {
    // chunk can be ready: actual html
    // chunk can be delimeter: there should be nested widget
    const chunks = await widget.chunks();

    const writeChunk = async chunk => {
        if (chunk.ready) {
            httpWrite(widget, chunk);
            return;
        }

        const {widget: inner} = chunk;

        // there can be nested widgets inside one we are processing
        await writeWidget(inner, httpWrite);
    };

    for (const chunk of chunks) {
        await writeChunk(chunk);
    }
}

/**
 * Get client message and render chunks
 * Mostly ignores client request chunks
 * Start "render" operation as soon as we got connection.
 */
const implementation = {
    async myHandler(call) {
        let done = false;
        console.log('Handler got request');

        call.on('data', async d => {
            console.log('Handler got chunk', d);
        });

        if (!param_daemon)
            call.on('finish', () => {
                setTimeout(() => process.exit(0), 100);
            })

        let count = 0;
        const write = (chunk) => {
            const resultChunk = {
                number: count++,
                result: chunk
            };

            if (param_patched) {
                call.call.sendMessage({...resultChunk}, () => {});
            } else {
                call.write({...resultChunk}, () => {});
            }
        }

        await writeWidget(widgetA, write);
        console.log('finished here, bye!👋');
        call.end();
    },
};

/**
 * Setup server by service.proto file on `--port` port
 * It will receive message, simulate render (see above), and response "rendered" chunks to client
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
    const {myService} = runtimePackage.some;

    const server = new grpc.Server({
        'grpc.enable_channelz': 0,
    });
    server.addService(myService.service, implementation);

    return new Promise((resolve, reject) => server.bindAsync(
        `[::]:${port}`,
        grpc.ServerCredentials.createInsecure(),
        error => {
            if (error) {
                console.error('Could not start', error);
                return reject(error);
            }
            console.log('Started on', port);
            resolve();
        })
    );
})();
