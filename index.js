const dateParser = require("any-date-parser");

// https://stackoverflow.com/a/55292366
// Trim chars in the chars array from either end of a string
function trimChars(str, chars) {
	var start = 0, end = str.length;

	while(start < end && chars.indexOf(str[start]) >= 0)
		++ start;

	while(end > start && chars.indexOf(str[end - 1]) >= 0)
		-- end;

	return (start > 0 || end < str.length) ? str.substring(start, end) : str;
}

function getLines(data) {
	return data.split(/\r?\n/g)
		.map(line => line.trim())
		.filter(line => line.length > 0);
}

function detectSeparator(lines) {
	const SEPARATOR_CHARS = [",", ";", "\t"];

	// Use only a subset of lines
	lines = lines.slice(0, 20);

	// Strip anything in quotes
	lines = lines.map(line => {
		return line.replace(/"[^"]+"/g, "")
			.replace(/'[^']+'/g, "");
	});

	// Count which separator char appears the most

	let counts = SEPARATOR_CHARS.map(x => 0); // init counts to zero

	SEPARATOR_CHARS.forEach((sep, i) => {
		let count = 0;

		lines.forEach(line => {
			for (let j = 0; j < line.length; j ++) {
				if (line.charAt(j) == sep) {
					count ++;
				}
			}
		});

		counts[i] = count;
	});

	let greatestIndex = 0;

	for (let i = 0; i < SEPARATOR_CHARS.length; i ++) {
		if (counts[i] > counts[greatestIndex]) {
			greatestIndex = i;
		}
	}

	return SEPARATOR_CHARS[greatestIndex];
}

function splitLinesToFields(lines, sep) {
	let records = lines.map(line => {
		let lineParts = [];
		let inQuotes = false;
		let quoteChar = null;
		let lastSplitPoint = -1;
		let onlyWhitespaceSinceSep = true;

		for (let i = 0; i < line.length; i ++) {
			let c = line.charAt(i);

			if (c == "'" || c == '"') {
				if (inQuotes && c == quoteChar) {
					inQuotes = false;
				} else if (!inQuotes && onlyWhitespaceSinceSep) {
					// We only start a new quoted part if we just passed the separator and there has been nothing but whitespace
					// Otherwise we might start a new quoted block by a random apostrophe appearing within a non-quoted string
					inQuotes = true;
					quoteChar = c;
				}
			}

			if (c != " ") {
				onlyWhitespaceSinceSep = false;
			}

			if (c == sep && !inQuotes) {
				// Split here!
				lineParts.push(
					line.substring(lastSplitPoint + 1, i)
				);

				lastSplitPoint = i;
				onlyWhitespaceSinceSep = true;
			}
		}

		// Add the final part
		lineParts.push(
			line.substring(lastSplitPoint + 1, line.length)
		);

		// Trim spaces and then quotes from all parts
		lineParts = lineParts.map(part => trimChars(part.trim(), ["'", '"']));

		return lineParts;
	});

	return records;
}

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

function findTypes(records) {
	return records.map(record => record.map(field => {
		if (field === "") { // Because otherwise the empty string is coerced to 0 by Number() below.
			return "";
		}

		// Try to coerce as a number
		let asNumber = Number(field);

		if (!isNaN(asNumber)) {
			return asNumber;
		} else {
			// Try again with more advanced function
			asNumber = toNumber(field);

			if (!isNaN(asNumber)) {
				return asNumber;
			}
		}

		// Try to coerce as a Date
		// Do this after attempting to coerce to number, as it is quite zealous and might
		// detect some numbers as dates like 4.05 -> 2022-05-04T00:00:00.000Z
		let asDate = dateParser.fromString(field);

		if (asDate instanceof Date) {
			return asDate;
		}

		// Return unmodified string
		return field;
	}))
}

// Passed records must have already been converted to types
function detectFirstLineHeader(typedRecords) {
	if (typedRecords.length < 2) {
		return typedRecords;
	}

	// if first line contains no date in a certain column, AND second line does
	// OR
	// first line contains no number in a certain column AND second line does
	// THEN, first line is (probably...) a header

	let firstLine = typedRecords[0];
	let secondLine = typedRecords[1];
	let firstLineIsHeader = false;

	for (let i = 0; i < firstLine.length; i ++) {
		if (
			( !(firstLine[i] instanceof Date) && (secondLine[i] instanceof Date) )
			||
			( !(typeof firstLine[i] === "number") && (typeof secondLine[i] === "number") )
		) {
			firstLineIsHeader = true;
			break;
		}
	}

	return firstLineIsHeader;
}

