// following structure of existing Javatari JS code

jt.AOK = function(emu) {
    "use strict";

	// just for demonstration, can remove
	var t = 0;

	  function init(self) {
        function matches(a, pat) {
            //TODO: replace with a compiled regex later
            if(pat % 1 === 0) {
                return a == pat || (a == true && pat == 1) || (a == false && pat == 0);
            } else if(Array.isArray(pat)) {
                for(var i = 0; i < pat.length; i++) {
                    if(matches(a, pat[i])) {
                        return true;
                    }
                }
                return false;
            } else {
                return (a & pat.inBits) == pat.inBits &&
                    (a & pat.outBits) == 0;
            }
        }
        function hexToCode(str) {
            assert(str.length == 2);
            return parseInt(str,16);
        }
        function decToCode(str) {
            var num = parseInt(str,10);
            return num;
        }
        function charCodesMatching(bitstr) {
            // "\xFF"
            assert(bitstr.length == 8);
            var i;
            var dontcareMask = 0;
            var inMask = 0;
            var outMask = 0;
            for(i = 0; i < bitstr.length; i++) {
                if(bitstr[i] == "-") {
                    dontcareMask |= 1 << (7-i);
                } else if(bitstr[i] == "1") {
                    inMask |= 1 << (7-i);
                } else if(bitstr[i] == "0") {
                    outMask |= 1 << (7-i);
                } else {
                    assert(false);
                }
            }
            return {inBits:inMask, outBits:outMask};
        }
        
        var memoryAnalysisContext = {
            tokens: [
                {
                    type:"at",
                    match: /^at:([a-zA-Z_0-9]+)(\+[0-9A-z_]+)?\(([^)]+)\)/,
                    value: function(matchResult) {
                        var memBlock = matchResult[1];
                        var offset = null;
                        if(matchResult[2]) {
                            var offsetStr = matchResult[1].substr(1);
                            var isNumeric = false;
                            var actualOffset = offsetStr;
                            if(offsetStr.match(/^0x([0-9a-fA-F_]+)$/)) {
                                isNumeric = true;
                                actualOffset = parseInt(offsetStr.substr(2).replace("_",""), 16);
                            } else if(offsetStr.match(/^[0-9]+$/)) {
                                isNumeric = true;
                                actualOffset = parseInt(offsetStr, 10);
                            }
                            offset = {
                                numeric: isNumeric,
                                actualOffset: actualOffset
                            };
                        }
                        var pattern = [];
                        var patternStr = matchResult[2];
                        var inSet = false;
                        while(patternStr.length) {
                            //patterns can be hex digits, unums, masks, or [] unions of those
                            var r = null;
                            if((r = patternStr.match(/^[0-9A-Fa-f _]{2}/))) {
                                pattern.push(hexToCode(r[0].replace("_","").replace(" ","")));
                                patternStr = patternStr.substr(r[0].length);
                            } else if((r = patternStr.match(/^u([0-9]+)/))) {
                                assert(parseInt(r[1],10) < 256);
                                pattern.push(decToCode(r[1]));
                                patternStr = patternStr.substr(r[0].length);
                            } else if((r = patternStr.match(/^m([01\-]{8})/))) {
                                var sets = charCodesMatching(r[1]);
                                if(inSet) {
                                    pattern[pattern.length-1].push(sets);
                                } else {
                                    pattern.push(sets);
                                }
                                patternStr = patternStr.substr(r[0].length);
                            } else if(patternStr[0] == "[") {
                                inSet = true;
                                pattern.push([]);
                                patternStr = patternStr.substr(1);
                            } else if(patternStr[0] == "]") {
                                assert(inSet == true);
                                inSet = false;
                                patternStr = patternStr.substr(1);
                            } else if(patternStr.match(/[\s_]/)) {
                                patternStr = patternStr.substr(1);
                            } else {
                                assert(false);
                            }
                        }
                        return {
                            block:memBlock,
                            offset:offset,
                            pattern:pattern
                        };
                    },
                    startParse: Playspecs.Parser.parseValue
                }
            ],
            trace: {
                start: function (traceData) {
                    return {data: traceData, index: 0};
                },
                currentState: function (trace) {
                    return trace.data[trace.index];
                },
                advanceState: function (trace) {
                    if (trace.index < trace.data.length - 1) {
                        trace.index++;
                    }
                },
                isStreaming: function(trace) {
                    //TODO: return false if the game is off?
                    return true;
                },
                isAtEnd: function (trace) {
                    // Is it at the last safe index? Note this isn't "isPastEnd"!
                    return trace.index >= trace.data.length - 1;
                }
            },
            checks: {
                "at": function(trace, state, idx, atNode) {
                    var memblk = state[atNode.memBlock];
                    var off = 0;
                    if(atNode.offset.isNumeric) {
                        off = atNode.offset.actualOffset;
                    } else {
                        memblk = memblk[atNode.offset];
                    }
                    var pat = atNode.pattern;
                    var end = memblk.length;
                    // TODO: replace with a one-pass version that searches; for now implicitly anchor on both sides
                    end = off+1;
                    for(var i = off; i < end; i++) {
                        if(matches(memblk[i],pat[0])) {
                            var match = true;
                            for(var j = i+1; j < i + pat.length; j++) {
                                if(!matches(memblk[j],pat[j-i])) {
                                    match = false;
                                    break;
                                }
                            }
                            if(match) {
                                //TODO: return the match location, update playspecs to support this
                                return true;
                            }
                        }
                    }
                    //TODO: don't use constant strings, use regex on bytes
                    return null;
                }
            }
        };
	  }

	  // hook called at top of frame
	  this.frame = function(state) {
		    // just for demonstration, can remove
        this.frames.push(state);
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
