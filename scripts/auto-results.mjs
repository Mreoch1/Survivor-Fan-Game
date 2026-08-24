import fs from "node:fs";

const root=new URL("../",import.meta.url),envPath=new URL(".auto-results.env",root),config=Object.fromEntries(fs.readFileSync(envPath,"utf8").split(/\r?\n/).filter(Boolean).map(line=>{const at=line.indexOf("=");return[line.slice(0,at),line.slice(at+1)]})),base="https://survivor-fan-game.vercel.app",headers={authorization:`Bearer ${config.AUTO_RESULTS_SECRET}`,"content-type":"application/json"};
const mode=process.argv[2]||"context",options={headers};if(mode==="submit"||mode==="submit-file"){const argument=process.argv[3];if(!argument)throw new Error("Provide structured result JSON or a JSON file path");const input=mode==="submit-file"?fs.readFileSync(argument,"utf8"):argument;JSON.parse(input);options.method="POST";options.body=input}
const response=await fetch(`${base}/api/automation/results`,options),text=await response.text();if(!response.ok)throw new Error(`Automation request failed (${response.status}): ${text}`);console.log(text);
