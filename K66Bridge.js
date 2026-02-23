// K66Bridge.js
export function Name() { return "Womier K66 (App Controlled)"; }
export function Version() { return "1.0.0"; }
export function Type() { return "network"; }
export function VendorId() { return 0x0000; }
export function ProductId() { return 0x0000; }
export function Publisher() { return "kushbushofc"; }
export function Documentation() { return "troubleshooting/brand"; }
export function Size() { return [23, 6]; }
export function DefaultPosition() { return [60, 70]; }
export function DefaultScale() { return 10.0; }

let ledCount = 126;
let baseUrl = "http://127.0.0.1:8123";
let vLedNames = [];
let vLedPositions = [];
let lastSent = [];
let inFlight = false;
let pending = null;

export function LedNames() { return vLedNames; }
export function LedPositions() { return vLedPositions; }

export function Initialize() {
	try {
		if (typeof controller !== "undefined" && controller !== null) {
			if (controller.http_port) baseUrl = `http://127.0.0.1:${controller.http_port}`;
			if (controller.led_count) ledCount = controller.led_count;
			if (controller.name) device.setName(controller.name);
		}
	} catch (e) {
		device.setName("Womier K66 (App Controlled)");
	}

	httpGetJson(`${baseUrl}/layout`, (ok, layout) => {
		if (!ok || !layout) {
			buildFallbackLayout();
			return;
		}
		applyLayout(layout);
	});
}

export function Render() {
	if (vLedPositions.length !== ledCount) return;
	const updates = [];
	for (let i = 0; i < ledCount; i++) {
		const pos = vLedPositions[i];
		const rgb = device.color(pos[0], pos[1]);
		const r = clamp255(rgb[0]), g = clamp255(rgb[1]), b = clamp255(rgb[2]);
		const prev = lastSent[i];
		if (prev && prev[0] === r && prev[1] === g && prev[2] === b) continue;
		updates.push([i, r, g, b]);
	}
	if (updates.length === 0) return;
	sendFrame({ data: updates });
	device.pause(1);
}

export function Shutdown() {
	sendFrame({ data: [] });
}

function applyLayout(layout) {
	let width = layout.size_hint?.width || 23;
	let height = layout.size_hint?.height || 6;
	device.setSize(width, height);

	vLedNames = [];
	vLedPositions = [];
	lastSent = [];

	for (let i = 0; i < ledCount; i++) {
		vLedNames.push(`LED ${i}`);
		vLedPositions.push([0, 0]);
		lastSent.push([-1, -1, -1]);
	}

	if (layout.cells && Array.isArray(layout.cells)) {
		for (let cell of layout.cells) {
			if (cell.led == null) continue;
			const cx = (cell.x || 0) + (cell.w || 1) / 2;
			const cy = (cell.y || 0) + (cell.h || 1) / 2;
			vLedPositions[cell.led] = [Math.round(cx), Math.round(cy)];
		}
	}

	device.setControllableLeds(vLedNames, vLedPositions);
}

function buildFallbackLayout() {
	device.setSize(23, 6);
	vLedNames = [];
	vLedPositions = [];
	lastSent = [];
	for (let i = 0; i < ledCount; i++) {
		vLedNames.push(`LED ${i}`);
		vLedPositions.push([i % 23, Math.floor(i / 23)]);
		lastSent.push([-1, -1, -1]);
	}
	device.setControllableLeds(vLedNames, vLedPositions);
}

function sendFrame(bodyObj) {
	if (inFlight) { pending = bodyObj; return; }
	inFlight = true;
	const xhr = new XMLHttpRequest();
	xhr.open("POST", `${baseUrl}/set_frame`, true);
	xhr.setRequestHeader("Content-Type", "application/json");
	xhr.onreadystatechange = function () {
		if (xhr.readyState === 4) {
			inFlight = false;
			if (pending) {
				const p = pending;
				pending = null;
				sendFrame(p);
			}
		}
	};
	xhr.send(JSON.stringify(bodyObj));
}

function httpGetJson(url, cb) {
	const xhr = new XMLHttpRequest();
	xhr.open("GET", url, true);
	xhr.onreadystatechange = function () {
		if (xhr.readyState !== 4) return;
		if (xhr.status >= 200 && xhr.status < 300) {
			try { cb(true, JSON.parse(xhr.responseText)); }
			catch { cb(false, null); }
		} else cb(false, null);
	};
	xhr.send();
}

function clamp255(n) {
	return Math.max(0, Math.min(255, Math.round(n)));
}

export function DiscoveryService() {
	this.UdpBroadcastAddress = "127.0.0.1";
	this.UdpBroadcastPort = 8124;
	this.UdpListenPort = 8125;

	this.Update = function () {
		service.broadcast("K66_DISCOVER_V1");
	};

	this.Discovered = function (value) {
		try {
			const msg = JSON.parse(value.response);
			if (msg.type !== "K66_HERE_V1") return;
			const id = `k66-${msg.http_port}`;
			const ctrl = {
				id: id,
				name: msg.name,
				http_port: msg.http_port,
				led_count: msg.led_count
			};
			service.addController(ctrl);
			service.announceController(ctrl);
		} catch {}
	};
}
