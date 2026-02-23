// EVision K66 Network Device Plugin for SignalRGB (GitHub Add-on compatible)
// Author: SwankyMango
// The plugin connects to your Python backend app via UDP + HTTP API.

const DEVICE_NAME = "EVision K66 (App Controlled)";
const UDP_HOST = "127.0.0.1";
const UDP_PORT = 8124;
const DISCOVERY_MESSAGE = "K66_DISCOVER_V1";
const EXPECTED_RESPONSE = "K66_HERE_V1";

let httpPort = 8123;
let ledCount = 0;
let ledPositions = [];

function Initialize() {
    Print(`${DEVICE_NAME}: Initializing plugin...`);
    Discover().then((success) => {
        if (success) {
            Print(`${DEVICE_NAME}: Discovered backend!`);
            LoadLayout().then(() => Register()).catch(e => Print(`Layout error: ${e}`));
        } else {
            Print(`${DEVICE_NAME}: Discovery failed. Registering placeholder.`);
            Register();
        }
    });
}

async function Discover() {
    return new Promise((resolve) => {
        try {
            SendUDPMessage(UDP_HOST, UDP_PORT, DISCOVERY_MESSAGE, (response) => {
                try {
                    const data = JSON.parse(response);
                    if (data.type === EXPECTED_RESPONSE) {
                        httpPort = data.http_port;
                        ledCount = data.led_count;
                        Print(`${DEVICE_NAME}: Found backend on port ${httpPort}, LEDs: ${ledCount}`);
                        resolve(true);
                        return;
                    }
                } catch (e) {
                    Print(`${DEVICE_NAME}: Invalid discovery data → ${e}`);
                }
                resolve(false);
            });
        } catch (err) {
            Print(`${DEVICE_NAME}: Discovery exception → ${err}`);
            resolve(false);
        }
    });
}

async function httpGET(path) {
    const resp = await HttpGet(`http://${UDP_HOST}:${httpPort}${path}`);
    return JSON.parse(resp);
}

async function httpPOST(path, obj) {
    await HttpPostJson(`http://${UDP_HOST}:${httpPort}${path}`, obj);
}

async function LoadLayout() {
    const layout = await httpGET("/layout");
    if (!layout.cells) throw "Invalid layout response";
    ledPositions = layout.cells.filter(c => c.led != null).map(c => ({
        index: c.led,
        x: c.x,
        y: c.y
    }));
    ledCount = layout.cells.length;
    Print(`${DEVICE_NAME}: Layout loaded (${ledPositions.length} mapped LEDs)`);
}

function Register() {
    const leds = ledPositions.length
        ? ledPositions.map(p => ({ Name: `LED ${p.index}`, X: p.x, Y: p.y }))
        : [{ Name: "LED 0", X: 0, Y: 0 }];
    const dev = {
        Name: DEVICE_NAME,
        Type: "RGB",
        LedCount: leds.length,
        Leds: leds,
        Initialize: () => true,
        Render: Render
    };
    RegisterDevice(dev);
    Print(`${DEVICE_NAME}: Registered with ${leds.length} LEDs`);
}

let lastFrame = [];
function Render() {
    if (!Device || !Device.Leds) return;
    const frame = Device.Leds.map((led, i) => [i, led.Color.R, led.Color.G, led.Color.B]);
    if (JSON.stringify(frame) === JSON.stringify(lastFrame)) return;
    lastFrame = frame;
    httpPOST("/set_frame", { data: frame }).catch(e => Print(`${DEVICE_NAME}: Frame error → ${e}`));
}

Print(`${DEVICE_NAME} loaded`);
