import fs from "fs";
import path from "path";
import bankImport from "./index.js";

// Read all .csv files from /testdata
// Read previous results, compare to new results
// If no previous results, just write new results

let errors = [];

function getTypes(typedRecords) {
	// Get types as strings. Deep copy!
	let types = [...typedRecords];

	for (let i = 0; i < types.length; i ++) {
		types[i] = [...types[i]];

		for (let j = 0; j < types[i].length; j ++) {
			types[i][j] = types[i][j].constructor.name;
		}
	}

	return types;
}

function testdir(dirPath) {
	let fileNames;

	try {
		fileNames = fs.readdirSync(dirPath);
	} catch (error) {
		if (error.code == "ENOENT") {
			console.log(`Directory "${dirPath}" not found, skipping...`);
			return;
		} else {
			throw error;
		}
	}

	console.log(`Testing csv files in directory "${dirPath}"...`);

	for (let fileName of fileNames) {
		if (path.extname(fileName) == ".csv") {
			const testDataPath = path.join(dirPath, fileName);
			const expectedPath = path.join(dirPath, path.basename(fileName, ".csv") + ".expected.json");

			let data = fs.readFileSync(testDataPath, "utf-8");

			let result = bankImport(data, {headerKeywordMatching : true});
			let resultNoKeywords = bankImport(data, {headerKeywordMatching : false});

			let resultsPath = path.join(dirPath, "output", path.basename(fileName, ".csv") + ".output.json");
			let typesPath = path.join(dirPath, "output", path.basename(fileName, ".csv") + ".output.types.json");
			let resultsPathFailed = path.join(dirPath, "output", path.basename(fileName, ".csv") + ".output.TEST_FAILED.json");
			let typesPathFailed = path.join(dirPath, "output", path.basename(fileName, ".csv") + ".output.types.TEST_FAILED.json");

			// Get types as strings
			let types = getTypes(result.typedRecords);

			// Stringify
			let resultString = JSON.stringify(result, null, "\t");
			let typesString = JSON.stringify(types, null, "\t");

			// Write complete results (if didn't previously)
			if (!fs.existsSync(resultsPath)) {
				fs.writeFileSync(resultsPath, resultString);
				console.log("Warning, wrote new results as didn't exist", resultsPath);
			}

			// Write only the types (if didn't previously)
			if (!fs.existsSync(typesPath)) {
				fs.writeFileSync(typesPath, typesString);
				console.log("Warning, wrote new types as didn't exist", typesPath);
			}

			// Compare new results to old, cached results!

			let prevResult = fs.readFileSync(resultsPath, {encoding : "utf8"});
			let prevTypes = fs.readFileSync(typesPath, {encoding : "utf8"});

			if (resultString !== prevResult || typesString !== prevTypes) {
				errors.push("Mismatch with data file " + fileName);

				if (resultString !== prevResult) {
					console.log("Writing failed new results to", resultsPathFailed);
					fs.writeFileSync(resultsPathFailed, resultString);
				}

				if (typesString !== prevTypes) {
					fs.writeFileSync(typesPathFailed, typesString);
					console.log("Writing failed new types to", typesPathFailed);
				}
			}

			// Compare the expected data to the actual parsed data
			try {
				const expected = JSON.parse(fs.readFileSync(expectedPath, {encoding : "utf8"}));

				// Compare if entire columns match the type given by expected.entireRowTypes array
				result.typedRecords.forEach((row, index) => {
					for (let i = 0; i < expected.entireRowTypes.length; i ++) {
						if (expected.entireRowTypes[i] === null) {
							continue; // skip null
						}

						if (row[i].constructor.name !== expected.entireRowTypes[i]) {
							errors.push(`Expected entire row type mismatch: ${testDataPath}: `
								+ "Expected " + expected.entireRowTypes[i] + " but got: "
								+ `"${row[i]}" (${row[i].constructor.name})`
								+ `\n	Column: ${i}`
								+ `\n	Row: ${index}: ${row}`);
						}
					}
				});

				// Compare if header guesses match
				for (let [headerGuessName, index] of Object.entries(expected.headerGuesses)) {
					if (index === null) {
						continue; // skip null
					}

					// Header guess index of result must equal that of expected
					if (result.headerGuesses[headerGuessName] !== index) {
						errors.push(`Expected header guess mismatch: ${testDataPath}: `
							+ `Expected ${headerGuessName} at index ${index} but got index `
							+ result.headerGuesses[headerGuessName]);
					}

					// For informational purposes, also show the mismatches when keywords are not used
					if (resultNoKeywords.headerGuesses[headerGuessName] !== index) {
						console.log(`	(info) Expected header guess mismatch when no keywords were used: `
							+ `${testDataPath}: `
							+ `Expected ${headerGuessName} at index ${index} but got index `
							+ resultNoKeywords.headerGuesses[headerGuessName]);
					}
				}
			} catch (error) {
				if (error.code == "ENOENT") {
					console.log("Warning: data expected file did not exist, skipping", expectedPath);
				} else {
					throw error;
				}
			}
		}
	}
}

testdir("testdata");
testdir("testdata-private");

if (errors.length == 0) {
	console.log("\nSuccess, no errors.");
} else {
	console.log("\nERRORS FOUND!!!");

	for (let error of errors) {
		console.log(error);
	}

	process.exit(1);
}
