const {main} = require("junk-bucket");
const {Context} = require("junk-bucket/context");
const {readFile} = require("junk-bucket/fs");

const {FallingTrailingObserver} = require("./threshold-trigger");
const {ConsoleLogger} = require("./junk");

async function loadModule( context, contextName, moduleCache, moduleName, modelConfig, defaultInitName ){
	if( moduleCache[moduleName] ){
		return moduleCache[moduleName];
	}

	const matchingConfigs = modelConfig.filter((c) => c.name == moduleName );
	if( matchingConfigs.length != 1 ) {
		context.logger.error("Could not find output module", notifyName, modelConfig);
		throw new Error("Expected an input by name of " + notifyName + ", got " + remaining.length);
	}

	const moduleDescriptor = matchingConfigs[0];
	const loadedModule = require(moduleDescriptor.module);
	const config = moduleDescriptor.config;

	const moduleContext = context.subcontext(contextName);
	const initFn = loadedModule[moduleDescriptor.initializer || defaultInitName];
	if (!initFn) {
		throw new Error("Module initializer is falsy for " + contextName);
	}
	const initializedModule = await initFn(moduleContext, config);
	moduleCache[moduleName] = initializedModule;
	return initializedModule;
}

main(async (l) => {
	// Report version
	const pkg = require("./package");
	l.info("Maurice", {version: pkg.version});

	// Build process context
	const context = new Context("Maurice", l);

	// Figure out configuration file name
	const actualArguments = process.argv.slice(2);
	const configFileName = actualArguments.length > 0 ? actualArguments[0] : "config.json";

	// Load configuration file
	const desiredConfigText = await readFile(configFileName);
	const desiredConfig = JSON.parse(desiredConfigText);
	const loadedTickers = {};
	const loadedNotifications = {};

	for(const watchingAsset of desiredConfig.watch ){
		if( watchingAsset.type != "falling-trail") {
			throw new Error("Unsupported type: " + asset.type);
		}

		const tickerSourceName = watchingAsset["ticker-source"];
		if( !tickerSourceName ){ throw new Error("ticker source may not be null"); }
		const tickerSource = await loadModule(context, "input:"+tickerSourceName,
			loadedTickers, tickerSourceName,
			desiredConfig["inputs"], "createInputFactory");


		const notifyName = watchingAsset["notify"];
		const notifyTarget = await loadModule(context, "notify:"+notifyName,
			loadedNotifications, notifyName,
			desiredConfig["outputs"], "createNotificationFactory");

		//Create algorithm for watching
		const symbol = watchingAsset.symbol;
		const observer = new FallingTrailingObserver(parseFloat(watchingAsset.constThreshold));
		let lastReportedThreshold;
		observer.on("inside", (quote, threshold) => {
			if( lastReportedThreshold === undefined ){
				lastReportedThreshold = threshold;
				notifyTarget.notify(symbol + " starting threshold @ " + threshold.toFixed(3));
			} else if( lastReportedThreshold > threshold) {
				notifyTarget.notify(symbol + " threshold @ " + threshold.toFixed(3) + " from " + lastReportedThreshold.toFixed(3));
				lastReportedThreshold = threshold;
			}
		});
		observer.on("outside", (quote, threshold) => {
			notify.notify(symbol + " exceed threshold @ " + quote.last);
			context.cleanup();
		});
		tickerSource.quoteStream(symbol).pipe(observer).on("error",(e) => {
			context.logger.error("Pipeline error: ", e);
			notifyTarget.notify("Encountered error: " + e.message);
		});
	}
}, new ConsoleLogger());
