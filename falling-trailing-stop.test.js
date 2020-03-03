const {expect} = require("chai");
const {Writable} = require("stream");

const {FallingThreshold} = require("./threshold-trigger");
const {identity} = require("junk-bucket/fn");
const {nope} = require("junk-bucket");

class FallingTrailingObserver extends Writable {
	constructor( constTolerance ) {
		super({
			objectMode:true
		});
		this.threshold = new FallingThreshold((quote) => quote.last, (last) => last + constTolerance );
		this.threshold.onInside = (quote) => {
			this.emit("inside", quote);
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

describe("Falling Trailing Stop",function () {
	describe("Given a series of falling symbol", function () {
		it("reports withinThreshold events", function () {
			const inside = [];

			const observer = new FallingTrailingObserver(0);
			observer.on("inside", (e) => inside.push(e));
			observer.write({ symbol: "TEST", last: 17.00 });
			observer.write({ symbol: "TEST", last: 16.90 });
			observer.write({ symbol: "TEST", last: 16.70 });
			observer.write({ symbol: "TEST", last: 16.69 });
			expect(inside.length).to.eq(3);
		});
	});
	describe("Given a series of growing values", function () {
		it("reports outside events", function () {
			const outside = [];

			const observer = new FallingTrailingObserver(0);
			observer.on("outside", (e) => outside.push(e));
			observer.write({ symbol: "TEST", last: 17.00 });
			observer.write({ symbol: "TEST", last: 17.10 });
			observer.write({ symbol: "TEST", last: 17.30 });
			observer.write({ symbol: "TEST", last: 17.69 });
			expect(outside.length).to.eq(3);
		});
	});

	describe("Given a series of steady values", function () {
		it("reports withinThreshold events", function () {
			const inside = [];

			const observer = new FallingTrailingObserver(0);
			observer.on("inside", (e) => inside.push(e));
			observer.write({ symbol: "TEST", last: 17.00 });
			observer.write({ symbol: "TEST", last: 17.00 });
			observer.write({ symbol: "TEST", last: 17.00 });
			expect(inside.length).to.eq(2);
		});
	});

	describe("Given a hook", function () {
		it("reports correct inside count", function () {
			const inside = [];

			const observer = new FallingTrailingObserver(0);
			observer.on("inside", (e) => inside.push(e));
			observer.write({ symbol: "TEST", last: 42.76 });
			observer.write({ symbol: "TEST", last: 42.75 });
			observer.write({ symbol: "TEST", last: 42.73 });
			observer.write({ symbol: "TEST", last: 42.76 });
			expect(inside.length).to.eq(2);
		});

		it("reports correct outside count", function () {
			const outside = [];

			const observer = new FallingTrailingObserver(0);
			observer.on("outside", (e) => outside.push(e));
			observer.write({ symbol: "TEST", last: 42.76 });
			observer.write({ symbol: "TEST", last: 42.75 });
			observer.write({ symbol: "TEST", last: 42.73 });
			observer.write({ symbol: "TEST", last: 42.76 });
			expect(outside.length).to.eq(1);
		});
	});
});
