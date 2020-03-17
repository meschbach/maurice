const {readFile} = require("junk-bucket/fs");
const {service, loadModule} = require("./junk");
const {parallel} = require("junk-bucket/future");

service("historical-store",async (processContext) => {
	// Figure out configuration file name
	const actualArguments = process.argv.slice(2);
	const configFileName = actualArguments.length > 0 ? actualArguments[0] : "store-quotes.json";

	// Load configuration file
	const desiredConfigText = await readFile(configFileName);
	const desiredConfig = JSON.parse(desiredConfigText);

	// Extract the watch configuration
	const watchConfig = desiredConfig["watch"];
	const watchInput = watchConfig["input"];
	const watchOutput = watchConfig["output"];

	// Load input module
	const inputCache = {};
	const quoteInputs = await loadModule(processContext,
		"input", inputCache, watchInput,
		desiredConfig["inputs"], "createInputFactory");

	// Create target sink
	const outputCache = {};
	const quoteStorage = await loadModule(processContext,
		"output", outputCache, watchOutput,
		desiredConfig["outputs"], "dialTickerStore");

	// Create target stream
	const output = await quoteStorage.newQuoteWritable();
	output.setMaxListeners(0); //Waffling on disabling this (set to 0) or setting to the number of symbols we will watch

	// Create a new ticker stream for each desired instrument
	await parallel(watchConfig["symbols"].map(async (symbol) => {
		const tickerStream = quoteInputs.quoteStream(processContext,symbol);
		tickerStream.pipe(output);
		processContext.onCleanup(() => tickerStream.destroy());
	}));
	processContext.logger.info("Completed, pumping symbols to cache");
});
