// global vars to access emulator info (yeah yeah, whatevs)
var aokfp_cpu = null;

// internal var used to create unique function names
var _aokfp_n = 0;

function aokfp_resetcounter() {
	_aokfp_n = 0;
}

// returns function specialized to evaluate the given expression at
// run time, or null if it can't grok it
//
// XXX could probably express this using a nicer table
//
function aokfp_getfunc(expr) {
	var re, m;
	re = /^at:cpu@(PC|SP|A|X|Y)\(([a-f0-9]+)\)$/;
	if ((m = expr.match(re)) !== null) {
		var s = `
			this.AOK__${_aokfp_n} = function() {
				return ${m[1]} == 0x${m[2]};
			}
		`;
		aokfp_cpu.AOKevalhack(s);
		return eval(`aokfp_cpu.AOK__${_aokfp_n++}`);
	}

	// did at:cpu as a PoC, but obviously this could support more...

	return null;
}