function guessDateColumn(typedRecords, fieldCount) {
	let possDateColumns = [];

	// For each column
	for (let i = 0; i < fieldCount; i ++) {
		// ...check if every field in the column is a Date
		if (typedRecords.every(record => record[i] instanceof Date)) {
			possDateColumns.push(i);
		}
	}

	if (possDateColumns.length > 0) {
		return possDateColumns[0]; // In case there is more than one, we return the first. It's only a guess!
	} else {
		return null; // No date columns
	}
}

function findHeaderMatchIndex(header, keywords) {
	// All to lowercase
	header = header.map(label => label.toLowerCase());

	for (let i = 0; i < header.length; i ++) {
		for (let keyword of keywords) {
			if (header[i] === keyword) { // Exact match
				return i;
			}
		}
	}

	for (let i = 0; i < header.length; i ++) {
		for (let keyword of keywords) {
			if (header[i].includes(keyword)) { // Inexact match but contains the keyword
				return i;
			}
		}
	}

	return null;
}

function guessAmountAndBalanceColumns(header, typedRecords, fieldCount) {
	let amountKeywords = ["amount", "value"];
	let balanceKeywords = ["balance"];
	let possColumns = [];

	// For each column
	for (let i = 0; i < fieldCount; i ++) {
		// ...check if every field in the column is a Number
		if (typedRecords.every(record => typeof record[i] === "number")) {
			possColumns.push({
				index : i
				//total : typedRecords.reduce((accum, record) => accum + record[i], 0)
			});
		}
	}

	// Sort the possible columns
	//possColumns.sort((a, b) => b.total - a.total);

	if (possColumns.length == 0) {
		return {
			amount : null,
			balance : null
		};
	} else if (possColumns.length == 1) { // Just a single number column, assume it is Amount
		return {
			amount : possColumns[0].index,
			balance : null
		};
	}

	// Otherwise try to use header labels
	return {
		amount : findHeaderMatchIndex(header, amountKeywords),
		balance : findHeaderMatchIndex(header, balanceKeywords)
	};
}

function guessDescriptionColumn(typedRecords, fieldCount) {
	let alphaCounts = new Array(fieldCount).fill(0);

	// For each column
	for (let i = 0; i < fieldCount; i ++) {
		// Count the alphabet A-Za-z characters in every string
		alphaCounts[i] = {
			index : i,
			count : typedRecords.reduce((accum, record) => {
				if (typeof record[i] === "string") {
					return accum + record[i].replace(/[^A-Za-z]/g, "").length;
				} else {
					return accum;
				}
			}, 0)
		};
	}

	alphaCounts.sort((a, b) => b.count - a.count);

	if (alphaCounts.length > 0) {
		return alphaCounts[0].index;
	} else {
		return null;
	}
}

function guessHeaders(header, typedRecords) {
	let fieldCount = typedRecords[0].length;

	return {
		date : guessDateColumn(typedRecords, fieldCount),
		...guessAmountAndBalanceColumns(header, typedRecords, fieldCount),
		description : guessDescriptionColumn(typedRecords, fieldCount)
	};
}

module.exports = function(data) {
	let lines = getLines(data);

	if (lines.length == 0) {
		throw {
			name : "NoLines",
			message : "No lines found in data"
		};
	}

	// Detect separator
	let separator = detectSeparator(lines);

	// Split lines into fields using the detected separator
	let records = splitLinesToFields(lines, separator);

	if (records.length == 0) {
		throw {
			name : "NoRecords",
			message : "No records found in data"
		};
	}

	// Check all records have the same number of fields
	for (let i = 1; i < records.length; i ++) {
		if (records[i-1].length != records[i].length) {
			throw {
				name : "FieldCountMismatch",
				message : `Not all records have the same number of fields:\n${records[i-1]}\n${records[i]}`
			};
		}
	}

	// Field counts are not zero...
	if (records[0].length == 0) {
		throw {
			name : "NoFields",
			message : "No fields found in data"
		};
	}

	// Attempt to coerce fields to various types (Date, Number)
	let typedRecords = findTypes(records);

	// Detect and remove a first line header, if present

	let header = null;

	if (detectFirstLineHeader(typedRecords)) {
		header = records[0];
		// Remove from both copies of data
		records = records.slice(1);
		typedRecords = typedRecords.slice(1);
	}

	// Guess headers
	let headerGuesses = guessHeaders(header, typedRecords);

	/*
	{
		records : [], // records, split by separator and with header line removed
		typedRecords : [], // same as above but with some fields converted to Date or Number where possible
		headerGuesses : { // if one of these could not be guessed it will be null
			date : 0,
			amount : 1,
			balance : 2,
			description : 3
		}
	}
	*/

	return {
		header,
		records,
		typedRecords,
		headerGuesses
	};
}
