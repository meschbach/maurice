const {main} = require("junk-bucket");
const {Context} = require("junk-bucket/context");
const {readFile} = require("junk-bucket/fs");

const {FallingTrailingObserver} = require("./threshold-trigger");
const {loadModule, service} = require("./junk");

service("Maurice", async (context) => {
	// Report version
	const pkg = require("./package");
	context.logger.info("Maurice", {version: pkg.version});

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
		observer.on("outside", (quote, lastThreshold) => {
			notifyTarget.notify(symbol + " exceed threshold @ " + quote.bid.price + " from " + lastThreshold.toFixed(3));
		});
		const quoteStream  = tickerSource.quoteStream(context, symbol);
		quoteStream.pipe(observer).on("error",(e) => {
			context.logger.error("Pipeline error: ", e);
			notifyTarget.notify("Encountered error: " + e.message);
		});
		context.onCleanup(() => {
			quoteStream.destroy();
			observer.end();
		});
	}
});
