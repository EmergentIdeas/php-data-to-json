export default function phpSerializedToJson(input) {
	// PHP string lengths are in bytes, so parse over a byte array
	const bytes = typeof input === 'string'
		? new TextEncoder().encode(input)
		: input;
	const decoder = new TextDecoder('utf-8');
	let pos = 0;

	const fail = (msg) => {
		throw new SyntaxError(`${msg} at byte ${pos}`);
	};

	const expect = (ch) => {
		if (bytes[pos] !== ch.charCodeAt(0)) fail(`Expected '${ch}'`);
		pos++;
	};

	// Reads text up to (and consumes) the terminator character
	const readUntil = (terminator) => {
		const start = pos;
		const term = terminator.charCodeAt(0);
		while (pos < bytes.length && bytes[pos] !== term) pos++;
		if (pos >= bytes.length) fail(`Missing '${terminator}'`);
		const text = decoder.decode(bytes.subarray(start, pos));
		pos++;
		return text;
	};

	// Reads a length-prefixed string: 5:"hello" (the quotes are consumed here)
	const readSizedString = () => {
		const len = parseInt(readUntil(':'), 10);
		expect('"');
		const text = decoder.decode(bytes.subarray(pos, pos + len));
		pos += len;
		expect('"');
		return text;
	};

	// Protected ("\0*\0name") and private ("\0Class\0name") property names
	// are stripped down to the plain property name
	const cleanPropertyName = (name) => name.replace(/^\0[^\0]*\0/, '');

	const buildArray = (entries) => {
		const isList = entries.every(([key], i) => key === i);
		if (isList) return entries.map(([, value]) => value);
		const obj = {};
		for (const [key, value] of entries) obj[String(key)] = value;
		return obj;
	};

	const parseValue = () => {
		if (pos >= bytes.length) fail('Unexpected end of input');
		const type = String.fromCharCode(bytes[pos++]);

		switch (type) {
			case 'N': // N;
				expect(';');
				return null;

			case 'b': { // b:1;
				expect(':');
				const v = readUntil(';');
				return v === '1';
			}

			case 'i': { // i:42;
				expect(':');
				return parseInt(readUntil(';'), 10);
			}

			case 'd': { // d:3.14;
				expect(':');
				const v = readUntil(';');
				if (v === 'INF') return Infinity;
				if (v === '-INF') return -Infinity;
				if (v === 'NAN') return NaN;
				return parseFloat(v);
			}

			case 's': { // s:5:"hello";
				expect(':');
				const str = readSizedString();
				expect(';');
				return str;
			}

			case 'a': { // a:2:{i:0;s:1:"a";s:1:"k";i:1;}
				expect(':');
				const count = parseInt(readUntil(':'), 10);
				expect('{');
				const entries = [];
				for (let i = 0; i < count; i++) {
					const key = parseValue();
					const value = parseValue();
					entries.push([key, value]);
				}
				expect('}');
				return buildArray(entries);
			}

			case 'O': { // O:8:"stdClass":1:{s:4:"name";s:3:"Bob";}
				expect(':');
				readSizedString(); // class name (not included in JSON output)
				expect(':');
				const count = parseInt(readUntil(':'), 10);
				expect('{');
				const obj = {};
				for (let i = 0; i < count; i++) {
					const key = String(parseValue());
					const value = parseValue();
					obj[cleanPropertyName(key)] = value;
				}
				expect('}');
				return obj;
			}

			default:
				fail(`Unsupported type '${type}'`);
		}
	};

	const result = parseValue();
	if (pos !== bytes.length) fail('Unexpected trailing data');
	return result;
}

