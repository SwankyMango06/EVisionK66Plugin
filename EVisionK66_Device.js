// EVision K66 Network Device Plugin for SignalRGB
// Works with your Python controller backend (UDP+HTTP bridge)

const DEVICE_NAME = "EVision K66 (App Controlled)";
const UDP_DISCOVERY_HOST = "127.0.0.1";
const UDP_DISCOVERY_PORT = 8124;
const DISCOVERY_REQUEST = "K66_DISCOVER_V1";
const DISCOVERY_RESPONSE_KEY = "K66_HERE_V1";

let httpPort = 8123;      // default HTTP port
let ledCount = 0;
let ledPositions = [];

//
// Entry point
//
function Initialize() {
    Print(`${DEVICE_NAME}: initializing...`);

    DiscoverDevice().then((success) => {
        if (success) {
            Print(`${DEVICE_NAME}: discovery OK`);
            FetchLayout().then(() => {
                RegisterKeyboard();
            }).catch(err => Print(`${DEVICE_NAME}: layout fetch failed - ${err}`));
        } else {
            Print(`${DEVICE_NAME}: discovery failed - using defaults`);
            RegisterKeyboard();
        }
    });
}

//
// === UDP DISCOVERY ===
//
async function DiscoverDevice() {
    return new Promise((resolve) => {
        try {
            SendUDPMessage(UDP_DISCOVERY_HOST, UDP_DISCOVERY_PORT, DISCOVERY_REQUEST, (response) => {
                try {
                    const data = JSON.parse(response);
                    if (data?.type === DISCOVERY_RESPONSE_KEY) {
                        httpPort = data.http_port;
                        ledCount = data.led_count;
                        Print(`${DEVICE_NAME}: discovered, ${ledCount} LEDs @ port ${httpPort}`);
                        resolve(true);
                        return;
                    }
                } catch (e) {
                    Print(`${DEVICE_NAME}: error parsing discovery JSON -> ${e}`);
                }
                resolve(false);
            });
        } catch (e) {
            Print(`${DEVICE_NAME}: UDP discovery exception -> ${e}`);
            resolve(false);
        }
    });
}

//
// === HTTP HELPERS ===
//
async function httpGET(path) {
    const url = `http://${UDP_DISCOVERY_HOST}:${httpPort}${path}`;
    const result = await HttpGet(url);
    return JSON.parse(result);
}

async function httpPOST(path, data) {
    const url = `http://${UDP_DISCOVERY_HOST}:${httpPort}${path}`;
    await HttpPostJson(url, data);
}

//
// === FETCH LAYOUT ===
//
async function FetchLayout() {
    const json = await httpGET("/layout");
    if (!json?.cells) throw "invalid /layout JSON";

    ledPositions = json.cells
        .filter(c => c.led != null && c.led >= 0)
        .map(c => ({
            index: c.led,
            x: c.x,
            y: c.y
        }));

    ledCount = json.cells.length;
    Print(`${DEVICE_NAME}: layout loaded (${ledPositions.length} mapped LEDs)`);
}

//
// === REGISTER DEVICE ===
//
function RegisterKeyboard() {
    let leds = ledPositions.map(p => ({
        Name: `LED ${p.index}`,
        X: p.x,
        Y: p.y
    }));

    if (leds.length === 0) {
        ledCount = 1;
        leds = [{ Name: "LED 0", X: 0, Y: 0 }];
    }

    const dev = {
        Name: DEVICE_NAME,
        Type: "RGB",
        LedCount: ledCount,
        Leds: leds,
        Initialize: () => true,
        Render: RenderFrame
    };

    RegisterDevice(dev);
    Print(`${DEVICE_NAME}: device registered (${ledCount} LEDs)`);
}

//
// === RENDER LOOP ===
//
let lastFrame = [];

function RenderFrame() {
    if (Device == null || Device.Leds == null) return;
    const frameData = [];

    for (let i = 0; i < ledCount; i++) {
        const color = Device.Leds[i].Color;
        const [r, g, b] = [color.R, color.G, color.B];
        frameData.push([i, r, g, b]);
    }

    const changed = JSON.stringify(frameData) !== JSON.stringify(lastFrame);
    if (!changed) return;
    lastFrame = frameData;

    httpPOST("/set_frame", { data: frameData })
        .catch(e => Print(`${DEVICE_NAME}: frame POST failed -> ${e}`));
}

Print(`${DEVICE_NAME}: plugin loaded`);
