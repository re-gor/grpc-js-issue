# grpc-js-issue

Example illustrating https://github.com/grpc/grpc-node/issues/2899

## run

`node index.js` will spawn two processes: grpc-client and grpc-server.

- The client will do one request with one message inside.
- The server will respond with series of chunks

By default the server will simulate an asynchronous render operation.
It will render 4 widgets. Widget A contains Widget B. B contains widgets C and D.
Widgets B, C, D are rendered asynchronously each in their own macrotask (simulated with `setTimeout`)
Widgets A and B produce 20 chunks by default. C and D produce 10 chunks each.
Each widget render itself and plan child's (children's) render

### `--patched` argument

By default, the server starts without any changes to the standard writing process.
It uses standard `call.write` method.

An argument `--patched` changes this behavior.
Instead of using `call.write` the server starts writing using `call.call.sendMessage` directly

### Other arguments

Quick info can be obtained with `--help` argument: `node ./index.js --help`
All arguments propogated both to the server and the client.

One can start the server directly. For example: `node ./server.js --port 16200 --patched --daemon`

`--daemon` argument will forse server to continue listening for requests. It is `false` by default.

## Output

The client produces some output. It prints each chunk's time of arriving to the client

One can see that patched version slightly better. Some chunks in the middle of the response arrived earlier.
This behavior is not deterministic: the number of faster chunks can be more or less, but in most cases there are at least 4-6 of such chunks

// Patched version on the right

<img width="1317" alt="image" src="https://github.com/user-attachments/assets/d498817c-1642-4f6b-90df-0d9da731df14" />
<img width="1496" alt="image" src="https://github.com/user-attachments/assets/dc681d1f-0a14-41a5-820d-fe465ef0e08f" />
