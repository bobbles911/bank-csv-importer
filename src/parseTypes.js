import dateParser from "any-date-parser";

// A more advanced string-to-number function
// Handles strings with thousand separators etc
function toNumber(str) {
	// Strip all spaces
	// (Some countries use space as a thousand separator??)
	str = str.replaceAll(" ", "");

	// Get third char from the right - the decimal separator
	let decimalSep = str.charAt(str.length - 3);

	if (decimalSep === ".") {
		// Decimal point separator, so can strip all commas from string (commas are thousand separators)
		str = str.replaceAll(",", "");
	} else if (decimalSep === ",") {
		// Comma decimal separator, so first...
		// Strip all decimal points (thousand separators)
		str = str.replaceAll(".", "");
		// Replace remaining comma decimal separator with a point, to get the standard decimal point separator notation
		str = str.replaceAll(",", ".");
	}

	// And attempt to coerce the final string to a Number
	return Number(str);
}

export function parseNumber(str) {
	// Try to coerce as a number
	let asNumber = Number(str);

	if (!isNaN(asNumber)) {
		return asNumber;
	} else {
		// Try again with more advanced function
		asNumber = toNumber(str);

		if (!isNaN(asNumber)) {
			return asNumber;
		}
	}

	return null;
}

export function parseDate(str) {
	let asDate = dateParser.fromString(str);

	if (asDate instanceof Date) {
		return asDate;
	}

	return null;
}

export function findTypes(records) {
	return records.map(record => record.map(field => {
		if (field === "") { // Because otherwise the empty string is coerced to 0 by Number() below.
			return "";
		}

		// Try to coerce as a number
		let asNumber = parseNumber(field);

		if (asNumber !== null) {
			return asNumber;
		}

		// Try to coerce as a Date
		// Do this after attempting to coerce to number, as it is quite zealous and might
		// detect some numbers as dates like 4.05 -> 2022-05-04T00:00:00.000Z
		let asDate = parseDate(field);

		if (asDate !== null) {
			return asDate;
		}

		// Return unmodified string
		return field;
	}))
}
