import fs from "node:fs";

const root=new URL("../",import.meta.url),envPath=new URL(".auto-results.env",root),config=Object.fromEntries(fs.readFileSync(envPath,"utf8").split(/\r?\n/).filter(Boolean).map(line=>{const at=line.indexOf("=");return[line.slice(0,at),line.slice(at+1)]})),base="https://survivor-fan-game.vercel.app",headers={authorization:`Bearer ${config.AUTO_RESULTS_SECRET}`};
const response=await fetch(`${base}/api/automation/recap`,{headers}),text=await response.text();if(!response.ok)throw new Error(`Results recap automation failed (${response.status}): ${text}`);console.log(text);
