
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

function findHeaderMatchIndex(header, keywords, exact = false) {
	// All to lowercase
	header = header.map(label => label.toLowerCase());

	for (let i = 0; i < header.length; i ++) {
		for (let keyword of keywords) {
			if (header[i] === keyword) { // Exact match
				return i;
			}
		}
	}

	if (!exact) {
		// Allow matching values that only contain the keyword
		for (let i = 0; i < header.length; i ++) {
			for (let keyword of keywords) {
				if (header[i].includes(keyword)) { // Inexact match but contains the keyword
					return i;
				}
			}
		}
	}

	return null;
}

function guessAmountAndBalanceColumns(header, typedRecords, fieldCount, headerKeywordMatching) {
	let amountKeywords = ["amount", "value"];
	let balanceKeywords = ["balance", "balancing"];
	let numericColumnStats = [];

	// Find the columns that contain only numbers
	// which are candidates for amount or balance columns

	for (let i = 0; i < fieldCount; i ++) {
		// ...check if every field in the column is a Number
		if (typedRecords.every(row => typeof row[i] === "number")) {
			const values = typedRecords.map(row => row[i]);

			numericColumnStats.push({
				index : i,
				values : values,

				// A column of numbers where on average, there are the same amount of positive and negative
				// numbers will have a signVariance of zero.
				// A column where most numbers are positive will have a signVariance of a high positive amount
				// Where most are negative, a lower negative number.
				/*signVariance : values.reduce((acc, cur) => {
					if (cur > 0) {
						return acc + 1;
					}
					if (cur < 0) {
						return acc - 1;
					}

					return acc;
				}, 0),*/
				//total : typedRecords.reduce((accum, record) => accum + record[i], 0)
			});
		}
	}

	// Most basic check for zero or only one numeric column

	if (numericColumnStats.length == 0) {
		return {
			amount : null,
			balance : null
		};
	} else if (numericColumnStats.length == 1) { // Just a single number column, assume it is Amount
		return {
			amount : numericColumnStats[0].index,
			balance : null
		};
	}

	let amountIndex = null;
	let balanceIndex = null;

	function removeAnySelectedColumns() {
		if (amountIndex !== null) {
			numericColumnStats = numericColumnStats.filter(stats => stats.index != amountIndex);
		}

		if (balanceIndex !== null) {
			numericColumnStats = numericColumnStats.filter(stats => stats.index != balanceIndex);
		}
	}

	if (headerKeywordMatching) {
		amountIndex = findHeaderMatchIndex(header, amountKeywords, true);
		balanceIndex = findHeaderMatchIndex(header, balanceKeywords, true);

		// Not really necessary as currently using exact matching
		if (amountIndex === balanceIndex) {
			// This can only possibly happen with findHeaderMatchIndex inexact matching
			// We nullify amountIndex as any phrase counting "balance" is more likely to be balance
			// e.g. "balance amount" would still be balance
			// I can't think of any situation where a phrase containing both words would mean the amount.
			amountIndex = null;
		}

		removeAnySelectedColumns();
	}

	// More advanced heuristics

	// Remove any columns that only contain whole numbers
	numericColumnStats = numericColumnStats.filter(stats =>
		!stats.values.every(value => Number.isInteger(value))
	);

	// Not currently using this.
	//const numericColumnStatsBySV = numericColumnStats.toSorted((a, b) => Math.abs(a.signVariance) - Math.abs(b.signVariance));

	const numericColumnStatsNoZeroes = numericColumnStats.filter(stats => !stats.values.includes(0));

	// Simply using the first numeric column with no zeroes in it works well for amount...

	if (amountIndex === null && numericColumnStatsNoZeroes.length > 0) {
		amountIndex = numericColumnStatsNoZeroes[0].index;
		removeAnySelectedColumns();
	}

	// Use the first remaining column as balance

	if (balanceIndex === null && numericColumnStats.length > 0) {
		balanceIndex = numericColumnStats[0].index;
		removeAnySelectedColumns();
	}

	return {
		amount : amountIndex,
		balance : balanceIndex
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

export default function guessHeaders(header, typedRecords, headerKeywordMatching) {
	let fieldCount = typedRecords[0].length;

	return {
		date : guessDateColumn(typedRecords, fieldCount),
		...guessAmountAndBalanceColumns(header, typedRecords, fieldCount, headerKeywordMatching),
		description : guessDescriptionColumn(typedRecords, fieldCount)
	};
}
