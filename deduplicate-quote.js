const {Transform} = require("stream");

class DeduplicateQuote extends Transform {
	constructor() {
		super({
			objectMode: true
		});
		this._instrumentCache = {};
	}

	seed(quote){
		function isSame(lastQuote) {
			return lastQuote.symbol === quote.symbol
				&& lastQuote.last.when === quote.last.when
				&& lastQuote.ask.when === quote.ask.when
				&& lastQuote.bid.when === quote.bid.when
		}

		const symbol = quote.symbol;
		const lastQuote = this._instrumentCache[symbol];
		if( !lastQuote ) {
			this._instrumentCache[symbol] = quote;
			return true;
		}
		if( isSame(lastQuote) ){
			return false;
		}
		this._instrumentCache[symbol] = quote;
		return true;
	}

	_transform(quote, encoding, callback) {
		if( this.seed(quote) ){
			callback(null,quote);
		} else {
			callback(null);
		}
	}
}

module.exports = {
	DeduplicateQuote
};
