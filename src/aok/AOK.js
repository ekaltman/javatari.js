// following structure of existing Javatari JS code

// global flags to control hook invocation - these allow hooking's
// state-saving side effects to be shut off at the source
// these could doubtless be stuffed in instances of AOK, but
// frankly this works, we'll only ever have one instance, and
// life's too short to waste fighting with js namespaces
//
var aok_dohook_frame = false;
var aok_dohook_instr = true;

jt.AOK = function(emu) {
    "use strict";
    var self;

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
                // at:ram@0x20(AF029F)
                // at:cpu@A(u128)
                // at:ram(s-12 DED8 m0--10--- [m1000---- m0---100- FF u35])
                // at:ram(.* (DED8) .*) (not allowed yet)
                // at:ram@0x80!(00), at:ram@0x80!(01), at:ram@0x80!(02)
                // (at:ram@0x80!(00) & at:ram@0xFF!(u10)), ..., at:ram@0x80!(FF))
                // Anchor exactly at an offset with !
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
            },
            {
                type:"changed",
                match: /^changed:([a-zA-Z_0-9]+)(@[0-9A-z_]+)/,
                // Examples:
                // changed:ram@0x20
                // changed:cpu@A
                // changed:ram@0x80, changed:ram@80 & at:ram@80!(02)
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
                    return {
                        block:memBlock,
                        offset:offset
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
                return trace.index > -1 && !trace.consumed;
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
                var pat = atNode.value.pattern;
                var memblk = state[atNode.value.block];
                var off = 0;
                var isArray = true;
                var i, j, end;
                if(atNode.value.offset.numeric) {
                    off = atNode.value.offset.actualOffset;
                    if(atNode.value.block == 'ram') {
                        off -= 0x80;
                    }
                } else {
                    memblk = memblk[atNode.value.offset.actualOffset];
                    isArray = Array.isArray(memblk);
                }
                if(isArray) {
                    end = memblk.length;
                    if(atNode.value.anchored) {
                        end = off+1;
                    }
                    for(i = off; i < end; i++) {
                        if(bmatches(memblk[i],pat[0])) {
                            var match = true;
                            for(j = i+1; j < i + pat.length; j++) {
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
                } else {
                    // It's either a two byte or a one byte value.
                    // HACK: Consult actualOffset to figure it out for now
                    if(atNode.value.offset.actualOffset == "PC") {
                        if(pat.length > 2) {
                            throw "Pattern too long for register";
                        }
                        if(pat.length == 2) {
                            var matches = true;
                            if(!bmatches((memblk & 0xFF00) >> 8, pat[0])) {
                                matches = false;
                            }
                            if(matches &&
                               pat.length == 2 &&
                               !bmatches((memblk & 0x00FF), pat[1])) {
                                matches = false;
                            }
                            if(matches) {
                                return {node:atNode, offset:0};
                            }
                        } else {
                            if(bmatches((memblk & 0xFF00) >> 8, pat[0])) {
                                return {node:atNode, offset:0};
                            }
                            if(bmatches((memblk & 0x00FF), pat[0])) {
                                return {node:atNode, offset:1};
                            }
                        }
                    } else {
                        if(pat.length > 1) {
                            throw "Pattern too long for register";
                        }
                        if(bmatches(memblk,pat[0])) {
                            return {node:atNode, offset:i};
                        }
                    }
                    return false;
                }
                //TODO: don't use constant strings, use regex on bytes
                return null;
            },
            "changed": function(trace, state, idx, atNode) {
                if(idx <= 1) {
                    return null;
                }
                // console.log(state);
                var memblk = state[atNode.value.block];
                var lastblk = self.lastState[atNode.value.block];
                var off = 0;
                var oldDatum, newDatum;
                if(atNode.value.offset.numeric) {
                    off = atNode.value.offset.actualOffset;
                    if(atNode.value.block == 'ram') {
                        off -= 0x80;
                    }
                    newDatum = memblk[off];
                    oldDatum = lastblk[off];
                } else {
                    newDatum = memblk[atNode.value.offset.actualOffset];
                    oldDatum = lastblk[atNode.value.offset.actualOffset];
                }
                if(oldDatum != newDatum) {
                    return {node:atNode};
                }
                return null;
            }
        }
        
    };

    function emptyState() {
        return {'tia':null, 'ram':null, 'cpu':null};
    }

    function flipState() {
        var temp = self.lastState;
        self.lastState = self.currentState;
        self.currentState = temp;
        Javatari.room.console.aokSaveState(self.currentState);
	return self.currentState;
    }
    this.flipState = flipState;
    
    function init(self) {
        self.checked_specs = [];
        self.lastState = emptyState();
        self.currentState = emptyState();
        self.currentCopy = emptyState();
        self.copyIsCurrent = false;
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

    // common matching code for instrs and frames
    this.domatch = function(state) {
	// Walk through entirety of spalist to update playspec state
	// even if the matches aren't used, and keep at any matched
	// ones until all their match results are consumed.  Keep
	// track of which ones matched in the parallel list matchlist;
	// currently only noting that *a* match has occurred.
	//
	var ps, matchlist = [];
	for (var i = 0; i < lstate.spalist.length; i++) {
		ps = lstate.spalist[i][1];

		// check for fastpath...
		if (typeof ps === 'function') {
			matchlist.push(ps());
			continue;
		}

		// ...otherwise fall back on full playspec engine
		if (ps.state.trace.index == -1) {
			ps.state.trace.index = 0;
		}
		ps.state.trace.consumed = false;
		ps = ( lstate.spalist[i][1] = ps.next() );
		assert(ps.state.trace.consumed == true);
		ps.state.trace.consumed = true;
		if (ps.match) {
			matchlist.push(true);
			// eat up any subsequent matches
			while (ps.match) {
				ps = ( lstate.spalist[i][1] = ps.next() );
			}
		} else {
			matchlist.push(false);
		}
	}
        self.copyIsCurrent = false;

	// Playspecs stuff is done, now process any found matches, obeying
	// language semantics re: states and continue.
	//
	for (var i = 0; i < lstate.spalist.length; i++) {
		if (lstate.curstate != lstate.spalist[i][0]) {
			// pattern qualified by state we aren't in right now
			continue;
		}
		if (matchlist[i] == true) {
			lstate.continue = false;

			// do all the things
			runcmds(lstate.spalist[i][2]);

			if (lstate.continue == false) {
				// stop after 1st match unless "continue" used
				break;
			}
		}
	}
    }

    // hook called at instruction dispatch point
    this.instructionDispatch = function(state) {
	if (lstate.frame_on == false) {
	    AOKEvent.fire(AOKEvent.AOK_INSTR_DISPATCH, {state: state});
		this.domatch(state);
	}
    };

    // hook called at top of frame
    this.frame = function(state) {
	if (lstate.frame_on == true) {
	    AOKEvent.fire(AOKEvent.AOK_FRAME_DISPATCH, {state: state});
		this.domatch(state);
	}
    };

    // initialize playspec matching state
    this.initMatching = function() {
        self.currentState = emptyState();
        self.copyIsCurrent = false;
        self.copyState = emptyState();
    }

    // language state
    var lstate = {
	throttle:	null,	// emu speed XXX to do
	frame_on:	null,	// frame or instr matching
	curstate:	null,	// current matching state, '' is normal
	start:		null,	// list of <START> actions, if any
	referenced:	null,	// state names referenced
	seenused:	null,	// state names seen (statically) used in spec
	continue:	null,	// tmp flag for communicating back to processing
	spalist:	null,	// state-pattern-action (ordered) list
	fastpath:	null,	// true if *all* exprs use fast path
    }

    this.resetlangstate = function() {
	lstate.throttle = 100;
	lstate.frame_on = false;
	lstate.curstate = '';
	lstate.start = null;
	lstate.referenced = {};
	lstate.seenused = {};
	lstate.continue = false;
	lstate.spalist = [];
	// reset hooking state
	aok_dohook_instr = true;
	aok_dohook_frame = false;
	// and clear playspec state
	this.initMatching();
	// and fastpath
	aokfp_resetcounter();
    }

    // command implementations - add new ones to ctab too
    function c_frame() {
    	lstate.frame_on = true;
	if (!lstate.fastpath) {
		aok_dohook_instr = false;
		aok_dohook_frame = true;
	}
    }
    function c_instr() {
    	lstate.frame_on = false;
	if (!lstate.fastpath) {
		aok_dohook_instr = true;
		aok_dohook_frame = false;
	}
    }
    function c_throttle(n) {
	if (n < 1) {			// quietly clamp value
		n = 1;
	} else if (n > 100) {
		n = 100;
	}
    	lstate.throttle = n;
    }
    function c_begin(name) {
    	lstate.curstate = name;
    }
    function c_log(s) {
	AOKEvent.fire(AOKEvent.AOK_LOG, {s:s});
    	console.log(s);
    }
    function c_continue(s) {
    	lstate.continue = true;
    }
    function c_eval(s) {
    	eval(s);
    }

    function c_message(s) {
	AOKEvent.fire(AOKEvent.AOK_MESSAGE, {s:s});
    	//console.log("message " + s);
    }
    function c_bubble(coord, s) {
	AOKEvent.fire(AOKEvent.AOK_BUBBLE, {s:s, coord: coord});
    	//console.log("bubble " + coord + " " + s);
    }

    function docoordrange(event, coord, args) {
    	if (coord.includes(':')) {
		// XXX this should be preprocessed and canonicalized
		var re = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/, m;
		if ((m = re.exec(coord)) !== null) {
			var AL = [ m[1], m[3] ];
			AL.sort();
			var NL = [ parseInt(m[2]), parseInt(m[4]) ];
			NL.sort(function(a, b) { return a - b });
			for (var col = AL[0]; col <= AL[1]; ) {
				for (var row = NL[0]; row <= NL[1]; row++) {
					args.coord = col + row;
					AOKEvent.fire(event, args);
				}
				// XXX - will break past 'Z'
				col = String.fromCharCode(col.charCodeAt(0) +1);
			}
		} else {
			assert(false);
		}
	} else {
		args.coord = coord;
		AOKEvent.fire(event, args);
	}
    }

    function c_highlight(coord) {
	docoordrange(AOKEvent.AOK_HIGHLIGHT, coord, {});
	//AOKEvent.fire(AOKEvent.AOK_HIGHLIGHT, {coord: coord});
    	//console.log("highlight " + coord);
    }
    function c_normal(coord) {
	docoordrange(AOKEvent.AOK_NORMAL, coord, {});
	//AOKEvent.fire(AOKEvent.AOK_NORMAL, {coord: coord});
    	//console.log("normal " + coord);
    }
    function c_label(coord, s) {
	docoordrange(AOKEvent.AOK_LABEL, coord, {s: s});
	//AOKEvent.fire(AOKEvent.AOK_LABEL, {s:s, coord: coord});
    	//console.log("label " + coord + " " + s);
    }

    // run a list of commands
    function runcmds(L) {
    	var i, s, f, args;
	for (i = 0; i < L.length; i++) {
		f = L[i][0];
		args = L[i][1];
		try {
			f.apply(null, args);
		} catch (s) {
			console.log(s);
			return;
		}
	}
    }

    this.newfile = function(s) {
	var error, last = null, lineno = 1, expectbytes = false;

	// Command table, maps command name into arg-type/function.
	// Argument type encodings are
	//	n	positive integer
	//	c	spreadsheet coordinate
	//	C	spreadsheet coordinate or coordinate range
	//	w	word (or quoted string)
	//	s	state name
	//
	var ctab = {
		'throttle':	[ 'n',		c_throttle ],
		'frame':	[ '',		c_frame ],
		'instr':	[ '',		c_instr ],
		'begin':	[ 's',		c_begin ],
		'log':		[ 'w',		c_log ],
		'highlight':	[ 'C',		c_highlight ],
		'normal':	[ 'C',		c_normal ],
		'message':	[ 'w',		c_message ],
		'bubble':	[ 'cw',		c_bubble ],
		'continue':	[ '',		c_continue ],
		'eval':		[ 'w',		c_eval ],
		'label':	[ 'Cw',		c_label ],
	};

	// Scanner returns lexemes whose token type can be distinguished
	// based on the first character:
	//	@	at:..., changed:...  (later is parenthesized playspec)
	//	(	(
	//	)	)
	//	|	|
	//	;	;
	//	,	,
	//	&	&
	//	<	<state>
	//	{	{
	//	}	}
	//	"	"word"
	//	\n	\n
	//	$	EOF
	//	?	wtf?
	//
	var peek = function() {
		if (last != null) {
			return last;
		}
		return last = lex();
	};

	var lex = function() {
		var rv, m, re;

		if (last != null) {
			rv = last;
			last = null;
			return rv;
		}

		if (expectbytes) {
			rv = s;
			s = '';
			return rv;
		}

		while (true) {
			// skip whitespace except \n
			re = /^[ \t\r]+/g;
			if ((m = re.exec(s)) !== null) {
				s = s.slice(re.lastIndex);
				continue;
			}
			// skip comments
			re = /^\/\/[^\n]*/g;
			if ((m = re.exec(s)) !== null) {
				s = s.slice(re.lastIndex);
				continue;
			}
			// EOF
			if (s.length == 0) {
				return '$';
			}
			// pick off singletons
			switch (rv = s[0]) {
			    case '\n':
				lineno += 1;
				// falls through
			    case '{':
			    case '}':
			    case ',':
			    case '&':
			    case '|':
			    case ';':
			    case '(':
			    case ')':
				s = s.slice(1);
				return rv;
			}
			// ellipsis
			re = /^\.\.\./g;
			if ((m = re.exec(s)) !== null) {
				s = s.slice(re.lastIndex);
				return '\u2026'			// unicode "..."
			}
			// states
			re = /^<\w+>/g;
			if ((m = re.exec(s)) !== null) {
				s = s.slice(re.lastIndex);
				return m[0];
			}
			// (single) at:... expressions
			re = /^at:\w+(@\w+)?\((!?)([^)]+)\)/g;
			if ((m = re.exec(s)) !== null) {
				s = s.slice(re.lastIndex);
				return '@' + m[0];
			}
			// (single) changed:... expressions
			re = /^changed:\w+(@\w+)/g;
			if ((m = re.exec(s)) !== null) {
				s = s.slice(re.lastIndex);
				return '@' + m[0];
			}
			// unquoted word
			re = /^\w+/g;
			if ((m = re.exec(s)) !== null) {
				s = s.slice(re.lastIndex);
				return '"' + m[0] + '"';
			}
			// quoted text
			re = /^"[^\n"]*"/g;
			if ((m = re.exec(s)) !== null) {
				s = s.slice(re.lastIndex);
				return m[0];
			}
			// lexical error - advance one char
			s = s.slice(1);
			return '?';
		}
	}

	// Ye olde recursive descent parser, for the grammar
	//
	// start ::= { globalstmt } [ 'spreadsheet' BYTE* ] EOF
	// globalstmt ::= '\n'
	// globalstmt ::= STATE action
	// globalstmt ::= [ STATE ] psexpr action
	// action ::= stmt
	// action ::= '{' { stmt } '}'
	// stmt ::= { WORD } '\n'
	// psexpr ::= PLAYSPEC
	//
	var checkargs = function(cmd, args) {
		var i, re, cargs = ctab[cmd][0];
		if (args.length < ctab[cmd][0].length) {
			throw "not enough arguments for " + cmd;
		}
		if (args.length > ctab[cmd][0].length) {
			throw "too many arguments for " + cmd;
		}
		for (i = 0; i < cargs.length; i++) {
			switch (cargs[i]) {
			    case 'n':
				re = /^\d+$/;
				if (re.test(args[i]) == false) {
					throw "bad number for " + cmd;
				}
				break;
			    case 'c':
				re = /^[A-Z]+\d+$/;
				if (re.test(args[i]) == false) {
					throw "bad coordinate for " + cmd;
				}
				break;
			    case 'C':
				re = /^[A-Z]+\d+(:[A-Z]+\d+)?$/;
				if (re.test(args[i]) == false) {
					throw "bad coordinate range for " + cmd;
				}
				break;
			    case 's':
				// * not + to allow return to "" state
				re = /^\w*$/;
				if (re.test(args[i]) == false) {
					throw "bad state name for " + cmd;
				}
				if (args[i] == 'START') {
					throw "can't use START for " + cmd;
				}
				lstate.referenced[args[i]] = true;
				break;
			    case 'w':
				// whatevs
				break;
			    default:
				console.log("bad ctab arg spec (INTERNAL)");
				break;
			}
		}
	}

	var stmt = function() {
		var t, words = [];
		while ((t = lex())[0] == '"')
			words.push(t.slice(1, -1));
		if (t != '\n') {
			throw "statement should be words then newline";
		}

		// now check it
		if (words.length == 0) {
			return null;
		}
		var cmd;
		for (cmd in ctab) {
			if (words[0] == cmd) {
				var args = words.slice(1);
				checkargs(cmd, args);
				return [ ctab[cmd][1], args ];
			}
		}
		console.log("Warning: unknown command "+ words[0] +" skipped");
		return null;
	}

	var action = function() {
		var S, L = [];
		if (peek() != '{') {
			S = stmt();
			return (S === null) ? [] : [ S ];
		} else {
			lex();				// consume {
			while (peek() != '}') {
				S = stmt();
				if (S !== null) {
					L.push(S);
				}
			}
			lex();				// consume }
			return L;
		}
	}

	// parse without regard for operator precedence; playspecs handles that
	var psexpr_atom = function() {
		var rv, t = peek();
		switch (t[0]) {
		    case '(':
			lex();
			rv = psexpr_binop();
			if (peek() != ')') {
				throw 'expected ")"';
			}
			lex();
			return '(' + rv + ')';
		    case '@':
			return lex().slice(1);
		    case '\u2026':				// unicode "..."
			lex();
			return '...';
		    case '"':
			if (t == '"end"') {
				lex();
				return 'end';
			}
			if (t == '"not"') {
				lex();
				return 'not ' + psexpr_atom();
			}
			// falls through
		    default:
			throw 'expected playspec atom or parenthesized expr';
		}
	}
	var psexpr_binop = function() {
		var t, rv = psexpr_atom();
		while ('&|,;'.includes( (t = peek())[0] )) {
			rv += lex();
			rv += psexpr_atom();
		}
		return rv;
	}

	var psexpr = function() {
		if (!'(@'.includes(peek()[0])) {
			throw 'expected playspec expression';
		}
		return '@' + psexpr_binop();
	}

	var makePS = function(expr) {
		// Utility function wrapping playspec creation.
		//
		// XXX An exception object's thrown by PS for malformed
		//	expressions, and long-term should get caught,
		//	re-formatted as a string, and thrown anew, but the
		//	info's too useful for debugging right now.
		//
		expr = expr.slice(1);		// remove @
		//console.log("expr = [" + expr + "]");

		// I can haz fastpath?
		var func = aokfp_getfunc(expr);
		if (func !== null) {
			return func;
		}
		// Nope
		var p;
		p = new Playspecs.Playspec(expr, memoryAnalysisContext);
		return p.match(null, "explicit");
	}

	var globalstmt = function() {
		var s = '', t = peek();
		switch (t[0]) {
		    case '\n':
			lex();
			break;
		    case '<':
			s = t.slice(1, -1);
			lstate.seenused[s] = true;

			lex();
			if (!'(@'.includes(peek()[0])) {	// blech
				if (s != 'START') {
					throw "can only omit at-expr for START";
				}
				if (lstate.start !== null) {
					throw "can only specify START once";
				}
				lstate.start = action();
				break;
			}
			// falls through
		    case '(':
		    case '@':
			var expr = psexpr();
			var actions = action();
			var ps = makePS(expr);
			lstate.spalist.push([ s, ps, actions ])
			break;
		    case '"':
			if (t == '"spreadsheet"') {
				lex();
				// mmm, tasty lexical feedback
				expectbytes = true;
				s = lex();
				expectbytes = false;
				//console.log(s);
				AOKEvent.fire(AOKEvent.AOK_SHEET_IMPORT, {s:s});
				break;
			}
			// falls through
		    default:
			throw "expected pattern";
		}
	}

	var start = function() {
		while (peek() != '$') {
			globalstmt();
		}
		if (lex() != '$') {
			throw "expected EOF";
		}
	}

	// parse through spec file
	console.log(lstate);
	this.resetlangstate();
	try {
		start();
	} catch (error) {
		console.log("Error: " + error + " at or near line " + lineno);
		this.resetlangstate();
		return;
	}

	// typo checks on state names
	var name;
	for (name in lstate.referenced) {
		if (name == '') {
			continue;
		}
		if (!(name in lstate.seenused)) {
			console.log("Warning: undefined state " +name+ " used");
		}
	}
	for (name in lstate.seenused) {
		if (name == 'START') {
			continue;
		}
		if (!(name in lstate.referenced)) {
			console.log("Warning: no begin uses state " + name);
		}
	}

	// nothing in spalist uses playspecs => disable expensive state saving
	var ps;
	lstate.fastpath = true;
	for (var i = 0; i < lstate.spalist.length; i++) {
		ps = lstate.spalist[i][1];
		if (typeof ps !== 'function') {
			lstate.fastpath &= false;
		}
	}
	if (lstate.fastpath) {
		aok_dohook_instr = aok_dohook_frame = false;
	    console.log("[AOK fastpath detected]");
	}

	// run initial commands, if any
	if (lstate.start !== null) {
		runcmds(lstate.start);
	}
    };

    //Simple events for the UI

    var AOKEvent = new function(){
	var self = this;

	self.event_queues = {};
	//self.fired = []; not really used, could for event logging?

	return {
	    AOK_LABEL: "aok_label",
	    AOK_SHEET_IMPORT: "aok_sheet_import",
	    AOK_MESSAGE: "aok_message",
	    AOK_NORMAL: "aok_normal",
	    AOK_BUBBLE: "aok_bubble",
	    AOK_HIGHLIGHT: "aok_highlight",
	    AOK_LOG: "aok_log",
	    AOK_INSTR_DISPATCH: "aok_instr_dispatch", //dispatched on language state instr call
	    AOK_FRAME_DISPATCH: "aok_frame_dispatch", // dispatched on language state frame call
	    CONSOLE_INSTR_DISPATCH: "aok_instr_dispatch", // dispatched on AtariConsole instr call
	    CONSOLE_FRAME_DISPATCH: "aok_frame_dispatch", // dispatched on AtariConsole frame call
	    fire: function(event, eventData){
		var queue = self.event_queues[event];

		if(typeof queue === "undefined"){
		    return;
		}

		queue.forEach(function (callback) {
		    callback(eventData);
		});

	    },

	    on: function(event, callback){
		if (typeof self.event_queues[event] === 'undefined'){
		    self.event_queues[event] = [];
		}

		self.event_queues[event].push(callback);
	    }
	};
    }();

    this.aok_event = AOKEvent;


    return (self = init(this));
};
