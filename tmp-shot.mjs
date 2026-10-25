import fs from "node:fs";
const src = process.argv[2];
const dest = process.argv[3];
const json = JSON.parse(fs.readFileSync(src, "utf8"));
const data = json.result?.data || json.data;
fs.writeFileSync(dest, Buffer.from(data, "base64"));
console.log("ok", data.length);
