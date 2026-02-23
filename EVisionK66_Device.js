export function Name() { return "EVision K66 (App Controlled)"; }
export function VendorId() { return 0; }
export function ProductId() { return 0; }
export function Publisher() { return "SwankyMango"; }
export function Documentation(){ return "troubleshooting/brand"; }
export function Size() { return [23, 6]; }  // hint grid

export function ControllableParameters() {
	return [
		{"property":"LightingMode","group":"lighting","label":"Lighting Mode","type":"combobox","values":["Canvas"],"default":"Canvas"}
	];
}

// ---- Network variables ----
const HOST = "127.0.0.1";
const UDP_PORT = 8124;
const HTTP_PORT_DEFAULT = 8123;
const DISCOVERY = "K66_DISCOVER_V1";
const EXPECT = "K66_HERE_V1";

let httpPort = HTTP_PORT_DEFAULT;
let ledCount = 0;
let ledPositions = [];
let lastFrame = [];

// ---- Initialization ----
export function Initialize() {
	Log("EVision: starting discovery...");
	SendUDPMessage(HOST, UDP_PORT, DISCOVERY, (resp) => {
		try {
			const json = JSON.parse(resp);
			if (json.type === EXPECT) {
				httpPort = json.http_port;
				ledCount = json.led_count;
				Log(`EVision: discovered, ${ledCount} LEDs`);
				LoadLayout();
			}
		} catch(e){ Log("EVision: discovery parse failed " + e); }
	});
}

async function LoadLayout(){
	try{
		const res = await HttpGet(`http://${HOST}:${httpPort}/layout`);
		const data = JSON.parse(res);
		if(data.cells){
			ledPositions = data.cells.filter(c=>c.led!=null).map(c=>[c.x,c.y]);
			Log(`EVision: layout loaded (${ledPositions.length})`);
		}
	}catch(e){ Log("EVision: /layout error "+e); }
}

export function LedNames(){ 
	return ledPositions.map((_,i)=>"LED "+i);
}

export function LedPositions(){
	return ledPositions;
}

// ---- Render loop ----
export function Render() {
	let leds = GetLeds(); // provided automatically by SignalRGB
	if(!leds) return;

	let frame = leds.map((c,i)=>[i,c[0],c[1],c[2]]);
	if(JSON.stringify(frame)===JSON.stringify(lastFrame)) return;
	lastFrame = frame;

	HttpPostJson(`http://${HOST}:${httpPort}/set_frame`, {data:frame})
		.catch(e=>Log("EVision: POST error "+e));
}

export function Shutdown(){ Log("EVision: shutting down"); }

export function Validate(endpoint){ return true; }
export function ImageUrl(){ return ""; }

function Log(m){ Print("EVision: "+m); }
