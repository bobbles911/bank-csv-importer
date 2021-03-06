The goal of this project is to be able to import any exported CSV data from any bank account into a standard format, with everything such as CSV separator and column headings auto-detected. It's a work in progress. Please try it, and if some CSV file doesn't work for you, let me know.

## Example
```
const bankImport = require("bank-csv-importer");

let result = bankImport(csvText); // May throw an error if input text is malformed
console.log(result);
```

After importing a CSV file, the result is:

```
{
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
