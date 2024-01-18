The goal of this project is to be able to import any exported CSV (comma or semi colon separated) data from any bank account into a standard format, with everything such as CSV separator and column headings auto-detected. It's a work in progress. Please try it, and if some CSV file doesn't work for you, let me know.

## Example
```
const bankImport = require("bank-csv-importer");

let result = bankImport(csvText); // May throw an error if input text is malformed
console.log(result);
```

After importing a CSV file, the result is:

```
{
	header, // The header row, if one was present and it was autodetected. null if not present.
	records : [], // records, split by separator and with header line removed
	typedRecords : [], // same as above but with some fields converted to Date or Number where possible
	headerGuesses : { // if any of these could not be guessed it will be null
		date : 0,
		amount : 1,
		balance : 2,
		description : 3
	}
}
```

Also some parse* functions are exported, which can be useful if you don't want to rely on typedRecords.

```
const {parseNumber, parseDate} = require("bank-csv-importer");

// Return null if could not be parsed
// parseDate uses "any-date-parser" and will greedily parse a lot of things as dates, so it's best to use parseNumber first,
// and if that fails, try parseDate.
console.log(parseNumber("1.123"));
console.log(parseDate("1/1/2021"));
```