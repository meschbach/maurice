const {Readable} = require("stream");
const allyInvestAPI = require("../../charltoons/node-ally-invest"); //FIXME: This points to a version with several things fixed

const {nope} = require("junk-bucket");
const {delay} = require("junk-bucket/future");

class AllyTimedSymbolQuery extends Readable {
	constructor(client, symbol) {
		super({
			objectMode: true
		});
		this.symbol = symbol;
		this.client = client;
		this.nextRead = 0;
	}

	_read(size) {
		this._asyncRead(size).then(nope, (e) => this.emit("error", e));
	}

	async _asyncRead( size ){
		const timeToNextRead = this.nextRead - Date.now();
		if( timeToNextRead > 0 ){
			await delay(timeToNextRead);
			return this._asyncRead(size);
		}

		this.nextRead = Date.now() + 10 * 1000;
		const responseEntity = await this.client.getMarketQuotesForSymbols({symbols:[this.symbol]});
		if( responseEntity.response.error !== 'Success'){
			throw new Error("Response error: " + responseEntity.error);
		}
		const quote = responseEntity.response.quotes.quote;
		quote.last = parseFloat(quote.last);
		this.push(quote);
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
	const allyInvest = new allyInvestAPI(clientConfiguration);
	allyInvest.setResponseType('json');

	return {
		quoteStream: (symbol) => new AllyTimedSymbolQuery(allyInvest, symbol)
	};
}

module.exports = {
	createInputFactory
};
