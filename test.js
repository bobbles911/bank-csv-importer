const fs = require("fs");
const path = require("path");
const bankImport = require("./index.js");

// Read all .csv files from /testdata
// Read previous results, compare to new results
// If no previous results, just write new results

let fileNames = fs.readdirSync("testdata");
let errors = [];

for (let fileName of fileNames) {
	if (path.extname(fileName) == ".csv") {
		let data = fs.readFileSync("testdata/" + fileName, "utf-8");

		try {
			let result = bankImport(data);
			let resultsPath = "testdata/" + path.basename(fileName, ".csv") + ".output.json";
			let typesPath = "testdata/" + path.basename(fileName, ".csv") + ".output.types.json";

			// Get types as strings. Deep copy!
			let types = [...result.typedRecords];

			for (let i = 0; i < types.length; i ++) {
				types[i] = [...types[i]];

				for (let j = 0; j < types[i].length; j ++) {
					types[i][j] = types[i][j].constructor.name;
				}
			}

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
			}
		} catch (error) {
			console.log("Error", error);
		}
	}
}

if (errors.length == 0) {
	console.log("Success, no errors.");
} else {
	console.log("ERRORS FOUND!!!");

	for (let error of errors) {
		console.log(error);
	}
}
