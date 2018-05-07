// following structure of existing Javatari JS code

jt.AOK = function() {
"use strict";

	// just for demonstration, can remove
	var t = 0;

	function init(self) {
		// if needed...?
	}

	// hook called at top of frame
	this.frame = function(state) {
		// just for demonstration, can remove
		if (t++ % (60*5) == 0) {
			// $81 should be Pitfall's PRNG seed for screen PCG
			console.info(state.ram[0x81-0x80]);
		}
	};

	// hook called at instruction dispatch point
	this.instructionDispatch = function(state) {
		// just for demonstration, can remove
		if (t++ < 50) {
			console.info(state);
		}
	};

	init(this);
};
