const {expect} = require("chai");
const {trackFallingThreshold} = require("./threshold-trigger");
const {identity} = require("junk-bucket/fn");

describe("Falling Threshold", function () {
	describe("When only given values below the value", function () {
		it("does not trigger", function () {
			let triggered = false;
			const component = trackFallingThreshold(identity,identity, ()=> triggered = true);
			component.next(5);
			component.next(4);
			component.next(3);
			component.next(0);

			expect(triggered).to.eq(false);
		});
	});

	describe("When given a value above initial", function () {
		it("triggers", function () {
			let triggered = false;
			const component = trackFallingThreshold(identity,identity);
			component.onOutside = (v) => triggered = v;
			component.next(42);
			component.next(31415);

			expect(triggered).to.eq(31415);
		});

		describe("And the next values are between the initial threshold and new threshold", function () {
			it("does not trigger again", function () {
				let triggered = false;
				const component = trackFallingThreshold(identity,identity);
				component.onOutside = (v) => triggered = v;
				component.next(42);
				component.next(31415);
				component.next(31414);

				expect(triggered).to.eq(31415);
			});
		});
	});

	describe("When a threshold must be lower the the last sample", function () {
		it("triggers", function () {
			let triggered = false;
			const component = trackFallingThreshold(identity,(i) => i - 2);
			component.onOutside = (v)=> triggered = v;
			component.next(42);
			component.next(41);

			expect(triggered).to.eq(41);
		});
	});

	describe("When a series is equal", function () {
		it("has no values on the outside", function () {
			let triggered = false;
			const component = trackFallingThreshold(identity,identity);
			component.onOutside = (v) => triggered = v;
			component.next(16.08);
			component.next(16.08);

			expect(triggered).to.eq(false);
		});
		it("has on value on the inside", function () {
			let triggered = false;
			const component = trackFallingThreshold(identity,identity);
			component.onInside = (v) => triggered = v;
			component.next(16.08);
			component.next(16.08);

			expect(triggered).to.eq(16.08);
		});
	});
});
