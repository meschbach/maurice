const {readFile} = require("junk-bucket/fs");
const {service, loadModule, LoggingWritable} = require("./junk");
const {parallel} = require("junk-bucket/future");
const assert = require("assert");

service("watch-quotes",async (processContext) => {
	// Figure out configuration file name
	const actualArguments = process.argv.slice(2);
	const configFileName = actualArguments.length > 0 ? actualArguments[0] : "watch-quotes.json";

	// Load configuration file
	const desiredConfigText = await readFile(configFileName);
	const desiredConfig = JSON.parse(desiredConfigText);

	// Extract the watch configuration
	const watchConfig = desiredConfig["watcher"];
	const watchInput = watchConfig["input"];

	// Load input module
	const inputCache = {};
	const quoteInputs = await loadModule(processContext,
		"input", inputCache, watchInput,
		desiredConfig["inputs"], "createInputFactory");

	// Create target stream
	const source = await quoteInputs.quoteStream(processContext, watchConfig["symbol"]);
	const output = new LoggingWritable(processContext.logger);
	source.pipe(output);
});
