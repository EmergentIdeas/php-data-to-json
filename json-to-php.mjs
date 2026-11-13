export default function jsonToPhpSerialized(value, options = {}) {
	const { asObject = false, className = 'stdClass' } = options;
	const encoder = new TextEncoder();
	const byteLength = (s) => encoder.encode(s).length;

	const encodeString = (s) => `s:${byteLength(s)}:"${s}";`;

	// PHP converts numeric string keys such as "5" into integer keys
	const encodeKey = (key) => {
		if (typeof key === 'number') return `i:${key};`;
		const isIntegerKey = /^-?(0|[1-9]\d*)$/.test(key) &&
			Number.isSafeInteger(Number(key));
		return isIntegerKey ? `i:${key};` : encodeString(key);
	};

	// Produces "count:{key value key value ...}"
	const encodeEntries = (entries) => {
		const body = entries.map(([k, v]) => encodeKey(k) + encodeValue(v)).join('');
		return `${entries.length}:{${body}}`;
	};

	const encodeValue = (v) => {
		if (v === null || v === undefined) return 'N;';

		switch (typeof v) {
			case 'boolean':
				return `b:${v ? 1 : 0};`;

			case 'number':
				if (Number.isNaN(v)) return 'd:NAN;';
				if (v === Infinity) return 'd:INF;';
				if (v === -Infinity) return 'd:-INF;';
				// JavaScript has no int/float distinction, so whole numbers become i:
				return Number.isInteger(v) ? `i:${v};` : `d:${v};`;

			case 'bigint':
				return `i:${v};`;

			case 'string':
				return encodeString(v);

			case 'object': {
				if (v instanceof Date) return encodeString(v.toISOString());

				if (Array.isArray(v)) {
					const entries = v.map((item, i) => [i, item]);
					return `a:${encodeEntries(entries)}`;
				}

				const entries = Object.entries(v).filter(
					([, val]) => val !== undefined && typeof val !== 'function' && typeof val !== 'symbol'
				);

				if (asObject) {
					return `O:${byteLength(className)}:"${className}":${encodeEntries(entries)}`;
				}
				return `a:${encodeEntries(entries)}`;
			}

			default:
				// functions, symbols, etc. have no PHP equivalent
				return 'N;';
		}
	};

	return encodeValue(value);
}

