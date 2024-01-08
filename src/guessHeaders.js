
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

export default function guessHeaders(header, typedRecords) {
	let fieldCount = typedRecords[0].length;

	return {
		date : guessDateColumn(typedRecords, fieldCount),
		...guessAmountAndBalanceColumns(header, typedRecords, fieldCount),
		description : guessDescriptionColumn(typedRecords, fieldCount)
	};
}
