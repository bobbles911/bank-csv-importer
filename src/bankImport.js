import {findTypes} from "./parseTypes.js";
import guessHeaders from "./guessHeaders.js";

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

export default function(data) {
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
