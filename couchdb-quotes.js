const {DeduplicateQuote} = require("./deduplicate-quote");

const {CouchWritable, Service} = require("junk-bucket/couchdb");
const assert = require("assert");

async function connectAndUpgrade( context, config ){
	// Build database URL
	const cluster =  new URL(config["cluster"]);
	cluster.username = config["user"];
	cluster.password = config["password"];

	// Ensure we can connect to the database
	const couchService = new Service(cluster.toString());
	const couchDataStore = await couchService.ensure_db_exists(config["database"]);

	//Ensure our view exists
	const maybeDesign = await couchDataStore.exists("_design/r0");
	if( !maybeDesign) {
		await couchDataStore.insert({
			"_id": "_design/r0",
			"views" : {
				"bySymbolTime": {
					"map" : "function(doc){ emit([doc.symbol, doc.when], doc) }"
				}
			}
		});
	}

	return couchDataStore;
}

async function dialTickerStore(context, config) {
	return {
		newQuoteWritable: async function () {
			const couchDataStore = await connectAndUpgrade(context,config);
			// Build stream components
			const couchDocumentSink = new CouchWritable(couchDataStore);
			const deduplicateQuote = new DeduplicateQuote();

			// Seed the deduplication results
			const docs = await couchDataStore.client.list({include_docs: true});
			docs.rows.forEach((d) => {
				deduplicateQuote.seed(d.doc);
			});

			deduplicateQuote.pipe(couchDocumentSink);
			return deduplicateQuote;
		}
	};
}

function timeToUTC( time ){
	return time.utc().valueOf();
}

async function createInputFactory(context, config){
	const couchDataStore = await connectAndUpgrade(context,config);

	return {
		quoteStream: async (context, symbol) => {
			assert(context);
			assert(symbol);

			return await couchDataStore.streamViewResults("r0", "bySymbolTime", {startkey: [symbol], endkey: [symbol,{}]});
		},
		history: {
			forSymbol: async (symbol, startDate, endDate ) => {
				const start = timeToUTC(startDate);
				const end = timeToUTC(endDate);

				return await couchDataStore.streamViewResults("r0", "bySymbolTime",{startkey: [symbol,start], endkey: [symbol,end]});
			}
		}
	};
}

module.exports = {
	dialTickerStore,
	createInputFactory
};
