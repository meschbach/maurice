const {nope} = require("junk-bucket");
const {Writable} = require("stream");

/**
 * Provides a function which will alert the trigger when the values begin to climb above a threshold.
 *
 * @param valueFn a function to extract a value from a record
 * @param calcThreshold calculates a new threshold based on a value
 * @param triggerFn the function to be notified on a change
 * @returns {function(...[*]=)} a function to be fed values
 */
function trackFallingThreshold( valueFn, calcThreshold ) {
	return new FallingThreshold(valueFn, calcThreshold);
}

class FallingThreshold {
	constructor( valueFn, newThreshold ) {
		this.onInside = nope;
		this.onOutside = nope;

		this.valueFromRecord = valueFn;
		this.calcThreshold = newThreshold;

		this._nextStrategy = (record) => {
			this.threshold = this.calcThreshold(this.valueFromRecord(record), record);
			this._nextStrategy = (record) => {
				const value = this.valueFromRecord(record);
				if( value <= this.threshold ){
					this.threshold = this.calcThreshold(value,record);
					this.onInside(record, this.threshold);
				} else if( value > this.threshold ){
					this.onOutside(record, this.threshold);
				}
			}
		};
	}

	next( record ){
		this._nextStrategy(record);
	}
}

class FallingTrailingObserver extends Writable {
	constructor( constTolerance ) {
		super({
			objectMode:true
		});
		this.threshold = new FallingThreshold((quote) => quote.last, (last) => last + constTolerance );
		this.threshold.onInside = (quote, threshold) => {
			this.emit("inside", quote, threshold);
		};
		this.threshold.onOutside = (quote) => {
			this.emit("outside", quote);
		};
	}

	_write(quote,encoding,cb){
		this.threshold.next(quote);
		cb();
	}
}

module.exports = {
	trackFallingThreshold,
	FallingThreshold,
	FallingTrailingObserver
};
