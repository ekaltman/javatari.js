// following structure of existing Javatari JS code

jt.AOK = function(emu) {
    "use strict";

    function assert(b) {
        if(!b) {
            console.error("Assertion failed",b);
            throw "Assertion failed";
        }
    }

    var memoryAnalysisContext = {
        tokens: [
            {
                type:"at",
                match: /^at:([a-zA-Z_0-9]+)(@[0-9A-z_]+)?\((!?)([^)]+)\)/,
                // Examples:
                // at:mem@0x20(AF029F)
                // at:cpu@A(u128)
                // at:mem(s-12 DED8 m0--10--- [m1000---- m0---100- FF u35])
                // at:mem(.* (DED8) .*) (not allowed yet)
                // at:mem+0x80(00), at:mem+80(01), at:mem+80(02)
                // (at:mem+0x80(00) & at:mem+FF(u10)), ..., at:mem+80(FF))
                // TODO: allow for anchoring exactly at an offset.
                value: function(matchResult) {
                    var memBlock = matchResult[1];
                    var offset = null;
                    if(matchResult[2]) {
                        var offsetStr = matchResult[2].substr(1);
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
                    var isAnchored = matchResult[3] == "!";
                    var pattern = [];
                    var patternStr = matchResult[4];
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
                        pattern:pattern,
                        anchored:isAnchored
                    };
                },
                startParse: Playspecs.parseValue
            }
        ],
        trace: {
            start: function (traceData) {
                return {index: -1, consumed:true};
            },
            isReady: function(trace) {
                return trace.index > -1;
            },
            currentState: function (trace) {
                return self.currentState;
            },
            advanceState: function (trace) {
                if(!trace.consumed) {
                    trace.index += 1;
                    trace.consumed = true;
                }
            },
            copyState: function(trace) {
                if(!self.copyIsCurrent) {
                    emu.aokSaveState(self.currentCopy);
                    self.copyIsCurrent = true;
                }
                return self.currentCopy;
            },
            isStreaming: function(trace) {
                //TODO: return false if the game is off?
                return true;
            },
            isAtEnd: function (trace) {
                return trace.consumed;
            }
        },
        checks: {
            "at": function(trace, state, idx, atNode) {
                // console.log(state);
                var memblk = state[atNode.value.block];
                var off = 0;
                if(atNode.value.offset.isNumeric) {
                    off = atNode.value.offset.actualOffset;
                } else {
                    memblk = memblk[atNode.value.offset.actualOffset];
                }
                var pat = atNode.pattern;
                var end = memblk.length;
                if(atNode.isAnchored) {
                    end = off+1;
                }
                for(var i = off; i < end; i++) {
                    if(bmatches(memblk[i],pat[0])) {
                        var match = true;
                        for(var j = i+1; j < i + pat.length; j++) {
                            if(!bmatches(memblk[j],pat[j-i])) {
                                match = false;
                                break;
                            }
                        }
                        if(match) {
                            return {node:atNode, offset:i};
                        }
                    }
                }
                //TODO: don't use constant strings, use regex on bytes
                return null;
            }
        }
        };

    function emptyState() {
        return {'tia':null, 'ram':null, 'cpu':null};
    }
    
    function init(self) {
        self.checked_specs = [];
        self.currentState = emptyState();
        self.currentCopy = emptyState();
        self.copyIsCurrent = false;
        self.checks = [];
        self.matches = [];
        return self;
    }

    function bmatches(a, pat) {
        //TODO: replace with a compiled regex later
        if(pat % 1 === 0) {
            return a == pat || (a == true && pat == 1) || (a == false && pat == 0);
        } else if(Array.isArray(pat)) {
            for(var i = 0; i < pat.length; i++) {
                if(bmatches(a, pat[i])) {
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

    // hook called at instruction dispatch point
    this.instructionDispatch = function(state) {
        self.currentState = state;
        for(var i = 0; i < self.checks.length; i++) {
            if(self.checks[i].state.trace.index == -1) {
                // console.log("start with state",state);
                self.checks[i].state.trace.index = 0;
                self.checks[i].state.trace.consumed = false;
            }
            self.checks[i] = self.checks[i].next();
            if(self.checks[i].match) {
                self.processMatch(i, self.checks[i]);
            }
            // console.log("consume");
            self.checks[i].state.trace.consumed = true;
        }
        self.copyIsCurrent = false;
    };

    // hook called at top of frame; move contents of instructionDispatch in here
    // if you want to work on frames instead of ticks or maybe use it to add a
    // frame counter?
    this.frame = function(state) {
        
    };

    // Call this to make this instance of AOK start matching the given traces.
    // TODO AOK: You probably want to call it before the emulator starts!
    this.startMatching = function(playspec_strings) {
        //atomic formula syntax for "scan through memory region for pattern":
        //at:MEM@OFF(ANCHOR PAT+)
        //Where:
        //  MEM: tia | cpu | mem
        //  OFF (optional): register_name | 0xOffset [beginning of search]
        //  ANCHOR (optional): !, force match to be exactly at MEM+OFF.
        //  PAT: HEXPAIR | UNSIGNED | MASK | SET
        //    HEXPAIR: two hex digits
        //    UNSIGNED: unsigned decimal value prefixed with 'u'
        //    MASK: 'm' followed by 8 characters from the set {0,1,-}.  0 means "the byte being matched must be 0 here", 1 means it must be 1, and - means "don't care".  ex: m0010---- to check some high bits.
        //    SET: [ PAT+ ] to check the disjunction of several patterns
        //    Whitespace and underscores are ignored.
        //the check results will tell you where the pattern was matched, which is better than nothing!
        //for the full playspecs syntax please see the AIIDE paper or the playspecs doc/ folder.
        self.currentState = emptyState();
        self.copyIsCurrent = false;
        self.copyState = emptyState();
        self.matches = [];
        self.checks = [];
        for(var i = 0; i < playspec_strings.length; i++) {
            self.checks.push((new Playspecs.Playspec(playspec_strings[i], memoryAnalysisContext)).match(null, "explicit"));
            self.matches.push([]);
        }
    };

    // Implement this however you like to handle matches.
    // Probably best to not use a "matches" list like this,
    // just flag them however you want.  This is just for illustration.
    this.processMatch = function(idx, checkResult) {
        this.matches[idx].push(checkResult.match);
    };
    // var ps = (new Playspecs.Playspec("at:cpu@A(u128)",
	  // memoryAnalysisContext)).match(null,
		// "explicit");
    
    return init(this);
};
