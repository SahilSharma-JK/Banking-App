const fs = require("fs");
const path = require("path");
const db = require("../../config/db");

const PINCODE_FILE = path.resolve(__dirname, "../../database/data/pincode.csv");

let lookupCache = null;

function parseCsvLine(line) {
    const values = [];
    let value = "";
    let quoted = false;

    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];

        if (char === '"') {
            if (quoted && line[i + 1] === '"') {
                value += '"';
                i += 1;
            } else {
                quoted = !quoted;
            }
            continue;
        }

        if (char === "," && !quoted) {
            values.push(value.trim());
            value = "";
            continue;
        }

        value += char;
    }

    values.push(value.trim());
    return values;
}

function normalize(value) {
    return String(value || "").trim().toUpperCase();
}

function titleCase(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function loadLookupCache() {
    if (lookupCache) return lookupCache;

    if (!fs.existsSync(PINCODE_FILE)) {
        throw new Error(`PIN code data file not found: ${PINCODE_FILE}`);
    }

    const text = fs.readFileSync(PINCODE_FILE, "utf8").replace(/^\uFEFF/, "");
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return new Map();

    const headers = parseCsvLine(lines[0]).map(normalize);
    const indexOf = (name) => headers.indexOf(normalize(name));

    const pinIndex = indexOf("pincode");
    const districtIndex = indexOf("Districtname");
    const stateIndex = indexOf("statename");

    if (pinIndex === -1 || districtIndex === -1 || stateIndex === -1) {
        throw new Error("PIN code CSV must contain pincode, Districtname and statename columns.");
    }

    const map = new Map();

    for (let i = 1; i < lines.length; i += 1) {
        const row = parseCsvLine(lines[i]);
        const pincode = String(row[pinIndex] || "").replace(/\D/g, "");
        if (!/^\d{6}$/.test(pincode) || map.has(pincode)) continue;

        map.set(pincode, {
            pincode,
            state_name: titleCase(row[stateIndex]),
            district_name: titleCase(row[districtIndex]),
        });
    }

    lookupCache = map;
    console.log(`Loaded ${lookupCache.size} PIN codes from local CSV.`);
    return lookupCache;
}

async function lookupPincode(pincode) {
    const cleanPin = String(pincode || "").replace(/\D/g, "").slice(0, 6);
    if (!/^\d{6}$/.test(cleanPin)) return null;

    const record = loadLookupCache().get(cleanPin);
    if (!record) return null;

    const [states] = await db.query(
        `SELECT state_code, state_name FROM states WHERE UPPER(state_name) = UPPER(?) LIMIT 1`,
        [record.state_name]
    );

    let state = states[0];

    if (!state) {
        const [stateByLooseName] = await db.query(
            `SELECT state_code, state_name FROM states WHERE REPLACE(UPPER(state_name), ' ', '') = REPLACE(UPPER(?), ' ', '') LIMIT 1`,
            [record.state_name]
        );
        state = stateByLooseName[0];
    }

    if (!state) {
        return {
            pincode: cleanPin,
            state_name: record.state_name,
            district_name: record.district_name,
            state_code: "",
            city_id: "",
            city_name: record.district_name,
        };
    }

    const [cities] = await db.query(
        `SELECT city_id, city_name
         FROM cities
         WHERE state_id = ?
           AND REPLACE(UPPER(city_name), ' ', '') = REPLACE(UPPER(?), ' ', '')
         LIMIT 1`,
        [state.state_code, record.district_name]
    );

    return {
        pincode: cleanPin,
        state_name: state.state_name,
        state_code: state.state_code,
        district_name: record.district_name,
        city_id: cities[0]?.city_id ? String(cities[0].city_id) : "",
        city_name: cities[0]?.city_name || record.district_name,
    };
}

module.exports = {
    lookupPincode,
};
