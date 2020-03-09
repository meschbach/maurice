const assert = require("assert");
const querystring = require('querystring');
const {Readable,Transform} = require("stream");

const moment = require("moment");
const _momentTZ = require("moment-timezone"); //Needed to enhance `moment` with time zone awareness

const {AllyInvestClient} = require("maurice-ally-invest"); //FIXME: This points to a version with several things fixed

const {nope} = require("junk-bucket");
const {delay} = require("junk-bucket/future");

class AllyTimedSymbolQuery extends Readable {
	constructor(reactor, symbol ) {
		super({
			objectMode: true
		});
		this.symbol = symbol;
		this.reactor = reactor;
		this._adapter = (q) => {
			if( q.symbol === symbol ){
				this.push(q);
			}
		};
		this._registered = false;
	}

	_read(size) {
		if( this._registered ) {
			return;
		}
		this._registered = true;

		this.reactor.watch(this.symbol);
		this.reactor.on("quote", this._adapter);
	}

	_destroy(error, callback) {
		if( !this._registered ){ return callback(); }

		this.reactor.off("quote", this._adapter);
		callback();
	}
}

function internalizeRelativeTime(shortTime){  //TODO: Time assumes current date (should be right during market times)
	const parts = shortTime.split(":");
	const time = moment();
	time.tz("America/New_York");
	time.set('hour', parts[0]);
	time.set('minute', parts[1]);
	time.set('seconds', 0);
	time.set('milliseconds', 0);
	return time.utc().valueOf();
}

/**
 * Converts the Ally FIXML structure into a quote matching the internalize Maurice representation.
 */
class InternalizedQuote extends Transform {
	constructor() {
		super({
			objectMode: true
		});
	}

	_transform(quote, encoding, callback) {
		if( quote.secclass != 0 && quote.secclass != 1 ){
			throw new Error("Unknown security class " + quote.secclass);
		}
		const instrument = quote.secclass == 0 ? {
			type: "stock",
			symbol: quote.symbol
		} : {
			type: "option",
			symbol: quote.symbol,
			strike: parseFloat(quote.strikeprice),
			side: quote.put_call == "CALL" ? "call" : "put",
			bundle: parseInt(quote.contract_size),
			expiry: {
				year: parseInt(quote.xyear),
				month: parseInt(quote.xmonth),
				day: parseInt(quote.xday)
			},
			underlying: {
				symbol: quote.rootsymbol
			}
		};

		const frame = {
			last: {
				price: parseFloat(quote.last),
				when: new Date(quote.datetime).getTime()
			},
			ask:{
				price: parseFloat(quote.ask),
				when: internalizeRelativeTime(quote.ask_time),
				size: parseInt(quote.asksz)
			},
			bid: {
				price: parseFloat(quote.bid),
				when: internalizeRelativeTime(quote.bid_time),
				size: parseInt(quote.bidsz)
			},
			low: parseFloat(quote.lo),
			high: parseFloat(quote.hi),
			symbol: quote.symbol,
			instrument,
			when: parseInt(quote.timestamp) * 1000
		};
		callback(null, frame);
	}
}

const {EventEmitter} = require("events");
class QuoteAggregator extends EventEmitter{
	constructor(client, periodInSeconds) {
		super();
		this.client = client;
		this.periodInSeconds = periodInSeconds;
		this.watching = [];
		this.running = false;
	}

	watch(symbol){
		this.watching.push(symbol);
		return this;
	}

	unwatch(symbol){
		this.watching = this.watching.filter((s) => s != symbol);
	}

	start(){
		if( this.running ) return;
		this.running = true;

		const doIntervalTick = () => {
			if( !this.running ){
				clearInterval(this.intervalToken);
			}
			if( this.watching.length == 0 ){
				return;
			}
			this.client.getMarketQuotesForSymbols({symbols:this.watching}).then((responseEntity) => {
				if( responseEntity.response.error !== 'Success'){
					throw new Error("Response error: " + responseEntity.error);
				}
				const quote = responseEntity.response.quotes.quote;
				if( quote.length ){
					quote.forEach((q) => {
						this.emit("quote", q);
					});
				} else {
					this.emit("quote", quote);
				}
			});
		};
		const intervalToken = setInterval(doIntervalTick, this.periodInSeconds * 1000 );
		this.intervalToken = intervalToken;
		doIntervalTick();
	}

	stop() {
		if( !this.running ){ return;}
		this.running = false;
		clearInterval(this.intervalToken);
	}
}

async function createInputFactory(context, allyInvestConfig){
	// Setup key/secret for authentication and API endpoint URL
	const clientConfiguration = {
		consumerKey: allyInvestConfig.consumer.key,
		consumerSecret: allyInvestConfig.consumer.secret,
		oauthToken: allyInvestConfig.oauth.token,
		oauthTokenSecret: allyInvestConfig.oauth.secret,
	};
	const allyInvest = new AllyInvestClient(clientConfiguration);
	allyInvest.setResponseType('json');
	const aggregator = new QuoteAggregator(allyInvest, 5);
	aggregator.start();
	context.onCleanup(() => aggregator.stop());

	return {
		quoteStream: (context, symbol) => {
			assert(context);
			assert(symbol);
			const generatingStream = new AllyTimedSymbolQuery(aggregator, symbol);
			context.onCleanup(() => generatingStream.destroy());
			const internalizer = new InternalizedQuote();
			generatingStream.pipe(internalizer);
			return internalizer;
		},
		history: {
			forSymbol: async (symbol, startDate, endDate ) => {
				const queryParameters = {
					symbols: symbol,
					interval: "5min",
					startdate: startDate,
					endate: endDate
				};
				const stringQueryParameters = querystring.stringify(queryParameters);
				const result = await allyInvest._getApiEndPoint("market/timesales", stringQueryParameters);
				return result.response.quotes.quote;
			}
		}
	};
}

module.exports = {
	createInputFactory,
	QuoteAggregator
};
